import dayjs from './dates'

const labelForPriority = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

const getCompletionDaysByTask = (history = []) => {
  const completionDays = {}
  history.forEach((entry) => {
    const taskId = entry.taskId || entry.task_id
    const completedAt = entry.completedAt || entry.completed_at
    if (!taskId || !completedAt) return
    const parsed = dayjs(completedAt)
    if (!parsed.isValid()) return
    if (!completionDays[taskId]) completionDays[taskId] = new Set()
    completionDays[taskId].add(parsed.format('YYYY-MM-DD'))
  })
  return completionDays
}

const getLatestCompletionByTask = (tasks, history = []) => {
  const latest = {}

  tasks.forEach((task) => {
    const metaDone = task.lastCompletedAt ? dayjs(task.lastCompletedAt) : null
    if (metaDone?.isValid()) {
      latest[task.id] = metaDone
    }
  })

  history.forEach((entry) => {
    const taskId = entry.taskId || entry.task_id
    const completedAt = entry.completedAt || entry.completed_at
    if (!taskId || !completedAt) return
    const parsed = dayjs(completedAt)
    if (!parsed.isValid()) return
    const existing = latest[taskId]
    if (!existing || parsed.isAfter(existing)) {
      latest[taskId] = parsed
    }
  })

  return latest
}

const buildTaskCard = (task, date, overrides = {}) => {
  const status = overrides.status ?? 'due'
  const duration = overrides.duration ?? task.duration
  return {
    id: `${task.id}-${date}-${overrides.part ?? 'core'}`,
    taskId: task.id,
    category: task.category || 'occasional',
    title: task.title,
    description: task.description,
    duration,
    chunkMinutes: duration,
    priority: status === 'overdue' ? 'high' : task.priority,
    priorityLabel: overrides.priorityLabel ?? labelForPriority[task.priority] ?? 'Task',
    autop: task.autop,
    status,
    type: overrides.type ?? (overrides.scheduledSlot ? 'scheduled' : 'due'),
    part: overrides.part ?? null,
    dueDate: overrides.dueDate ?? task.nextDueDate ?? date,
    scheduledSlot: overrides.scheduledSlot ?? null,
    scheduledTime: overrides.scheduledTime ?? null,
    window: task.window ?? 'any',
    notesEnabled: task.notesEnabled,
  }
}

const sortDayTasks = (tasks) => {
  const statusOrder = { overdue: 1, scheduled: 2, floating: 3, due: 4 }
  return tasks.sort((a, b) => {
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
    if (priorityDiff !== 0) return priorityDiff
    const statusDiff = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
    if (statusDiff !== 0) return statusDiff
    if (a.dueDate === b.dueDate) return a.title.localeCompare(b.title)
    return dayjs(a.dueDate).isBefore(b.dueDate) ? -1 : 1
  })
}

export const buildPlanner = ({ tasks = [], history = [], startDate = dayjs(), days = 7 }) => {
  const start = dayjs(startDate).startOf('day')
  const startIso = start.format('YYYY-MM-DD')
  const previousDay = start.subtract(1, 'day')
  const latestDoneByTask = getLatestCompletionByTask(tasks, history)
  const completionDaysByTask = getCompletionDaysByTask(history)
  const plannerDays = Array.from({ length: days }, (_, index) => {
    const date = start.add(index, 'day')
    const iso = date.format('YYYY-MM-DD')
    const scheduledCards = []

    tasks.forEach((task) => {
      const taskCategory = task.category || 'occasional'
      const completionDays = completionDaysByTask[task.id] || new Set()

      if (taskCategory === 'daily') {
        if (!completionDays.has(iso)) {
          scheduledCards.push(
            buildTaskCard(task, iso, {
              status: 'due',
              type: 'daily',
              dueDate: iso,
              priorityLabel: 'Daily task',
            }),
          )
        }
        return
      }

      if (taskCategory === 'long_term') {
        const assignedDates = (task.assignedDates || []).map((value) => dayjs(value)).filter((value) => value.isValid())
        const assignedToday = assignedDates.some((value) => value.isSame(iso, 'day'))
        if (assignedToday && !completionDays.has(iso)) {
          scheduledCards.push(
            buildTaskCard(task, iso, {
              status: 'due',
              type: 'long_term',
              dueDate: iso,
              priorityLabel: 'Long-term checkpoint',
            }),
          )
        }
        return
      }

      const slots = (task.scheduledSlots || [])
        .map((value) => ({ raw: value, parsed: dayjs(value) }))
        .filter((slot) => slot.parsed.isValid())
      const latestDone = latestDoneByTask[task.id]
      const todaysSlots = slots.filter((slot) => slot.parsed.isSame(iso, 'day'))
      const pendingSlots = todaysSlots.filter((slot) => !latestDone || latestDone.isBefore(slot.parsed, 'day'))

      pendingSlots.forEach((slot, slotIndex) => {
        const card = buildTaskCard(task, iso, {
          status: 'due',
          type: 'scheduled',
          dueDate: iso,
          scheduledSlot: slot.raw,
          scheduledTime: slot.parsed.format('HH:mm'),
          part: pendingSlots.length > 1 ? `Slot ${slotIndex + 1}` : null,
          priorityLabel: 'Scheduled slot',
        })
        scheduledCards.push(card)
      })
    })

    const totalMinutes = scheduledCards.reduce((sum, task) => sum + task.duration, 0)

    return {
      date: iso,
      label: date.format('dddd, MMM D'),
      shortLabel: date.format('ddd DD'),
      tasks: scheduledCards,
      totalMinutes,
    }
  })

  const overdueSlots = tasks
    .flatMap((task) =>
      ((task.category || 'occasional') !== 'occasional'
        ? []
        : (task.scheduledSlots || [])
            .map((slot) => ({ task, slotRaw: slot, slot: dayjs(slot), latestDone: latestDoneByTask[task.id] }))
            .filter(({ slot }) => slot.isValid())),
    )
    .filter(({ slot, latestDone }) => {
      // Carry over only the immediately previous day, not all historical missed slots.
      if (!slot.isSame(previousDay, 'day')) return false
      if (!latestDone?.isValid()) return true
      return latestDone.isBefore(slot, 'day')
    })
    .map(({ task, slot, slotRaw }) =>
      buildTaskCard(task, startIso, {
        status: 'overdue',
        type: 'scheduled',
        dueDate: slot.format('YYYY-MM-DD'),
        scheduledSlot: slotRaw,
        scheduledTime: slot.format('HH:mm'),
        priorityLabel: 'Scheduled slot',
      }),
    )

  if (plannerDays[0] && overdueSlots.length) {
    plannerDays[0].tasks = [...overdueSlots, ...plannerDays[0].tasks]
    plannerDays[0].totalMinutes += overdueSlots.reduce((sum, task) => sum + task.duration, 0)
  }

  plannerDays.forEach((day) => {
    day.tasks = sortDayTasks(day.tasks)
  })

  return {
    start: startIso,
    end: start.add(days - 1, 'day').format('YYYY-MM-DD'),
    days: plannerDays,
  }
}

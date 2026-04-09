import dayjs from './dates'

const labelForPriority = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const WINDOW_ORDER = { morning: 0, afternoon: 1, evening: 2, any: 3 }
const STATUS_ORDER = { overdue: 0, scheduled: 1, due: 2, floating: 3 }
const LONG_TERM_TASK = 'long_term_task'
const LONG_TERM_GOAL = 'long_term_goal'

const getDependencyTrigger = (task) => {
  if ((task.category || 'occasional') !== 'occasional') return null
  if (task.recurrence?.mode !== 'after_completion') return null
  if (!task.triggerTaskId) return null
  return {
    triggerTaskId: task.triggerTaskId,
    triggerAfterDays: Math.max(0, Number(task.triggerAfterDays) || 0),
  }
}

const getDependencyDueDate = (task, latestDoneByTask) => {
  const trigger = getDependencyTrigger(task)
  if (!trigger) return null
  const triggerCompletedAt = latestDoneByTask[trigger.triggerTaskId]
  if (!triggerCompletedAt?.isValid()) return null
  return triggerCompletedAt.startOf('day').add(trigger.triggerAfterDays, 'day')
}

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
  return tasks.sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4)
    if (statusDiff !== 0) return statusDiff
    const windowDiff = (WINDOW_ORDER[a.window] ?? 4) - (WINDOW_ORDER[b.window] ?? 4)
    if (windowDiff !== 0) return windowDiff
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
    if (priorityDiff !== 0) return priorityDiff
    if (a.scheduledTime && b.scheduledTime && a.scheduledTime !== b.scheduledTime) {
      return a.scheduledTime.localeCompare(b.scheduledTime)
    }
    if (a.dueDate === b.dueDate) return a.title.localeCompare(b.title)
    return dayjs(a.dueDate).isBefore(b.dueDate) ? -1 : 1
  })
}

export const buildPlanner = ({ tasks = [], history = [], startDate = dayjs(), days = 7 }) => {
  const start = dayjs(startDate).startOf('day')
  const latestDoneByTask = getLatestCompletionByTask(tasks, history)
  const completionDaysByTask = getCompletionDaysByTask(history)
  const plannerDays = Array.from({ length: days }, (_, index) => {
    const date = start.add(index, 'day')
    const iso = date.format('YYYY-MM-DD')
    const previousDay = date.subtract(1, 'day')
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

      if (taskCategory === LONG_TERM_TASK || taskCategory === LONG_TERM_GOAL) {
        const assignedWeekdays = Array.isArray(task.assignedWeekdays) ? task.assignedWeekdays : []
        const assignedToday = assignedWeekdays.includes(date.day())
        if (assignedToday && !completionDays.has(iso)) {
          scheduledCards.push(
            buildTaskCard(task, iso, {
              status: 'due',
              type: taskCategory,
              dueDate: iso,
              priorityLabel: taskCategory === LONG_TERM_GOAL ? 'Long-term goal' : 'Long-term task',
            }),
          )
        }
        return
      }

      const dependencyDueDate = getDependencyDueDate(task, latestDoneByTask)
      if (dependencyDueDate?.isValid()) {
        const latestDone = latestDoneByTask[task.id]
        const alreadyCompletedForCurrentTrigger = latestDone?.isValid() && !latestDone.isBefore(dependencyDueDate, 'day')
        if (!alreadyCompletedForCurrentTrigger && !date.isBefore(dependencyDueDate, 'day')) {
          scheduledCards.push(
            buildTaskCard(task, iso, {
              status: date.isAfter(dependencyDueDate, 'day') ? 'overdue' : 'due',
              type: 'after_completion',
              dueDate: dependencyDueDate.format('YYYY-MM-DD'),
              priorityLabel: 'After completion',
            }),
          )
        }
        return
      }

      const slots = (task.scheduledSlots || [])
        .map((value) => ({ raw: value, parsed: dayjs(value) }))
        .filter((slot) => slot.parsed.isValid())
      const latestDone = latestDoneByTask[task.id]
      const carryoverSlots = slots.filter((slot) => slot.parsed.isSame(previousDay, 'day') && (!latestDone || latestDone.isBefore(slot.parsed, 'day')))
      const todaysSlots = slots.filter((slot) => slot.parsed.isSame(iso, 'day'))
      const pendingSlots = todaysSlots.filter((slot) => !latestDone || latestDone.isBefore(slot.parsed, 'day'))

      carryoverSlots.forEach((slot) => {
        const card = buildTaskCard(task, iso, {
          status: 'overdue',
          type: 'scheduled',
          dueDate: slot.parsed.format('YYYY-MM-DD'),
          scheduledSlot: slot.raw,
          scheduledTime: slot.parsed.format('HH:mm'),
          priorityLabel: 'Scheduled slot',
        })
        scheduledCards.push(card)
      })

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

  plannerDays.forEach((day) => {
    day.tasks = sortDayTasks(day.tasks)
  })

  return {
    start: startIso,
    end: start.add(days - 1, 'day').format('YYYY-MM-DD'),
    days: plannerDays,
  }
}

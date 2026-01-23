import dayjs from './dates'

const labelForPriority = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const DAILY_TARGET_MINUTES = 240
const DEFAULT_CHUNK_MINUTES = 60

const buildTaskCard = (task, date, overrides = {}) => {
  const status = overrides.status ?? 'due'
  const duration = overrides.duration ?? task.duration
  return {
    id: `${task.id}-${date}-${overrides.part ?? 'core'}`,
    taskId: task.id,
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

const distributeFloatingTasks = (days, floatingTasks) => {
  if (!floatingTasks.length) return
  const loads = days.map((day) => day.totalMinutes)
  const sorted = [...floatingTasks].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))

  sorted.forEach((task) => {
    let remaining = task.remainingDuration ?? task.duration
    if (remaining <= 0) return
    let chunkIndex = 1
    let dayIndex = 0
    const maxChunk = task.maxChunkMinutes || DEFAULT_CHUNK_MINUTES
    const deferUntil = task.deferUntil ? dayjs(task.deferUntil) : null

    while (remaining > 0) {
      if (dayIndex >= days.length) dayIndex = days.length - 1
      const targetDay = days[dayIndex]
      const dayDate = dayjs(targetDay.date)
      if (deferUntil && dayDate.isBefore(deferUntil, 'day')) {
        if (dayIndex === days.length - 1) {
          // no more days in view; ignore defer so task still shows up
        } else {
          dayIndex += 1
          continue
        }
      }

      let chunk = remaining
      if (task.autoSplit || remaining > maxChunk) {
        const available = Math.max(30, DAILY_TARGET_MINUTES - loads[dayIndex])
        chunk = Math.min(remaining, maxChunk, available > 0 ? available : maxChunk)
      }

      if (chunk <= 0) {
        dayIndex += 1
        continue
      }

      const card = buildTaskCard(task, targetDay.date, {
        duration: chunk,
        status: 'floating',
        type: 'floating',
        part: task.autoSplit || remaining < task.duration ? `Part ${chunkIndex}` : null,
        priorityLabel: 'Auto scheduled',
      })

      targetDay.tasks.push(card)
      targetDay.totalMinutes += chunk
      loads[dayIndex] += chunk
      remaining -= chunk
      chunkIndex += 1

      if (!task.autoSplit) break
      dayIndex += 1
    }
  })
}

export const buildPlanner = ({ tasks = [], startDate = dayjs(), days = 7 }) => {
  const start = dayjs(startDate).startOf('day')
  const startIso = start.format('YYYY-MM-DD')
  const plannerDays = Array.from({ length: days }, (_, index) => {
    const date = start.add(index, 'day')
    const iso = date.format('YYYY-MM-DD')
    const scheduledCards = []

    tasks.forEach((task) => {
      const slots = (task.scheduledSlots || []).map((value) => dayjs(value))
      const todaysSlots = slots.filter((slot) => slot.isSame(iso, 'day'))
      todaysSlots.forEach((slot, slotIndex) => {
        const card = buildTaskCard(task, iso, {
          status: 'due',
          type: 'scheduled',
          dueDate: iso,
          scheduledSlot: slot.toISOString(),
          scheduledTime: slot.format('HH:mm'),
          part: todaysSlots.length > 1 ? `Slot ${slotIndex + 1}` : null,
          priorityLabel: 'Scheduled by AI',
        })
        scheduledCards.push(card)
      })
    })

    const dueToday = tasks
      .filter((task) => !task.scheduledSlots?.length && task.nextDueDate)
      .filter((task) => dayjs(task.nextDueDate).isSame(iso, 'day'))
      .map((task) => buildTaskCard(task, iso))

    const totalMinutes = [...scheduledCards, ...dueToday].reduce((sum, task) => sum + task.duration, 0)

    return {
      date: iso,
      label: date.format('dddd, MMM D'),
      shortLabel: date.format('ddd DD'),
      tasks: [...scheduledCards, ...dueToday],
      totalMinutes,
    }
  })

  const overdue = tasks
    .filter((task) => task.nextDueDate)
    .filter((task) => dayjs(task.nextDueDate).isBefore(start, 'day'))
    .map((task) => buildTaskCard(task, startIso, { status: 'overdue' }))

  const overdueSlots = tasks
    .flatMap((task) => (task.scheduledSlots || []).map((slot) => ({ task, slot: dayjs(slot) })))
    .filter(({ slot }) => slot.isBefore(start, 'day'))
    .map(({ task, slot }) =>
      buildTaskCard(task, startIso, {
        status: 'overdue',
        type: 'scheduled',
        dueDate: slot.format('YYYY-MM-DD'),
        scheduledSlot: slot.toISOString(),
        scheduledTime: slot.format('HH:mm'),
        priorityLabel: 'Scheduled by AI',
      }),
    )

  if (plannerDays[0]) {
    const overdueAll = [...overdue, ...overdueSlots]
    plannerDays[0].tasks = [...overdueAll, ...plannerDays[0].tasks]
    plannerDays[0].totalMinutes += overdueAll.reduce((sum, task) => sum + task.duration, 0)
  }

  const floating = tasks.filter((task) => task.recurrence?.mode === 'floating')
  distributeFloatingTasks(plannerDays, floating)

  plannerDays.forEach((day) => {
    day.tasks = sortDayTasks(day.tasks)
  })

  return {
    start: startIso,
    end: start.add(days - 1, 'day').format('YYYY-MM-DD'),
    days: plannerDays,
  }
}

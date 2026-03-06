import dayjs from './dates'

const labelForPriority = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

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

export const buildPlanner = ({ tasks = [], startDate = dayjs(), days = 7 }) => {
  const start = dayjs(startDate).startOf('day')
  const startIso = start.format('YYYY-MM-DD')
  const plannerDays = Array.from({ length: days }, (_, index) => {
    const date = start.add(index, 'day')
    const iso = date.format('YYYY-MM-DD')
    const scheduledCards = []

    tasks.forEach((task) => {
      const slots = (task.scheduledSlots || [])
        .map((value) => ({ raw: value, parsed: dayjs(value) }))
        .filter((slot) => slot.parsed.isValid())
      const todaysSlots = slots.filter((slot) => slot.parsed.isSame(iso, 'day'))
      todaysSlots.forEach((slot, slotIndex) => {
        const card = buildTaskCard(task, iso, {
          status: 'due',
          type: 'scheduled',
          dueDate: iso,
          scheduledSlot: slot.raw,
          scheduledTime: slot.parsed.format('HH:mm'),
          part: todaysSlots.length > 1 ? `Slot ${slotIndex + 1}` : null,
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

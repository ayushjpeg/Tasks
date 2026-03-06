import dayjs from './dates'

const iso = (d) => dayjs(d).format('YYYY-MM-DD')

const getLastCompletedMap = (history) => {
  const latest = {}
  history.forEach((entry) => {
    const existing = latest[entry.taskId]
    if (!existing || dayjs(entry.completedAt).isAfter(existing)) {
      latest[entry.taskId] = dayjs(entry.completedAt)
    }
  })
  return latest
}

const getRecurrenceWindow = (task, lastCompleted) => {
  const cfg = task.recurrence || {}
  const startAfter = Math.max(0, cfg.start_after_days ?? cfg.startAfterDays ?? 0)
  const endBefore = Math.max(startAfter, cfg.end_before_days ?? cfg.endBeforeDays ?? startAfter)
  const base = lastCompleted || dayjs()
  const windowStart = base.add(startAfter, 'day')
  const windowEnd = base.add(endBefore, 'day')
  return { windowStart, windowEnd }
}

export const buildRecommendations = ({ tasks = [], history = [], weekStart, plannedSlots = {} }) => {
  const start = dayjs(weekStart).startOf('day')
  const end = start.add(6, 'day').endOf('day')
  const days = Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
  const lastCompleted = getLastCompletedMap(history)

  // Track earliest planned date per task to avoid recommending again after scheduled.
  const earliestPlanned = {}
  Object.entries(plannedSlots).forEach(([date, items]) => {
    const day = dayjs(date)
    items.forEach((taskId) => {
      const existing = earliestPlanned[taskId]
      if (!existing || day.isBefore(existing, 'day')) {
        earliestPlanned[taskId] = day
      }
    })
  })

  return days.map((day) => {
    const dayIso = iso(day)
    const recommended = []

    tasks.forEach((task) => {
      const plannedDay = earliestPlanned[task.id]
      const lastDone = lastCompleted[task.id]

      // If task was completed during this planning week, don't recommend it again later in the same week.
      const completedThisWeek = !!lastDone && !lastDone.isBefore(start, 'day') && !lastDone.isAfter(end, 'day')
      if (completedThisWeek && !day.isBefore(lastDone, 'day')) {
        return
      }

      // If user planned this task for a day this week:
      // - hide it before and on that day
      // - show as late only after that day if it still wasn't completed
      if (plannedDay) {
        if (!day.isAfter(plannedDay, 'day')) {
          return
        }

        const completedAfterPlanned = !!lastDone && (lastDone.isSame(plannedDay, 'day') || lastDone.isAfter(plannedDay, 'day'))
        if (!completedAfterPlanned) {
          recommended.push({
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            duration: task.duration,
            status: 'late',
            windowStart: iso(plannedDay),
            windowEnd: iso(plannedDay),
            lastCompletedAt: lastDone ? lastDone.toISOString() : null,
          })
        }
        return
      }

      const { windowStart, windowEnd } = getRecurrenceWindow(task, lastDone)

      if (day.isBefore(windowStart, 'day')) return

      const status = day.isAfter(windowEnd, 'day') ? 'late' : 'recommended'
      if (status === 'recommended') {
        recommended.push({
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          duration: task.duration,
          status,
          windowStart: iso(windowStart),
          windowEnd: iso(windowEnd),
          lastCompletedAt: lastDone ? lastDone.toISOString() : null,
        })
      } else if (status === 'late') {
        recommended.push({
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          duration: task.duration,
          status,
          windowStart: iso(windowStart),
          windowEnd: iso(windowEnd),
          lastCompletedAt: lastDone ? lastDone.toISOString() : null,
        })
      }
    })

    // Sort: late first, then priority.
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    recommended.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'late' ? -1 : 1
      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    })

    return {
      date: dayIso,
      label: day.format('ddd, MMM D'),
      recommended,
    }
  })
}

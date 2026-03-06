import dayjs from './dates'

const iso = (d) => dayjs(d).format('YYYY-MM-DD')

const slotDayKey = (slot) => {
  if (!slot) return null
  const raw = String(slot)
  const datePrefix = raw.match(/^\d{4}-\d{2}-\d{2}/)
  if (datePrefix) return datePrefix[0]
  const parsed = dayjs(raw)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

const getLastCompletedMap = (history) => {
  const latest = {}
  history.forEach((entry) => {
    const taskId = entry.taskId || entry.task_id
    const completedAt = entry.completedAt || entry.completed_at
    if (!taskId || !completedAt) return
    const completed = dayjs(completedAt)
    if (!completed.isValid()) return
    const existing = latest[taskId]
    if (!existing || completed.isAfter(existing)) {
      latest[taskId] = completed
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

  // Combine persisted scheduled_slots and in-memory planned slots as day keys per task.
  const scheduledDaysByTask = {}
  tasks.forEach((task) => {
    const dayKeys = new Set()
    ;(task.scheduledSlots || []).forEach((slot) => {
      const key = slotDayKey(slot)
      if (key) dayKeys.add(key)
    })
    scheduledDaysByTask[task.id] = dayKeys
  })

  Object.entries(plannedSlots || {}).forEach(([date, items]) => {
    const key = dayjs(date).format('YYYY-MM-DD')
    ;(items || []).forEach((taskId) => {
      if (!scheduledDaysByTask[taskId]) {
        scheduledDaysByTask[taskId] = new Set()
      }
      scheduledDaysByTask[taskId].add(key)
    })
  })

  return days.map((day) => {
    const dayIso = iso(day)
    const recommended = []

    tasks.forEach((task) => {
      const historyLastDone = lastCompleted[task.id]
      const metaLastDone = task.lastCompletedAt ? dayjs(task.lastCompletedAt) : null
      const lastDone = historyLastDone || (metaLastDone?.isValid() ? metaLastDone : null)

      const scheduledDayKeys = Array.from(scheduledDaysByTask[task.id] || [])
      const scheduledDays = scheduledDayKeys.map((key) => dayjs(key)).filter((value) => value.isValid())
      scheduledDays.sort((a, b) => (a.isBefore(b, 'day') ? -1 : 1))

      const scheduledDaysThisWeek = scheduledDays.filter((scheduledDay) => !scheduledDay.isBefore(start, 'day') && !scheduledDay.isAfter(end, 'day'))

      // If this task is already scheduled for a future day, do not recommend it earlier.
      const hasUpcomingScheduledDay = scheduledDaysThisWeek.some((scheduledDay) => scheduledDay.isAfter(day, 'day'))
      if (hasUpcomingScheduledDay) return

      const scheduledToday = scheduledDayKeys.some((scheduledDayKey) => scheduledDayKey === dayIso)
      if (scheduledToday) return

      let latestScheduledBefore = null
      scheduledDaysThisWeek.forEach((scheduledDay) => {
        if (!scheduledDay.isBefore(day, 'day')) return
        if (!latestScheduledBefore || scheduledDay.isAfter(latestScheduledBefore, 'day')) {
          latestScheduledBefore = scheduledDay
        }
      })

      if (latestScheduledBefore) {
        const completedAfterScheduled = !!lastDone && !lastDone.isBefore(latestScheduledBefore, 'day')
        if (!completedAfterScheduled) {
          recommended.push({
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            duration: task.duration,
            status: 'late',
            windowStart: iso(latestScheduledBefore),
            windowEnd: iso(latestScheduledBefore),
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

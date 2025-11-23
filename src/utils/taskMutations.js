import { nanoid } from 'nanoid'
import dayjs from './dates'

const iso = (value) => dayjs(value).format('YYYY-MM-DD')

const nextWeeklyFrom = (task, fromDate) => {
  const days = task.recurrence.days ?? []
  if (!days.length) return null
  for (let offset = 1; offset <= 21; offset += 1) {
    const candidate = dayjs(fromDate).add(offset, 'day')
    if (days.includes(candidate.day())) return iso(candidate)
  }
  return iso(dayjs(fromDate).add(7, 'day'))
}

export const completeTask = (task, date, note) => {
  const done = dayjs(date)
  let nextDue = task.nextDueDate
  if (task.recurrence?.mode === 'gap') {
    const gap = task.recurrence.gapDays ?? 1
    nextDue = iso(done.add(gap, 'day'))
  } else if (task.recurrence?.mode === 'weekly') {
    nextDue = nextWeeklyFrom(task, done)
  } else if (task.recurrence?.mode === 'single') {
    nextDue = null
  }

  const notesLog = task.notesLog ?? []
  const noteEntry = note
    ? {
        id: nanoid(),
        body: note,
        recordedAt: done.toISOString(),
      }
    : null

  return {
    ...task,
    lastCompletedAt: done.toISOString(),
    nextDueDate: nextDue,
    notesLog: noteEntry ? [noteEntry, ...notesLog] : notesLog,
  }
}

export const skipTaskOccurrence = (task, date) => {
  const scheduledDate = dayjs(date)
  if (task.recurrence?.mode === 'single') {
    return { ...task, nextDueDate: iso(scheduledDate.add(1, 'day')) }
  }
  if (task.recurrence?.mode === 'gap') {
    return { ...task, nextDueDate: iso(scheduledDate.add(1, 'day')) }
  }
  if (task.recurrence?.mode === 'weekly') {
    return { ...task, nextDueDate: nextWeeklyFrom(task, scheduledDate) }
  }
  if (task.recurrence?.mode === 'floating') {
    return { ...task, deferUntil: iso(scheduledDate.add(1, 'day')) }
  }
  return task
}

export const updateTaskTemplate = (task, patch) => ({ ...task, ...patch })

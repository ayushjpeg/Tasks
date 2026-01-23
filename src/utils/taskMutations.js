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
  // Do not auto-reschedule; AI will decide future placements. Clear current due date so it disappears from UI.
  const nextDue = null

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
  // Do not auto-reschedule; clear due date so AI can re-place later.
  return { ...task, nextDueDate: null, deferUntil: null }
}

export const updateTaskTemplate = (task, patch) => ({ ...task, ...patch })

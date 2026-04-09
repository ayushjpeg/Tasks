import { nanoid } from 'nanoid'
import dayjs from './dates'

const iso = (value) => dayjs(value).format('YYYY-MM-DD')

const sameSlot = (a, b) => {
  if (!a || !b) return false
  if (a === b) return true
  const da = dayjs(a)
  const db = dayjs(b)
  if (!da.isValid() || !db.isValid()) return false
  return da.isSame(db)
}

const nextWeeklyFrom = (task, fromDate) => {
  const days = task.recurrence.days ?? []
  if (!days.length) return null
  for (let offset = 1; offset <= 21; offset += 1) {
    const candidate = dayjs(fromDate).add(offset, 'day')
    if (days.includes(candidate.day())) return iso(candidate)
  }
  return iso(dayjs(fromDate).add(7, 'day'))
}

export const completeTask = (task, date, note, scheduledSlot = null) => {
  if ((task.category || 'occasional') !== 'occasional') {
    const done = dayjs(date)
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
      notesLog: noteEntry ? [noteEntry, ...notesLog] : notesLog,
    }
  }

  const done = dayjs(date)
  const slots = task.scheduledSlots || []
  const remainingSlots = scheduledSlot
    ? slots.filter((slot) => !sameSlot(slot, scheduledSlot))
    : slots.filter((slot) => !dayjs(slot).isSame(done, 'day'))
  const normalizedSlots = [...remainingSlots].sort((a, b) => (dayjs(a).isBefore(dayjs(b)) ? -1 : 1))
  const nextDue = normalizedSlots.length ? dayjs(normalizedSlots[0]).format('YYYY-MM-DD') : null

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
    scheduledSlots: normalizedSlots,
    notesLog: noteEntry ? [noteEntry, ...notesLog] : notesLog,
  }
}

export const skipTaskOccurrence = (task, date, scheduledSlot = null) => {
  if ((task.category || 'occasional') !== 'occasional') {
    return {
      ...task,
      deferUntil: null,
    }
  }

  const scheduledDate = dayjs(date)
  const slots = task.scheduledSlots || []
  const remainingSlots = scheduledSlot
    ? slots.filter((slot) => !sameSlot(slot, scheduledSlot))
    : slots.filter((slot) => !dayjs(slot).isSame(scheduledDate, 'day'))
  const normalizedSlots = [...remainingSlots].sort((a, b) => (dayjs(a).isBefore(dayjs(b)) ? -1 : 1))
  return {
    ...task,
    nextDueDate: normalizedSlots.length ? dayjs(normalizedSlots[0]).format('YYYY-MM-DD') : null,
    scheduledSlots: normalizedSlots,
    deferUntil: null,
  }
}

export const updateTaskTemplate = (task, patch) => ({ ...task, ...patch })

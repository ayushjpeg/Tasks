import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import dayjs from '../utils/dates'

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const defaultTask = {
  id: '',
  title: '',
  description: '',
  duration: 30,
  priority: 'medium',
  window: 'any',
  notesEnabled: true,
  autoSplit: true,
  maxChunkMinutes: 60,
  recurrence: { mode: 'gap', gapDays: 2 },
  nextDueDate: dayjs().format('YYYY-MM-DD'),
}

const TaskModal = ({ open, initialTask, onSave, onClose }) => {
  const [form, setForm] = useState(defaultTask)

  useEffect(() => {
    if (open) {
      setForm(initialTask ? { ...initialTask } : defaultTask)
    }
  }, [open, initialTask])

  if (!open) return null

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const updateRecurrence = (patch) => update({ recurrence: { ...form.recurrence, ...patch } })

  const toggleWeekday = (index) => {
    const current = new Set(form.recurrence.days ?? [])
    if (current.has(index)) current.delete(index)
    else current.add(index)
    updateRecurrence({ days: Array.from(current).sort((a, b) => a - b) })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const numericDuration = Number(form.duration) || 15
    const payload = {
      ...form,
      id: form.id || nanoid(),
      duration: numericDuration,
      nextDueDate: form.recurrence?.mode === 'floating' ? null : form.nextDueDate || dayjs().format('YYYY-MM-DD'),
    }
    if (payload.recurrence?.mode === 'floating') {
      payload.remainingDuration = form.remainingDuration ?? numericDuration
      payload.deferUntil = form.deferUntil ?? null
    } else {
      delete payload.remainingDuration
      delete payload.deferUntil
    }
    onSave(payload)
  }

  return (
    <div className="modal">
      <div className="modal__scrim" onClick={onClose} />
      <form className="modal__panel" onSubmit={handleSubmit}>
        <header>
          <h2>{form.id ? 'Edit task' : 'Add task'}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <label>
          Title
          <input value={form.title} onChange={(event) => update({ title: event.target.value })} required />
        </label>
        <label>
          Description
          <textarea value={form.description} onChange={(event) => update({ description: event.target.value })} rows={3} />
        </label>
        <label>
          Duration (minutes)
          <input type="number" min="5" max="240" value={form.duration} onChange={(event) => update({ duration: event.target.value })} />
        </label>
        {form.recurrence?.mode !== 'floating' && (
          <label>
            Next due date
            <input type="date" value={form.nextDueDate} onChange={(event) => update({ nextDueDate: event.target.value })} />
          </label>
        )}
        <label>
          Priority
          <select value={form.priority} onChange={(event) => update({ priority: event.target.value })}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          Preferred window
          <select value={form.window} onChange={(event) => update({ window: event.target.value })}>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="any">Any</option>
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={form.notesEnabled} onChange={(event) => update({ notesEnabled: event.target.checked })} />
          Enable completion notes
        </label>
        <label>
          Recurrence mode
          <select value={form.recurrence?.mode ?? 'gap'} onChange={(event) => updateRecurrence({ mode: event.target.value })}>
            <option value="gap">Every X days</option>
            <option value="weekly">Weekly</option>
            <option value="single">Single date</option>
            <option value="floating">Floating (auto schedule)</option>
          </select>
        </label>
        {form.recurrence?.mode === 'gap' && (
          <label>
            Days between
            <input
              type="number"
              min="1"
              max="30"
              value={form.recurrence.gapDays ?? 1}
              onChange={(event) => updateRecurrence({ gapDays: Number(event.target.value) || 1 })}
            />
          </label>
        )}
        {form.recurrence?.mode === 'weekly' && (
          <div className="field-group">
            <span>Repeat on</span>
            <div className="weekday-group">
              {weekDays.map((day, index) => (
                <button
                  type="button"
                  key={day}
                  className={form.recurrence.days?.includes(index) ? 'chip chip--active' : 'chip'}
                  onClick={() => toggleWeekday(index)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}
        {form.recurrence?.mode === 'single' && (
          <label>
            Occurs on
            <input type="date" value={form.recurrence.date ?? form.nextDueDate} onChange={(event) => updateRecurrence({ date: event.target.value })} />
          </label>
        )}
        {form.recurrence?.mode === 'floating' && (
          <>
            <p className="muted">We will place this task automatically when there is space. If it is hefty, enable auto split.</p>
            <label className="toggle">
              <input type="checkbox" checked={form.autoSplit ?? true} onChange={(event) => update({ autoSplit: event.target.checked })} />
              Allow splitting across days
            </label>
            {form.autoSplit && (
              <label>
                Max minutes per chunk
                <input
                  type="number"
                  min="20"
                  max="180"
                  value={form.maxChunkMinutes ?? 60}
                  onChange={(event) => update({ maxChunkMinutes: Number(event.target.value) || 60 })}
                />
              </label>
            )}
          </>
        )}
        <footer>
          <button type="submit" className="btn-primary">
            Save task
          </button>
        </footer>
      </form>
    </div>
  )
}

export default TaskModal

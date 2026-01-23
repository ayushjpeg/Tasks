import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import dayjs from '../utils/dates'

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
  recurrence: { mode: 'repeat', start_after_days: 0, end_before_days: 7 },
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

  const handleSubmit = (event) => {
    event.preventDefault()
    const numericDuration = Number(form.duration) || 15
    const payload = {
      ...form,
      id: form.id || nanoid(),
      duration: numericDuration,
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
        <fieldset className="field-group">
          <legend>Recurrence</legend>
          <div className="pill-row">
            <label className={form.recurrence?.mode === 'repeat' ? 'chip chip--active' : 'chip'}>
              <input
                type="radio"
                name="recurrence-mode"
                value="repeat"
                checked={form.recurrence?.mode === 'repeat'}
                onChange={() => updateRecurrence({ mode: 'repeat' })}
                style={{ display: 'none' }}
              />
              Repeat
            </label>
            <label className={form.recurrence?.mode === 'one_time' ? 'chip chip--active' : 'chip'}>
              <input
                type="radio"
                name="recurrence-mode"
                value="one_time"
                checked={form.recurrence?.mode === 'one_time'}
                onChange={() => updateRecurrence({ mode: 'one_time' })}
                style={{ display: 'none' }}
              />
              One time
            </label>
          </div>
          <label>
            Earliest in (days from today)
            <input
              type="number"
              min="0"
              value={form.recurrence?.start_after_days ?? 0}
              onChange={(event) => updateRecurrence({ start_after_days: Math.max(0, Number(event.target.value) || 0) })}
            />
          </label>
          <label>
            Latest by (days from today)
            <input
              type="number"
              min={form.recurrence?.start_after_days ?? 0}
              value={form.recurrence?.end_before_days ?? form.recurrence?.start_after_days ?? 0}
              onChange={(event) =>
                updateRecurrence({ end_before_days: Math.max(form.recurrence?.start_after_days ?? 0, Number(event.target.value) || 0) })
              }
            />
          </label>
        </fieldset>
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

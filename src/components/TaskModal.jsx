import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import dayjs from '../utils/dates'

const defaultTask = {
  id: '',
  category: 'occasional',
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
  assignedDates: [],
}

const TaskModal = ({ open, initialTask, onSave, onClose }) => {
  const [form, setForm] = useState(defaultTask)
  const [assignedDateInput, setAssignedDateInput] = useState(dayjs().format('YYYY-MM-DD'))

  useEffect(() => {
    if (open) {
      const nextForm = initialTask ? { ...defaultTask, ...initialTask, assignedDates: initialTask.assignedDates || [] } : defaultTask
      setForm(nextForm)
      setAssignedDateInput(nextForm.assignedDates?.[0] || dayjs().format('YYYY-MM-DD'))
    }
  }, [open, initialTask])

  if (!open) return null

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const updateRecurrence = (patch) => update({ recurrence: { ...form.recurrence, ...patch } })
  const addAssignedDate = () => {
    if (!assignedDateInput) return
    update({ assignedDates: [...new Set([...(form.assignedDates || []), assignedDateInput])].sort() })
  }
  const removeAssignedDate = (value) => update({ assignedDates: (form.assignedDates || []).filter((item) => item !== value) })

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
          Category
          <select value={form.category} onChange={(event) => update({ category: event.target.value })}>
            <option value="daily">Daily</option>
            <option value="occasional">Occasional</option>
            <option value="long_term">Long term</option>
          </select>
        </label>
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
        {form.category === 'occasional' && (
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
            <p className="muted">Only occasional tasks appear in the plan tab. Use this window as guidance for that weekly plan.</p>
          </fieldset>
        )}
        {form.category === 'daily' && <p className="muted">Daily tasks are placed automatically every day and never appear in the plan tab.</p>}
        {form.category === 'long_term' && (
          <fieldset className="field-group">
            <legend>Assigned days</legend>
            <div className="quick-actions">
              <input type="date" value={assignedDateInput} onChange={(event) => setAssignedDateInput(event.target.value)} />
              <button type="button" className="btn-secondary" onClick={addAssignedDate}>Add date</button>
            </div>
            <div className="pill-row">
              {(form.assignedDates || []).map((value) => (
                <button key={value} type="button" className="chip chip--active" onClick={() => removeAssignedDate(value)}>
                  {value} ×
                </button>
              ))}
            </div>
            <p className="muted">Long-term tasks appear directly on these selected dates with progress / didn&apos;t progress actions.</p>
          </fieldset>
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

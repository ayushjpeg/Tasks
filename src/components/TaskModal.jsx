import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import dayjs from '../utils/dates'

const weekdayOptions = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

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
  assignedWeekdays: [],
  triggerTaskId: null,
  triggerAfterDays: 0,
}

const TaskModal = ({ open, initialTask, availableTasks = [], onSave, onClose }) => {
  const [form, setForm] = useState(defaultTask)

  useEffect(() => {
    if (open) {
      const nextForm = initialTask ? { ...defaultTask, ...initialTask, assignedWeekdays: initialTask.assignedWeekdays || [] } : defaultTask
      setForm(nextForm)
    }
  }, [open, initialTask])

  if (!open) return null

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const updateRecurrence = (patch) => update({ recurrence: { ...form.recurrence, ...patch } })
  const dependencyOptions = availableTasks.filter((task) => task.id && task.id !== form.id)

  const updateCategory = (category) => {
    const patch = { category }
    if (category !== 'occasional') {
      patch.recurrence = defaultTask.recurrence
      patch.triggerTaskId = null
      patch.triggerAfterDays = 0
    }
    if (category !== 'long_term_task' && category !== 'long_term_goal') {
      patch.assignedWeekdays = []
    }
    update(patch)
  }

  const toggleWeekday = (value) => {
    const set = new Set(form.assignedWeekdays || [])
    if (set.has(value)) set.delete(value)
    else set.add(value)
    update({ assignedWeekdays: [...set].sort((a, b) => a - b) })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const numericDuration = Number(form.duration) || 15
    if (form.category === 'occasional' && form.recurrence?.mode === 'after_completion' && !form.triggerTaskId) {
      window.alert('Choose the task that should trigger this task.')
      return
    }
    const payload = {
      ...form,
      id: form.id || nanoid(),
      duration: numericDuration,
      triggerAfterDays: Math.max(0, Number(form.triggerAfterDays) || 0),
    }
    if (payload.category === 'occasional' && payload.recurrence?.mode === 'after_completion') {
      payload.scheduledSlots = []
      payload.nextDueDate = null
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
          <select value={form.category} onChange={(event) => updateCategory(event.target.value)}>
            <option value="daily">Daily</option>
            <option value="occasional">Occasional</option>
            <option value="long_term_task">Long-term task</option>
            <option value="long_term_goal">Long-term goal</option>
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
              <label className={form.recurrence?.mode === 'after_completion' ? 'chip chip--active' : 'chip'}>
                <input
                  type="radio"
                  name="recurrence-mode"
                  value="after_completion"
                  checked={form.recurrence?.mode === 'after_completion'}
                  onChange={() => updateRecurrence({ mode: 'after_completion' })}
                  style={{ display: 'none' }}
                />
                After task completion
              </label>
            </div>
            {form.recurrence?.mode === 'after_completion' ? (
              <>
                <label>
                  Trigger task
                  <select value={form.triggerTaskId || ''} onChange={(event) => update({ triggerTaskId: event.target.value || null })}>
                    <option value="">Choose a task</option>
                    {dependencyOptions.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Days after trigger completion
                  <input
                    type="number"
                    min="0"
                    value={form.triggerAfterDays ?? 0}
                    onChange={(event) => update({ triggerAfterDays: Math.max(0, Number(event.target.value) || 0) })}
                  />
                </label>
                <p className="muted">This task will appear automatically in Daily after the selected task is completed and the delay has passed.</p>
              </>
            ) : (
              <>
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
              </>
            )}
          </fieldset>
        )}
        {form.category === 'daily' && <p className="muted">Daily tasks are placed automatically every day and never appear in the plan tab.</p>}
        {(form.category === 'long_term_task' || form.category === 'long_term_goal') && (
          <fieldset className="field-group">
            <legend>Assigned weekdays</legend>
            <div className="pill-row">
              {weekdayOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={(form.assignedWeekdays || []).includes(option.value) ? 'chip chip--active' : 'chip'}
                  onClick={() => toggleWeekday(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="muted">
              {form.category === 'long_term_goal'
                ? 'Long-term goals appear every selected weekday with progress / didn\'t progress actions.'
                : 'Long-term tasks appear every selected weekday and can be marked completed.'}
            </p>
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

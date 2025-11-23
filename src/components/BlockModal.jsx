import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'

const defaultBlock = {
  id: null,
  label: '',
  date: '',
  start: '10:00',
  end: '12:00',
  color: '#6c63ff',
}

const BlockModal = ({ open, onClose, onSave }) => {
  const [form, setForm] = useState(defaultBlock)

  useEffect(() => {
    if (open) setForm(defaultBlock)
  }, [open])

  if (!open) return null

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({ ...form, id: form.id ?? nanoid() })
  }

  return (
    <div className="modal">
      <div className="modal__scrim" onClick={onClose} />
      <form className="modal__panel" onSubmit={handleSubmit}>
        <header>
          <h2>Reserve time</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <label>
          Label
          <input value={form.label} onChange={(event) => update({ label: event.target.value })} required />
        </label>
        <label>
          Date
          <input type="date" value={form.date} onChange={(event) => update({ date: event.target.value })} required />
        </label>
        <label>
          Start time
          <input type="time" value={form.start} onChange={(event) => update({ start: event.target.value })} />
        </label>
        <label>
          End time
          <input type="time" value={form.end} onChange={(event) => update({ end: event.target.value })} />
        </label>
        <label>
          Accent color
          <input type="color" value={form.color} onChange={(event) => update({ color: event.target.value })} />
        </label>
        <footer>
          <button type="submit" className="btn-primary">
            Save block
          </button>
        </footer>
      </form>
    </div>
  )
}

export default BlockModal

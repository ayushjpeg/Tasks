import dayjs from '../utils/dates'
import { buildRecommendations } from '../utils/recommendations'

const statusColor = (status) => (status === 'late' ? '#ff9f1c' : '#7fdcff')

const PlanBoard = ({ tasks, history, weekStart, planned, onAdd, onRemove, onMove, onWeekChange, onClear, onDelete, planStatus }) => {
  const weekLabel = `${dayjs(weekStart).format('MMM D')} – ${dayjs(weekStart).add(6, 'day').format('MMM D')}`
  const recommendations = buildRecommendations({ tasks, history, weekStart, plannedSlots: planned })

  const plannedIds = new Set(Object.values(planned || {}).flat())

  const orderedTasksForDay = (date) => planned[date] || []

  const handleAdd = (taskId, date) => {
    if (!taskId) return
    onAdd(taskId, date)
  }

  return (
    <section className="panel">
      <header className="panel__header" style={{ alignItems: 'center' }}>
        <div>
          <p className="eyebrow">Plan week</p>
          <h2>{weekLabel}</h2>
          {planStatus && <p className="muted" style={{ marginTop: '4px' }}>{planStatus}</p>}
        </div>
        <div className="quick-actions" style={{ gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => onWeekChange(dayjs(weekStart).subtract(7, 'day'))}>
            ◀ Previous
          </button>
          <button className="btn-secondary" onClick={() => onWeekChange(dayjs(weekStart).add(7, 'day'))}>
            Next ▶
          </button>
          <button className="btn-ghost" onClick={() => onWeekChange(dayjs().startOf('week'))}>
            This week
          </button>
          <button className="btn-secondary" onClick={onClear}>
            Clear
          </button>
          <button className="btn-danger" onClick={onDelete}>
            Delete week plan
          </button>
        </div>
      </header>

      <div className="plan-grid">
        {recommendations.map((day) => {
          const visibleRecommended = day.recommended.filter((rec) => !plannedIds.has(rec.taskId))

          return <article key={day.date} className="plan-column">
            <header className="plan-column__header">
              <div>
                <p className="eyebrow">{day.label}</p>
                <h3>{day.date}</h3>
              </div>
            </header>

            <div className="plan-section">
              <p className="muted">Recommended</p>
              {!visibleRecommended.length && <p className="muted">Nothing recommended today.</p>}
              <div className="plan-list">
                {visibleRecommended.map((rec) => (
                  <div key={`${rec.taskId}-${rec.status}`} className="plan-item" style={{ borderLeft: `4px solid ${statusColor(rec.status)}` }}>
                    <div>
                      <strong>{rec.title}</strong>
                      <p className="muted">{rec.duration} min • window {rec.windowStart} → {rec.windowEnd}</p>
                      {rec.status === 'late' && <span className="pill pill--alert">Outside window</span>}
                    </div>
                    <button className="btn-secondary" onClick={() => handleAdd(rec.taskId, day.date)}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="plan-section">
              <p className="muted">Planned order</p>
              {!orderedTasksForDay(day.date).length && <p className="muted">No tasks yet.</p>}
              <div className="plan-list">
                {orderedTasksForDay(day.date).map((taskId, idx) => {
                  const task = tasks.find((t) => t.id === taskId)
                  if (!task) return null
                  return (
                    <div key={`${taskId}-${idx}`} className="plan-item">
                      <div>
                        <strong>
                          {idx + 1}. {task.title}
                        </strong>
                        <p className="muted">{task.duration} min • {task.priority} priority</p>
                      </div>
                      <div className="plan-actions">
                        <button className="btn-ghost" onClick={() => onMove(day.date, idx, -1)} disabled={idx === 0}>
                          ↑
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => onMove(day.date, idx, 1)}
                          disabled={idx === orderedTasksForDay(day.date).length - 1}
                        >
                          ↓
                        </button>
                        <button className="btn-secondary" onClick={() => onRemove(day.date, idx)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="plan-section">
              <label className="muted">Add any task</label>
              <select onChange={(e) => handleAdd(e.target.value, day.date)} defaultValue="">
                <option value="" disabled>
                  Choose task
                </option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id} disabled={plannedIds.has(task.id)}>
                    {task.title} ({task.duration} min){plannedIds.has(task.id) ? ' • already planned' : ''}
                  </option>
                ))}
              </select>
            </div>
          </article>
        })}
      </div>
    </section>
  )
}

export default PlanBoard

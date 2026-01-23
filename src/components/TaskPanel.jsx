import dayjs from '../utils/dates'

const formatRecurrence = (task) => {
  const { recurrence } = task
  if (!recurrence) return 'One-off'
  const start = recurrence.start_after_days ?? 0
  const end = recurrence.end_before_days ?? start
  if (recurrence.mode === 'repeat') return `Repeat window: day ${start} to day ${end}`
  if (recurrence.mode === 'one_time') return `One time between day ${start} and day ${end}`
  return 'Custom'
}

const TaskPanel = ({ tasks, onEdit, onDelete }) => (
  <div className="task-panel">
    <header>
      <div>
        <h2>Task templates</h2>
        <p>Create recurring chores, contest reservations, or floating work.</p>
      </div>
      <button className="btn-primary" onClick={() => onEdit(null)}>
        + Add task
      </button>
    </header>
    <div className="task-panel__list">
      {tasks.map((task) => (
        <article key={task.id} className="task-card">
          <div>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
          </div>
          <ul>
            <li>
              <span>Next</span>
              <strong>{task.nextDueDate ? dayjs(task.nextDueDate).format('ddd, MMM D') : 'N/A'}</strong>
            </li>
            <li>
              <span>Duration</span>
              <strong>{task.duration} min</strong>
            </li>
            <li>
              <span>Recurrence</span>
              <strong>{formatRecurrence(task)}</strong>
            </li>
            <li>
              <span>Window</span>
              <strong>{task.window ?? 'any'}</strong>
            </li>
          </ul>
          <div className="task-card__actions">
            <button className="btn-secondary" onClick={() => onEdit(task)}>
              Edit
            </button>
            <button className="btn-danger" onClick={() => onDelete(task.id)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  </div>
)

export default TaskPanel

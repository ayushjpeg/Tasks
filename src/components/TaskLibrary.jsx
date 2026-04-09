import dayjs from '../utils/dates'

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const describeAssignedWeekdays = (task) => {
  const values = (task.assignedWeekdays || []).map((value) => weekdayLabels[value]).filter(Boolean)
  return values.length ? values.join(', ') : 'No weekdays set'
}

const describeRecurrence = (task) => {
  if (task.category === 'daily') return 'Daily'
  if (task.category === 'long_term_task') return `Long-term task • ${describeAssignedWeekdays(task)}`
  if (task.category === 'long_term_goal') return `Long-term goal • ${describeAssignedWeekdays(task)}`
  const mode = task.recurrence?.mode
  if (mode === 'after_completion') {
    return `After completion • ${task.triggerAfterDays ?? 0} day delay`
  }
  const start = task.recurrence?.start_after_days ?? 0
  const end = task.recurrence?.end_before_days ?? start
  if (mode === 'repeat') return `Repeat window: day ${start} to day ${end}`
  if (mode === 'one_time') return `One time between day ${start} and day ${end}`
  return 'One-off'
}

const categoryLabel = (category) => {
  if (category === 'long_term_task') return 'Long-term task'
  if (category === 'long_term_goal') return 'Long-term goal'
  if (category === 'daily') return 'Daily'
  return 'Occasional'
}

const dependencyLabel = (task, tasks) => {
  if (task.recurrence?.mode !== 'after_completion' || !task.triggerTaskId) return null
  const trigger = tasks.find((candidate) => candidate.id === task.triggerTaskId)
  if (!trigger) return 'Waiting for selected task'
  return `${trigger.title} + ${task.triggerAfterDays ?? 0} day${(task.triggerAfterDays ?? 0) === 1 ? '' : 's'}`
}

const TaskLibrary = ({ tasks, onCreate, onEdit, onDelete }) => (
  <section className="panel">
    <header className="panel__header">
      <div>
        <p className="eyebrow">Task templates</p>
        <h2>Automate your repeats</h2>
      </div>
      <button className="btn-primary" onClick={onCreate}>
        + Add task
      </button>
    </header>
    <div className="task-library">
      {tasks.length === 0 && <p className="muted">No templates yet. Start with watering plants or gym reminders.</p>}
      {tasks.map((task) => (
        <article key={task.id} className="task-template">
          <div>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
          </div>
          <ul>
            <li>
              <span>Category</span>
              <strong>{categoryLabel(task.category || 'occasional')}</strong>
            </li>
            <li>
              <span>Next due</span>
              <strong>
                {task.category === 'daily'
                  ? 'Every day'
                  : task.category === 'long_term_task' || task.category === 'long_term_goal'
                  ? describeAssignedWeekdays(task)
                  : task.recurrence?.mode === 'after_completion'
                  ? dependencyLabel(task, tasks)
                  : task.nextDueDate
                  ? dayjs(task.nextDueDate).format('ddd, MMM D')
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Duration</span>
              <strong>{task.duration} min</strong>
            </li>
            <li>
              <span>Recurrence</span>
              <strong>{describeRecurrence(task)}</strong>
            </li>
            <li>
              <span>Priority</span>
              <strong>{task.priority}</strong>
            </li>
          </ul>
          <div className="task-template__actions">
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
  </section>
)

export default TaskLibrary

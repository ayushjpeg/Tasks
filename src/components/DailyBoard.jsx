const priorityAccent = {
  high: '#f8c47a',
  medium: '#7fdcff',
  low: '#b59dff',
}

const DailyBoard = ({ day, onComplete, onSnooze, onReschedule }) => {
  if (!day) {
    return (
      <section className="panel">
        <p>Select a day to load tasks.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="eyebrow">Daily focus</p>
          <h2>{day.label}</h2>
          <p className="muted">
            {day.tasks.length ? 'Work through these blocks whenever it fits your energy.' : 'This day is currently wide open.'}
          </p>
        </div>
        <div className="stat-pill">
          <strong>{day.totalMinutes}</strong>
          <span>mins planned</span>
        </div>
      </header>

      {!day.tasks.length && <p className="muted">No tasks due yet. Enjoy the buffer or add a template.</p>}

      <div className="task-list">
        {day.tasks.map((task) => {
          const isFloating = task.status === 'floating'
          return (
            <article
              key={task.id}
              className={`task-card ${task.status === 'overdue' ? 'task-card--overdue' : ''} ${isFloating ? 'task-card--floating' : ''}`}
            >
            <header>
              <div>
                <h3>{task.title}</h3>
                {task.description && <p>{task.description}</p>}
                {task.part && <p className="muted">{task.part}</p>}
              </div>
              <span className="duration">{task.duration} min</span>
            </header>
            <div className="pill-row">
              <span className="pill" style={{ background: priorityAccent[task.priority] ?? '#6c63ff' }}>
                {task.priorityLabel}
              </span>
              {task.window && <span className="pill pill--soft">Window: {task.window}</span>}
              {task.scheduledTime && <span className="pill pill--soft">Start {task.scheduledTime}</span>}
              {task.status === 'overdue' && <span className="pill pill--alert">Needs attention</span>}
              {isFloating && <span className="pill pill--soft">Floating chunk</span>}
            </div>
            <footer>
              <button className="btn-primary" onClick={() => onComplete(task)}>
                Mark done
              </button>
              <button className="btn-secondary" onClick={() => onSnooze(task)}>
                {isFloating ? 'Pause a day' : 'Move to tomorrow'}
              </button>
              <button className="btn-ghost" onClick={() => onReschedule(task)}>
                Pick another day
              </button>
            </footer>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default DailyBoard

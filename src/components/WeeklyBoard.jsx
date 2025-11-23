const WeeklyBoard = ({ days, onSelectDay, activeDate }) => (
  <section className="panel">
    <header className="panel__header">
      <div>
        <p className="eyebrow">Weekly view</p>
        <h2>Where the minutes land</h2>
        <p className="muted">Tap a day to drill down or keep an eye on total effort.</p>
      </div>
    </header>
    <div className="week-grid">
      {days.map((day) => (
        <button
          key={day.date}
          className={day.date === activeDate ? 'day-card day-card--active' : 'day-card'}
          onClick={() => onSelectDay(day.date)}
        >
          <div className="day-card__header">
            <strong>{day.shortLabel}</strong>
            <span>{day.totalMinutes} min</span>
          </div>
          <ul>
            {day.tasks.slice(0, 3).map((task) => (
              <li key={task.id}>
                <span>{task.title}</span>
                <span>{task.duration}m</span>
              </li>
            ))}
            {day.tasks.length === 0 && <li className="muted">No tasks</li>}
            {day.tasks.length > 3 && <li className="muted">+{day.tasks.length - 3} more</li>}
          </ul>
        </button>
      ))}
    </div>
  </section>
)

export default WeeklyBoard

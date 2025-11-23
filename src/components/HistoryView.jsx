import dayjs from '../utils/dates'

const groupHistory = (entries) => {
  return entries.reduce((acc, entry) => {
    const date = dayjs(entry.completedAt).format('YYYY-MM-DD')
    if (!acc[date]) acc[date] = { date, totalMinutes: 0, items: [] }
    acc[date].totalMinutes += entry.duration
    acc[date].items.push(entry)
    return acc
  }, {})
}

const HistoryView = ({ history }) => {
  const grouped = groupHistory(history)
  const ordered = Object.values(grouped).sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="eyebrow">History</p>
          <h2>Energy audit</h2>
          <p className="muted">Completed tasks with total minutes per day.</p>
        </div>
      </header>

      {ordered.length === 0 && <p className="muted">No completions yet. Start logging to build streaks.</p>}

      <div className="history-list">
        {ordered.map((day) => (
          <article key={day.date}>
            <header>
              <strong>{dayjs(day.date).format('dddd, MMM D')}</strong>
              <span>{day.totalMinutes} min</span>
            </header>
            <ul>
              {day.items.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <span>{entry.title}</span>
                    {entry.note && <p className="muted">{entry.note}</p>}
                  </div>
                  <span>{entry.duration} min</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

export default HistoryView

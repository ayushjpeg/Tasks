const reasonMap = {
  conflict: 'conflict with another block',
  'no-free-slot': 'no space in the selected week',
}

const UnscheduledList = ({ items }) => {
  if (!items.length) return null
  return (
    <div className="unscheduled">
      <h3>Unscheduled items</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.task.title}</strong> on {item.date} – {reasonMap[item.reason] ?? 'needs review'}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default UnscheduledList

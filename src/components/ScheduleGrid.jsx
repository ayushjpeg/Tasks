import { formatRange } from '../utils/time'

const blockColor = (block) => {
  if (block.kind === 'routine' || block.kind === 'manual') return block.color ?? '#2f3340'
  if (block.priority === 'high') return 'linear-gradient(120deg, #ff3d81, #ff9f1c)'
  if (block.priority === 'medium') return 'linear-gradient(120deg, #4facfe, #00f2fe)'
  return 'linear-gradient(120deg, #43cea2, #185a9d)'
}

const ScheduleGrid = ({ days, onCompleteTask, onSkipTask }) => (
  <div className="schedule-grid">
    {days.map((day) => (
      <section key={day.date} className="schedule-column">
        <header>
          <p>{day.label}</p>
          <span className={day.workMode === 'wfh' ? 'badge badge--wfh' : day.workMode === 'office' ? 'badge' : 'badge badge--off'}>
            {day.workMode.toUpperCase()}
          </span>
        </header>
        <div className="timeline">
          {day.blocks.map((block) => (
            <article key={block.id + block.start} className={`block block--${block.kind}`} style={{ background: blockColor(block) }}>
              <div className="block__times">{formatRange(block.start, block.end)}</div>
              <div className="block__title">{block.label}</div>
              {block.kind === 'task' && (
                <div className="block__actions">
                  <button className="btn-ghost" onClick={() => onCompleteTask(block)}>
                    Done
                  </button>
                  <button className="btn-ghost" onClick={() => onSkipTask(block)}>
                    Skip
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    ))}
  </div>
)

export default ScheduleGrid

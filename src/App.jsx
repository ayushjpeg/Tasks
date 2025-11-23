import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import dayjs from './utils/dates'
import { useLocalStorage } from './hooks/useLocalStorage'
import { defaultTasks } from './data/defaultTasks'
import { buildPlanner } from './utils/scheduler'
import { completeTask, skipTaskOccurrence } from './utils/taskMutations'
import DailyBoard from './components/DailyBoard'
import WeeklyBoard from './components/WeeklyBoard'
import TaskLibrary from './components/TaskLibrary'
import HistoryView from './components/HistoryView'
import TaskModal from './components/TaskModal'

const tabs = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'history', label: 'History' },
]

function App() {
  const [tasks, setTasks] = useLocalStorage('task-orchestrator-tasks', defaultTasks)
  const [history, setHistory] = useLocalStorage('task-orchestrator-history', [])
  const [activeDate, setActiveDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [view, setView] = useState('daily')
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)

  const weekStart = dayjs(activeDate).startOf('week')
  const weekKey = weekStart.format('YYYY-MM-DD')
  const planner = useMemo(() => buildPlanner({ tasks, startDate: weekStart, days: 7 }), [tasks, weekKey])
  const activeDay = planner.days.find((day) => day.date === activeDate) ?? planner.days[0]
  const todayIso = dayjs().format('YYYY-MM-DD')
  const todaySummary = planner.days.find((day) => day.date === todayIso)

  const openTaskModal = (task = null) => {
    setSelectedTask(task)
    setTaskModalOpen(true)
  }

  const closeTaskModal = () => {
    setTaskModalOpen(false)
    setSelectedTask(null)
  }

  const handleSaveTask = (task) => {
    setTasks((prev) => {
      const exists = prev.some((item) => item.id === task.id)
      if (exists) {
        return prev.map((item) => (item.id === task.id ? task : item))
      }
      return [task, ...prev]
    })
    closeTaskModal()
  }

  const handleDeleteTask = (taskId) => {
    if (!window.confirm('Delete this task template?')) return
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
  }

  const handleCompleteTask = (card, completionDate) => {
    const template = tasks.find((item) => item.id === card.taskId)
    if (!template) return
    const trimmedNote = undefined
    const chunkMinutes = card.chunkMinutes ?? card.duration ?? template.duration
    const completionStamp = dayjs(completionDate).toISOString()

    if (template.recurrence?.mode === 'floating') {
      const remaining = Math.max(0, (template.remainingDuration ?? template.duration) - chunkMinutes)
      const noteEntry = trimmedNote
        ? {
            id: nanoid(),
            body: trimmedNote,
            recordedAt: completionStamp,
          }
        : null

      setTasks((prev) => {
        const next = []
        prev.forEach((item) => {
          if (item.id !== template.id) {
            next.push(item)
            return
          }
          const withNotes = {
            ...item,
            notesLog: noteEntry ? [noteEntry, ...(item.notesLog ?? [])] : item.notesLog ?? [],
            lastCompletedAt: completionStamp,
          }
          if (remaining > 0) {
            next.push({ ...withNotes, remainingDuration: remaining })
          }
        })
        return next
      })
      setHistory((prev) => [
        {
          id: nanoid(),
          taskId: template.id,
          title: template.title,
          duration: chunkMinutes,
          completedAt: completionStamp,
          note: trimmedNote || '',
        },
        ...prev,
      ])
      return
    }

    const updated = completeTask(template, completionDate, trimmedNote || undefined)
    setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setHistory((prev) => [
      {
        id: nanoid(),
        taskId: updated.id,
        title: updated.title,
        duration: updated.duration,
        completedAt: completionStamp,
        note: trimmedNote || '',
      },
      ...prev,
    ])
  }

  const handleSnoozeTask = (card, referenceDate) => {
    const template = tasks.find((item) => item.id === card.taskId)
    if (!template) return
    if (template.recurrence?.mode === 'floating') {
      const deferDate = dayjs(referenceDate).add(1, 'day').format('YYYY-MM-DD')
      setTasks((prev) => prev.map((item) => (item.id === template.id ? { ...item, deferUntil: deferDate } : item)))
      return
    }
    const updated = skipTaskOccurrence(template, referenceDate)
    setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }

  const handleRescheduleTask = (card) => {
    const template = tasks.find((item) => item.id === card.taskId)
    if (!template) return
    const suggested = dayjs(card.dueDate ?? activeDate).add(1, 'day').format('YYYY-MM-DD')
    const nextDate = window.prompt('Move to which date? (YYYY-MM-DD)', suggested)
    if (!nextDate) return
    const candidate = dayjs(nextDate)
    if (!candidate.isValid()) {
      window.alert('Please enter a valid date in YYYY-MM-DD format.')
      return
    }
    if (template.recurrence?.mode === 'floating') {
      setTasks((prev) => prev.map((item) => (item.id === template.id ? { ...item, deferUntil: candidate.format('YYYY-MM-DD') } : item)))
    } else {
      setTasks((prev) => prev.map((item) => (item.id === template.id ? { ...item, nextDueDate: candidate.format('YYYY-MM-DD') } : item)))
    }
  }

  const renderView = () => {
    if (view === 'weekly') {
      return <WeeklyBoard days={planner.days} activeDate={activeDate} onSelectDay={setActiveDate} />
    }
    if (view === 'tasks') {
      return <TaskLibrary tasks={tasks} onCreate={() => openTaskModal(null)} onEdit={openTaskModal} onDelete={handleDeleteTask} />
    }
    if (view === 'history') {
      return <HistoryView history={history} />
    }
    return (
      <>
        <div className="date-switcher">
          <div className="date-switcher__nav">
            <button className="btn-secondary" onClick={() => setActiveDate(dayjs(activeDate).subtract(1, 'day').format('YYYY-MM-DD'))}>
              ◀
            </button>
            <button className="btn-secondary" onClick={() => setActiveDate(dayjs(activeDate).add(1, 'day').format('YYYY-MM-DD'))}>
              ▶
            </button>
          </div>
          <div className="date-switcher__info">
            <strong>{dayjs(activeDate).format('dddd, MMM D')}</strong>
            <p>
              {activeDay?.tasks.length ?? 0} tasks • {activeDay?.totalMinutes ?? 0} min
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setActiveDate(todayIso)}>
            Today
          </button>
        </div>
        <DailyBoard
          day={activeDay}
          onComplete={(task) => handleCompleteTask(task, activeDay?.date ?? activeDate)}
          onSnooze={(task) => handleSnoozeTask(task, activeDay?.date ?? activeDate)}
          onReschedule={handleRescheduleTask}
        />
      </>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Task Orchestrator</h1>
        </div>
        <div className="quick-stats">
          <article>
            <span>Total templates</span>
            <strong>{tasks.length}</strong>
          </article>
          <article>
            <span>Today&apos;s load</span>
            <strong>{todaySummary?.totalMinutes ?? 0} min</strong>
          </article>
          <article>
            <span>Logged runs</span>
            <strong>{history.length}</strong>
          </article>
        </div>
      </header>

      <nav className="view-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={view === tab.id ? 'tab tab--active' : 'tab'} onClick={() => setView(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {renderView()}

      <TaskModal open={taskModalOpen} initialTask={selectedTask} onClose={closeTaskModal} onSave={handleSaveTask} />
    </div>
  )
}

export default App

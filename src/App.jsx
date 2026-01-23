import { useEffect, useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import dayjs from './utils/dates'
import { buildPlanner } from './utils/scheduler'
import { completeTask, skipTaskOccurrence } from './utils/taskMutations'
import DailyBoard from './components/DailyBoard'
import WeeklyBoard from './components/WeeklyBoard'
import TaskLibrary from './components/TaskLibrary'
import HistoryView from './components/HistoryView'
import TaskModal from './components/TaskModal'
import {
  createTask as apiCreateTask,
  deleteTask as apiDeleteTask,
  fetchTaskHistory,
  fetchTasks,
  logTaskHistory,
  scheduleCommit,
  schedulePreview,
  updateTask as apiUpdateTask,
} from './api/tasksApi'
import { generatePlan } from './api/aiApi'

const tabs = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'history', label: 'History' },
]

function App() {
  const [tasks, setTasks] = useState([])
  const [history, setHistory] = useState([])
  const [activeDate, setActiveDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [view, setView] = useState('daily')
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [syncMessage, setSyncMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [aiPlan, setAiPlan] = useState('')

  useEffect(() => {
    let canceled = false
    const load = async () => {
      setIsLoading(true)
      setLoadError('')
      try {
        const [taskData, historyData] = await Promise.all([fetchTasks(), fetchTaskHistory()])
        if (!canceled) {
          setTasks(taskData)
          setHistory(historyData)
        }
      } catch (error) {
        console.error('Failed to load data', error)
        if (!canceled) {
          setLoadError('Unable to load data from the backend. Retry or check your network connection.')
        }
      } finally {
        if (!canceled) {
          setIsLoading(false)
        }
      }
    }
    load()
    return () => {
      canceled = true
    }
  }, [])

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

  const handleSaveTask = async (task) => {
    try {
      setSyncMessage(task.id ? 'Updating task…' : 'Creating task…')
      let saved
      if (task.id && tasks.some((t) => t.id === task.id)) {
        saved = await apiUpdateTask(task)
      } else {
        // Remove any local id before sending to backend
        const { id, ...rest } = task
        saved = await apiCreateTask(rest)
      }
      setTasks((prev) => {
        const exists = prev.some((item) => item.id === saved.id)
        if (exists) {
          return prev.map((item) => (item.id === saved.id ? saved : item))
        }
        return [saved, ...prev]
      })
      closeTaskModal()
    } catch (error) {
      console.error('Failed to save task', error)
      window.alert('Unable to save the task. Please try again.')
    } finally {
      setSyncMessage('')
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task template?')) return
    try {
      setSyncMessage('Deleting task…')
      await apiDeleteTask(taskId)
      setTasks((prev) => prev.filter((task) => task.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task', error)
      window.alert('Unable to delete that task right now.')
    } finally {
      setSyncMessage('')
    }
  }

  const handleCompleteTask = async (card, completionDate) => {
    const template = tasks.find((item) => item.id === card.taskId)
    if (!template) return
    const trimmedNote = ''
    const chunkMinutes = card.chunkMinutes ?? card.duration ?? template.duration
    const completionStamp = dayjs(completionDate).toISOString()

    try {
      setSyncMessage('Logging completion…')
      const updated = completeTask(template, completionDate, trimmedNote || undefined)
      const saved = await apiUpdateTask(updated)
      setTasks((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
      const historyEntry = await logTaskHistory(
        template.id,
        {
          completedAt: completionStamp,
          durationMinutes: chunkMinutes,
          note: trimmedNote,
        },
        template.title,
      )
      setHistory((prev) => [historyEntry, ...prev])
    } catch (error) {
      console.error('Failed to log completion', error)
      window.alert('Unable to log that completion. Please retry in a moment.')
    } finally {
      setSyncMessage('')
    }
  }

  const handleSnoozeTask = async (card, referenceDate) => {
    const template = tasks.find((item) => item.id === card.taskId)
    if (!template) return
    const updatedTemplate = skipTaskOccurrence(template, referenceDate)

    try {
      setSyncMessage('Updating task…')
      const saved = await apiUpdateTask(updatedTemplate)
      setTasks((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
    } catch (error) {
      console.error('Failed to snooze task', error)
      window.alert('Unable to move that task. Try again later.')
    } finally {
      setSyncMessage('')
    }
  }

  const handleRescheduleTask = async (card) => {
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

    const formatted = candidate.format('YYYY-MM-DD')
    const updatedTemplate = { ...template, nextDueDate: formatted }

    try {
      setSyncMessage('Rescheduling task…')
      const saved = await apiUpdateTask(updatedTemplate)
      setTasks((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
    } catch (error) {
      console.error('Failed to reschedule task', error)
      window.alert('Unable to reschedule right now.')
    } finally {
      setSyncMessage('')
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

  const handlePlanWeek = async () => {
    try {
      setSyncMessage('Preparing AI plan…')
      const preview = await schedulePreview()
      setSyncMessage('Calling AI…')
      const aiResponse = await generatePlan({ prompt: preview.prompt })
      setAiPlan(aiResponse)
      setSyncMessage('Recording plan…')
      await scheduleCommit({
        weekStart: preview.week_start,
        weekEnd: preview.week_end,
        plan: preview.tasks,
        aiResponse,
      })
      window.alert('AI weekly plan ready. Check console for details.')
      console.info('AI plan prompt:', preview.prompt)
      console.info('AI plan response:', aiResponse)
    } catch (error) {
      console.error('Failed to plan week', error)
      window.alert('Unable to build AI plan right now.')
    } finally {
      setSyncMessage('')
    }
  }

  if (isLoading) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div>
            <h1>Task Orchestrator</h1>
            <p className="muted">Loading your templates…</p>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Task Orchestrator</h1>
          {loadError && <p className="muted">{loadError}</p>}
          {!loadError && syncMessage && <p className="muted">{syncMessage}</p>}
        </div>
        <div className="quick-actions">
          <button className="btn-primary" onClick={handlePlanWeek}>
            Plan week with AI
          </button>
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
      {aiPlan && (
        <section className="panel">
          <header className="panel__header">
            <div>
              <p className="eyebrow">AI Plan</p>
              <h2>Latest response</h2>
            </div>
          </header>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{aiPlan}</pre>
        </section>
      )}
    </div>
  )
}

export default App

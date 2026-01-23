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
  fetchPrompt,
  fetchTaskHistory,
  fetchTasks,
  logTaskHistory,
  savePrompt,
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
  const [promptDraft, setPromptDraft] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptLoading, setPromptLoading] = useState(false)

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
      const updated = completeTask(template, completionDate, trimmedNote || undefined, card.scheduledSlot)
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
    const updatedTemplate = skipTaskOccurrence(template, referenceDate, card.scheduledSlot)

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
    const existingSlots = template.scheduledSlots || []
    const remainingSlots = card.scheduledSlot
      ? existingSlots.filter((slot) => slot !== card.scheduledSlot)
      : existingSlots.filter((slot) => !dayjs(slot).isSame(card.dueDate, 'day'))

    const sourceSlot = card.scheduledSlot ? dayjs(card.scheduledSlot) : null
    const nextSlot = sourceSlot
      ? dayjs(formatted).hour(sourceSlot.hour()).minute(sourceSlot.minute()).second(0)
      : dayjs(formatted).hour(9).minute(0).second(0)

    const updatedTemplate = {
      ...template,
      nextDueDate: formatted,
      scheduledSlots: [...remainingSlots, nextSlot.toISOString()].sort(),
    }

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

  const loadPrompt = async () => {
    setPromptLoading(true)
    try {
      const prompt = await fetchPrompt()
      setPromptDraft(prompt)
    } catch (error) {
      console.error('Failed to load prompt', error)
      window.alert('Unable to load the prompt. Please try again.')
    } finally {
      setPromptLoading(false)
    }
  }

  const handleOpenPromptEditor = async () => {
    await loadPrompt()
    setPromptOpen(true)
  }

  const handleSavePrompt = async () => {
    try {
      setSyncMessage('Saving prompt…')
      const saved = await savePrompt(promptDraft)
      setPromptDraft(saved)
      setPromptOpen(false)
    } catch (error) {
      console.error('Failed to save prompt', error)
      window.alert('Unable to save the prompt. Please try again.')
    } finally {
      setSyncMessage('')
    }
  }

  const handlePlanWeek = async () => {
    try {
      setSyncMessage('Preparing AI plan…')
      const [promptValue, preview] = await Promise.all([fetchPrompt(), schedulePreview()])
      const taskJson = JSON.stringify(preview.tasks, null, 2)
      const fullPrompt = `${promptValue}\n\nTasks JSON for upcoming week:\n${taskJson}`

      setSyncMessage('Calling AI…')
      const aiResponse = await generatePlan({ prompt: fullPrompt })
      setAiPlan(aiResponse)

      let parsedPlan = []
      try {
        const json = JSON.parse(aiResponse)
        if (Array.isArray(json)) {
          parsedPlan = json
        } else {
          throw new Error('AI response is not an array')
        }
      } catch (err) {
        console.error('Unable to parse AI response as JSON', err)
        window.alert('AI did not return valid JSON. Please refine the prompt or retry.')
        return
      }

      const normalizedPlan = parsedPlan
        .map((entry) => ({
          task_id: entry.task_id || entry.id,
          scheduled_time: entry.scheduled_time || entry.time || null,
          scheduled_date: entry.scheduled_date || entry.date,
          last_completed_at: entry.last_completed_at || null,
        }))
        .filter((entry) => entry.task_id && entry.scheduled_date)

      if (!normalizedPlan.length) {
        window.alert('No valid schedule entries were found in the AI response.')
        return
      }

      setSyncMessage('Recording plan…')
      await scheduleCommit({
        weekStart: preview.week_start,
        weekEnd: preview.week_end,
        plan: normalizedPlan,
        aiResponse,
      })

      const refreshedTasks = await fetchTasks()
      setTasks(refreshedTasks)
      window.alert('AI weekly plan recorded. Calendar refreshed.')
      console.info('AI plan prompt:', fullPrompt)
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
          <button className="btn-secondary" onClick={handleOpenPromptEditor}>
            Edit prompt
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

      {promptOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <header className="modal__header">
              <h3>Edit prompt before sending</h3>
              <button className="btn-secondary" onClick={() => setPromptOpen(false)}>
                Close
              </button>
            </header>
            <section className="modal__body">
              <p className="muted">This prompt is stored in the backend and used as-is when planning the week.</p>
              <textarea
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={16}
                style={{ width: '100%' }}
                disabled={promptLoading}
              />
            </section>
            <footer className="modal__footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setPromptOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSavePrompt} disabled={!promptDraft.trim() || promptLoading}>
                Save prompt
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

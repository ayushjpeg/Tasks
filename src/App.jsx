import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dayjs from './utils/dates'
import DailyBoard from './components/DailyBoard'
import WeeklyBoard from './components/WeeklyBoard'
import TaskLibrary from './components/TaskLibrary'
import HistoryView from './components/HistoryView'
import TaskModal from './components/TaskModal'
import PlanBoard from './components/PlanBoard'
import {
  applyTaskAction,
  createTask as apiCreateTask,
  deleteTask as apiDeleteTask,
  fetchPlanner,
  fetchTaskHistory,
  fetchTasks,
  scheduleCommit,
  updateTask as apiUpdateTask,
} from './api/tasksApi'

const tabs = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'plan', label: 'Plan' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'history', label: 'History' },
]

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev'

const plansEqual = (a, b) => {
  const aKeys = Object.keys(a || {})
  const bKeys = Object.keys(b || {})
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => {
    const aList = a[key] || []
    const bList = b[key] || []
    if (aList.length !== bList.length) return false
    return aList.every((value, idx) => value === bList[idx])
  })
}

const normalizePlanMap = (planMap = {}) => {
  const normalized = {}
  Object.entries(planMap).forEach(([date, taskIds]) => {
    const seen = new Set()
    const unique = []
    ;(taskIds || []).forEach((taskId) => {
      if (!taskId || seen.has(taskId)) return
      seen.add(taskId)
      unique.push(taskId)
    })
    if (unique.length) {
      normalized[date] = unique
    }
  })
  return normalized
}

const buildPlanPayload = (planned = {}) =>
  Object.entries(normalizePlanMap(planned)).flatMap(([date, taskIds]) =>
    (taskIds || []).map((taskId) => ({
      task_id: taskId,
      scheduled_date: date,
      scheduled_time: null,
      last_completed_at: null,
    })),
  )

const OCCASIONAL = 'occasional'
const DAILY = 'daily'
const LONG_TERM_TASK = 'long_term_task'
const LONG_TERM_GOAL = 'long_term_goal'

const isDependencyScheduledTask = (task) => (task.category || OCCASIONAL) === OCCASIONAL && task.recurrence?.mode === 'after_completion' && !!task.triggerTaskId

const isManualPlanningTask = (task) => (task.category || OCCASIONAL) === OCCASIONAL && !isDependencyScheduledTask(task)

const isWithinWeek = (dateValue, weekStart, weekEnd) => {
  const parsed = dayjs(dateValue)
  if (!parsed.isValid()) return false
  return !parsed.isBefore(weekStart, 'day') && !parsed.isAfter(weekEnd, 'day')
}

function App() {
  const [tasks, setTasks] = useState([])
  const [history, setHistory] = useState([])
  const [activeDate, setActiveDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [planner, setPlanner] = useState({ start: dayjs().format('YYYY-MM-DD'), end: dayjs().format('YYYY-MM-DD'), days: [] })
  const [view, setView] = useState('daily')
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [syncMessage, setSyncMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [planWeekStart, setPlanWeekStart] = useState(dayjs().startOf('week'))
  const [planned, setPlanned] = useState({})
  const [planStatus, setPlanStatus] = useState('')
  const weekStart = dayjs(activeDate).startOf('week')
  const weekKey = weekStart.format('YYYY-MM-DD')
  const planWeekEnd = useMemo(() => planWeekStart.add(6, 'day'), [planWeekStart])
  const skipNextPlanCommit = useRef(false)
  const planSaveInFlight = useRef(false)
  const planSaveQueued = useRef(false)
  const latestPlanRef = useRef(planned)
  useEffect(() => {
    // Avoid committing immediately on first render
    skipNextPlanCommit.current = true
  }, [])

  const refreshCurrentWeek = useCallback(
    async ({ showLoader = false } = {}) => {
      if (showLoader) setIsLoading(true)
      setLoadError('')
      try {
        const [taskData, historyData, plannerData] = await Promise.all([
          fetchTasks(),
          fetchTaskHistory(),
          fetchPlanner({ startDate: weekStart.format('YYYY-MM-DD'), days: 7 }),
        ])
        setTasks(taskData)
        setHistory(historyData)
        setPlanner(plannerData)
      } catch (error) {
        console.error('Failed to load data', error)
        setLoadError('Unable to load data from the backend. Retry or check your network connection.')
      } finally {
        if (showLoader) setIsLoading(false)
      }
    },
    [weekKey],
  )

  useEffect(() => {
    let canceled = false
    const load = async () => {
      setIsLoading(true)
      setLoadError('')
      try {
        const [taskData, historyData, plannerData] = await Promise.all([
          fetchTasks(),
          fetchTaskHistory(),
          fetchPlanner({ startDate: weekStart.format('YYYY-MM-DD'), days: 7 }),
        ])
        if (canceled) return
        setTasks(taskData)
        setHistory(historyData)
        setPlanner(plannerData)
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
  }, [weekKey])

  useEffect(() => {
    const start = planWeekStart.startOf('day')
    const end = planWeekEnd.endOf('day')
    const nextPlan = {}

    tasks.forEach((task) => {
      if (!isManualPlanningTask(task)) return
      (task.scheduledSlots || []).forEach((slotIso) => {
        const slot = dayjs(slotIso)
        if (!slot.isValid()) return
        if (slot.isBefore(start, 'day') || slot.isAfter(end, 'day')) return
        const dayKey = slot.format('YYYY-MM-DD')
        nextPlan[dayKey] = [...(nextPlan[dayKey] || []), task.id]
      })
    })

    const normalizedNextPlan = normalizePlanMap(nextPlan)

    setPlanned((prev) => {
      if (plansEqual(prev, normalizedNextPlan)) return prev
      skipNextPlanCommit.current = true
      setPlanStatus('Synced from saved plan')
      return normalizedNextPlan
    })
  }, [tasks, planWeekStart, planWeekEnd])

  useEffect(() => {
    // Navigating weeks should never auto-commit stale plan state from the previous week.
    skipNextPlanCommit.current = true
  }, [planWeekStart, planWeekEnd])

  const commitPlan = useCallback(
    async (planMap) => {
      planSaveInFlight.current = true
      setPlanStatus('Saving…')
      try {
        const planPayload = buildPlanPayload(planMap)
        await scheduleCommit({
          weekStart: planWeekStart.format('YYYY-MM-DD'),
          weekEnd: planWeekEnd.format('YYYY-MM-DD'),
          plan: planPayload,
        })
        await refreshCurrentWeek()
        setPlanStatus(planPayload.length ? 'Saved' : 'Deleted week plan')
      } catch (error) {
        console.error('Failed to save plan', error)
        setPlanStatus('Save failed')
        window.alert('Unable to save the plan right now.')
      } finally {
        planSaveInFlight.current = false
        if (planSaveQueued.current) {
          planSaveQueued.current = false
          await commitPlan(latestPlanRef.current)
        }
      }
    },
    [planWeekEnd, planWeekStart, refreshCurrentWeek],
  )

  const requestPlanSave = useCallback(async () => {
    if (skipNextPlanCommit.current) {
      skipNextPlanCommit.current = false
      return
    }

    const draftPlan = latestPlanRef.current || {}
    const planDates = Object.keys(draftPlan)
    if (planDates.length) {
      const hasInsideCurrentWeek = planDates.some((dateKey) => isWithinWeek(dateKey, planWeekStart, planWeekEnd))
      const hasOutsideCurrentWeek = planDates.some((dateKey) => !isWithinWeek(dateKey, planWeekStart, planWeekEnd))

      // If this looks like stale data from another week, ignore this autosave cycle.
      if (hasOutsideCurrentWeek && !hasInsideCurrentWeek) {
        return
      }
    }

    if (planSaveInFlight.current) {
      planSaveQueued.current = true
      return
    }

    await commitPlan(latestPlanRef.current)
    while (planSaveQueued.current) {
      planSaveQueued.current = false
      await commitPlan(latestPlanRef.current)
    }
  }, [commitPlan])

  useEffect(() => {
    latestPlanRef.current = normalizePlanMap(planned)
    requestPlanSave()
  }, [planned, requestPlanSave])

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
      if (task.id && tasks.some((t) => t.id === task.id)) {
        await apiUpdateTask(task)
      } else {
        // Remove any local id before sending to backend
        const { id, ...rest } = task
        await apiCreateTask(rest)
      }
      await refreshCurrentWeek()
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
      await refreshCurrentWeek()
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

    try {
      setSyncMessage('Logging completion…')
      await applyTaskAction(template.id, {
        action: 'complete',
        actionDate: dayjs(completionDate).toISOString(),
        durationMinutes: card.chunkMinutes ?? card.duration ?? template.duration,
        note: '',
        status: 'completed',
        scheduledSlot: card.scheduledSlot,
        scheduledSlotsToClear: card.scheduledSlotsToClear || [],
      })
      await refreshCurrentWeek()
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
    if ((template.category || OCCASIONAL) !== OCCASIONAL) return

    try {
      setSyncMessage('Updating task…')
      await applyTaskAction(template.id, {
        action: 'snooze',
        actionDate: dayjs(referenceDate).hour(12).minute(0).second(0).millisecond(0).toISOString(),
        scheduledSlot: card.scheduledSlot,
        scheduledSlotsToClear: card.scheduledSlotsToClear || [],
      })
      await refreshCurrentWeek()
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
    if ((template.category || OCCASIONAL) !== OCCASIONAL) return
    const suggested = dayjs(card.dueDate ?? activeDate).add(1, 'day').format('YYYY-MM-DD')
    const nextDate = window.prompt('Move to which date? (YYYY-MM-DD)', suggested)
    if (!nextDate) return
    const candidate = dayjs(nextDate)
    if (!candidate.isValid()) {
      window.alert('Please enter a valid date in YYYY-MM-DD format.')
      return
    }

    const formatted = candidate.format('YYYY-MM-DD')
    try {
      setSyncMessage('Rescheduling task…')
      await applyTaskAction(template.id, {
        action: 'reschedule',
        actionDate: dayjs(card.dueDate ?? activeDate).hour(12).minute(0).second(0).millisecond(0).toISOString(),
        scheduledSlot: card.scheduledSlot,
        scheduledSlotsToClear: card.scheduledSlotsToClear || [],
        targetDate: formatted,
      })
      await refreshCurrentWeek()
    } catch (error) {
      console.error('Failed to reschedule task', error)
      window.alert('Unable to reschedule right now.')
    } finally {
      setSyncMessage('')
    }
  }

  const handleTaskStatus = async (card, referenceDate, status) => {
    const template = tasks.find((item) => item.id === card.taskId)
    if (!template) return

    const entryStamp = dayjs(referenceDate).hour(12).minute(0).second(0).millisecond(0).toISOString()

    try {
      setSyncMessage('Logging task status…')
      await applyTaskAction(template.id, {
        action: 'skip',
        actionDate: entryStamp,
        durationMinutes: card.chunkMinutes ?? card.duration ?? template.duration,
        note: '',
        status,
        scheduledSlot: card.scheduledSlot,
        scheduledSlotsToClear: card.scheduledSlotsToClear || [],
      })
      await refreshCurrentWeek()
    } catch (error) {
      console.error('Failed to log task status', error)
      window.alert('Unable to log that task status right now.')
    } finally {
      setSyncMessage('')
    }
  }

  const renderView = () => {
    if (view === 'weekly') {
      return <WeeklyBoard days={planner.days} activeDate={activeDate} onSelectDay={setActiveDate} />
    }
    if (view === 'plan') {
      const addToPlan = (taskId, date) => {
        if (!taskId) return
        setPlanned((prev) => {
          const current = prev[date] ? [...prev[date]] : []
          if (current.includes(taskId)) return prev
          const list = [...current, taskId]
          return { ...prev, [date]: list }
        })
      }

      const removeFromPlan = (date, index) => {
        setPlanned((prev) => {
          const list = prev[date] ? [...prev[date]] : []
          if (index < 0 || index >= list.length) return prev
          list.splice(index, 1)
          const next = { ...prev }
          if (list.length) {
            next[date] = list
          } else {
            delete next[date]
          }
          return next
        })
      }

      const moveInPlan = (date, index, delta) => {
        setPlanned((prev) => {
          const list = prev[date] ? [...prev[date]] : []
          const target = index + delta
          if (target < 0 || target >= list.length) return prev
          const next = [...list]
          const [item] = next.splice(index, 1)
          next.splice(target, 0, item)
          return { ...prev, [date]: next }
        })
      }

      const clearPlan = () => setPlanned({})
      const deletePlan = async () => {
        const hasScheduled = tasks.some((task) => (task.category || OCCASIONAL) === OCCASIONAL && (task.scheduledSlots || []).length)
        if (hasScheduled && !window.confirm('Delete all scheduled tasks from all weeks?')) return

        setSyncMessage('Deleting all scheduled tasks…')
        setPlanStatus('Deleting…')

        try {
          const tasksToUpdate = tasks.filter((task) => (task.scheduledSlots || []).length)
            .filter((task) => isManualPlanningTask(task))
          await Promise.all(tasksToUpdate.map((task) => apiUpdateTask({ ...task, scheduledSlots: [] })))
          await refreshCurrentWeek()
          skipNextPlanCommit.current = true
          setPlanned({})
          setPlanStatus('Deleted all scheduled tasks')
        } catch (error) {
          console.error('Failed to delete all schedules', error)
          setPlanStatus('Delete failed')
          window.alert('Unable to delete all scheduled tasks right now.')
        } finally {
          setSyncMessage('')
        }
      }

      return (
        <PlanBoard
          tasks={tasks.filter((task) => isManualPlanningTask(task))}
          history={history}
          weekStart={planWeekStart}
          planned={planned}
          onAdd={addToPlan}
          onRemove={removeFromPlan}
          onMove={moveInPlan}
          onWeekChange={(nextStart) => setPlanWeekStart(dayjs(nextStart).startOf('week'))}
          onClear={clearPlan}
          onDelete={deletePlan}
          planStatus={planStatus}
        />
      )
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
          onLongTermProgress={(task) => handleTaskStatus(task, activeDay?.date ?? activeDate, 'progress')}
          onLongTermNoProgress={(task) => handleTaskStatus(task, activeDay?.date ?? activeDate, 'did_not_progress')}
          onSkipDaily={(task) => handleTaskStatus(task, activeDay?.date ?? activeDate, 'skipped')}
          isWorking={Boolean(syncMessage)}
        />
      </>
    )
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
          <p className="version-badge">Version {APP_VERSION}</p>
          {loadError && <p className="muted">{loadError}</p>}
          {!loadError && syncMessage && <p className="muted">{syncMessage}</p>}
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

      <TaskModal open={taskModalOpen} initialTask={selectedTask} availableTasks={tasks} onClose={closeTaskModal} onSave={handleSaveTask} />
    </div>
  )
}

export default App

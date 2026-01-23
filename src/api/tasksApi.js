const DEFAULT_BASE_URL = 'https://common-backend.ayux.in/api'
const stripTrailingSlash = (value) => value.replace(/\/$/, '')

const API_BASE_URL = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL)
const API_KEY = import.meta.env.VITE_API_KEY || ''

const buildHeaders = (body, extraHeaders = {}) => {
  const headers = new Headers(extraHeaders)
  if (API_KEY) {
    headers.set('X-API-Key', API_KEY)
  }
  if (body && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

const request = async (path, { method = 'GET', body = undefined, headers = {} } = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    body,
    headers: buildHeaders(body, headers),
  })

  if (!response.ok) {
    const errorPayload = await response.text()
    throw new Error(errorPayload || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const fromApiRecurrence = (recurrence) => ({
  ...(recurrence?.config || {}),
  mode: recurrence?.mode || 'gap',
})

const toApiRecurrence = (recurrence = {}) => {
  const { mode = 'gap', ...config } = recurrence || {}
  return { mode, config }
}

const cleanObject = (input) => {
  const entries = Object.entries(input || {}).filter(([, value]) => value !== undefined)
  return Object.fromEntries(entries)
}

const fromApiTask = (payload) => {
  const metadata = payload.metadata_json || {}
  return {
    id: payload.id,
    title: payload.title,
    description: payload.description || '',
    duration: payload.duration_minutes ?? metadata.duration ?? 30,
    priority: payload.priority || 'medium',
    recurrence: fromApiRecurrence(payload.recurrence),
    nextDueDate: metadata.nextDueDate ?? null,
    window: metadata.window || 'any',
    allowDuringWork: Boolean(metadata.allowDuringWork),
    allowSplit: Boolean(metadata.allowSplit),
    autop: Boolean(metadata.autop),
    notesEnabled: metadata.notesEnabled ?? true,
    autoSplit: Boolean(metadata.autoSplit ?? metadata.allowSplit),
    maxChunkMinutes: metadata.maxChunkMinutes ?? 60,
    remainingDuration: metadata.remainingDuration ?? null,
    deferUntil: metadata.deferUntil ?? null,
    notesLog: metadata.notesLog ?? [],
    lastCompletedAt: metadata.lastCompletedAt ?? null,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  }
}

const toApiTaskPayload = (task) => ({
  title: task.title,
  description: task.description,
  duration_minutes: task.duration,
  priority: task.priority,
  recurrence: toApiRecurrence(task.recurrence),
  metadata_json: cleanObject({
    nextDueDate: task.nextDueDate ?? null,
    window: task.window ?? 'any',
    allowDuringWork: Boolean(task.allowDuringWork),
    allowSplit: Boolean(task.allowSplit),
    autop: Boolean(task.autop),
    notesEnabled: task.notesEnabled ?? true,
    autoSplit: Boolean(task.autoSplit),
    maxChunkMinutes: task.maxChunkMinutes ?? 60,
    remainingDuration: task.remainingDuration ?? null,
    deferUntil: task.deferUntil ?? null,
    notesLog: task.notesLog ?? [],
    lastCompletedAt: task.lastCompletedAt ?? null,
  }),
})

const fromApiHistory = (record, fallbackTitle) => ({
  id: record.id,
  taskId: record.task_id,
  title: record.task_title || fallbackTitle || '',
  duration: record.duration_minutes,
  completedAt: record.completed_at,
  note: record.note || '',
  status: record.status || 'completed',
})

export const fetchTasks = async () => {
  const data = await request('/tasks/')
  return data.map(fromApiTask)
}

export const createTask = async (task) => {
  const payload = toApiTaskPayload(task)
  const data = await request('/tasks/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return fromApiTask(data)
}

export const updateTask = async (task) => {
  const payload = toApiTaskPayload(task)
  const data = await request(`/tasks/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return fromApiTask(data)
}

export const deleteTask = async (taskId) => {
  await request(`/tasks/${taskId}`, { method: 'DELETE' })
}

export const fetchTaskHistory = async (limit = 250) => {
  const data = await request(`/tasks/history?limit=${limit}`)
  return data.map((record) => fromApiHistory(record))
}

export const logTaskHistory = async (taskId, entry, fallbackTitle) => {
  const payload = {
    completed_at: entry.completedAt,
    duration_minutes: entry.durationMinutes,
    note: entry.note || '',
    status: entry.status || 'completed',
  }
  const data = await request(`/tasks/${taskId}/history`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return fromApiHistory(data, fallbackTitle)
}

export const schedulePreview = async (weekStart, weekEnd) => {
  const body = {}
  if (weekStart) body.week_start = weekStart
  if (weekEnd) body.week_end = weekEnd
  const data = await request('/tasks/schedule/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return data
}

export const scheduleCommit = async ({ weekStart, weekEnd, plan, aiResponse }) => {
  const payload = {
    week_start: weekStart,
    week_end: weekEnd,
    plan,
    ai_response: aiResponse || null,
  }
  const data = await request('/tasks/schedule/commit', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

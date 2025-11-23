export const toMinutes = (value) => {
  if (typeof value === 'number') return value
  if (!value) return 0
  const [h = '0', m = '0'] = String(value).split(':')
  return Number(h) * 60 + Number(m)
}

export const toTimeString = (value) => {
  const minutes = Math.max(0, Math.round(value))
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

export const formatRange = (start, end) => `${toTimeString(start)} – ${toTimeString(end)}`

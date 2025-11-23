import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import isoWeek from 'dayjs/plugin/isoWeek'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

if (!dayjs.prototype.$_pluginsApplied) {
  dayjs.extend(advancedFormat)
  dayjs.extend(isoWeek)
  dayjs.extend(localizedFormat)
  dayjs.extend(utc)
  dayjs.extend(timezone)
  dayjs.prototype.$_pluginsApplied = true
}

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
if (dayjs.tz && tz) {
  dayjs.tz.setDefault(tz)
}

export const getStartOfWeek = (baseDate = dayjs(), offsetWeeks = 0) =>
  dayjs(baseDate).startOf('week').add(offsetWeeks, 'week')

export const formatDayLabel = (date) => dayjs(date).format('ddd DD MMM')

export const toISODate = (date) => dayjs(date).format('YYYY-MM-DD')

export const toDisplayDate = (date) => dayjs(date).format('dddd, MMM D')

export const parseISO = (value) => dayjs(value)

export default dayjs

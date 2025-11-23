export const DAY_TEMPLATES = {
  0: { label: 'Sunday', workMode: 'off' },
  1: { label: 'Monday', workMode: 'office' },
  2: { label: 'Tuesday', workMode: 'office' },
  3: { label: 'Wednesday', workMode: 'wfh' },
  4: { label: 'Thursday', workMode: 'wfh' },
  5: { label: 'Friday', workMode: 'wfh' },
  6: { label: 'Saturday', workMode: 'off' },
}

export const DAY_BOUNDS = { startMinute: 6 * 60, endMinute: 23 * 60 }

export const ROUTINE_BLOCKS = [
  {
    id: 'office-core',
    label: 'Office (11:00 – 19:00)',
    days: [1, 2],
    start: '11:00',
    end: '19:00',
    color: '#2c2f3b',
    type: 'routine',
  },
  {
    id: 'wfh-focus',
    label: 'WFH Focus Block',
    days: [3, 4, 5],
    start: '11:00',
    end: '19:00',
    color: '#2a3138',
    type: 'routine',
  },
  {
    id: 'gym-cardio',
    label: 'Gym cardio',
    days: [1, 3],
    start: '19:00',
    end: '19:30',
    color: '#173f5f',
    type: 'health',
  },
  {
    id: 'gym-strength',
    label: 'Gym strength',
    days: [1, 3],
    start: '19:30',
    end: '21:00',
    color: '#1b98e0',
    type: 'health',
  },
  {
    id: 'gym-strength-rest',
    label: 'Gym strength',
    days: [0, 2, 4, 5, 6],
    start: '19:00',
    end: '20:30',
    color: '#1b98e0',
    type: 'health',
  },
  {
    id: 'cook-dinner',
    label: 'Cook + clean kitchen',
    days: [0, 1, 2, 3, 4, 5, 6],
    start: '21:00',
    end: '22:00',
    color: '#f25f5c',
    type: 'routine',
  },
  {
    id: 'breakfast',
    label: 'Breakfast + planning',
    days: [0, 1, 2, 3, 4, 5, 6],
    start: '08:00',
    end: '09:00',
    color: '#ffe066',
    type: 'personal',
  },
  {
    id: 'commute',
    label: 'Commute buffer',
    days: [1, 2],
    start: '09:00',
    end: '10:30',
    color: '#2c2f3b',
    type: 'routine',
  },
]

export const DEFAULT_WINDOWS = {
  morning: { start: 7 * 60, end: 11 * 60 },
  afternoon: { start: 13 * 60, end: 17 * 60 },
  evening: { start: 19 * 60, end: 22 * 60 },
  work: { start: 11 * 60, end: 19 * 60 },
  any: null,
}

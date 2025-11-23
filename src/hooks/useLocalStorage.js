import { useEffect, useRef, useState } from 'react'

const safelyParse = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch (error) {
    console.warn('Failed to parse localStorage value', error)
    return typeof fallback === 'function' ? fallback() : fallback
  }
}

export const useLocalStorage = (key, initialValue) => {
  const initializer = () => {
    if (typeof window === 'undefined') return typeof initialValue === 'function' ? initialValue() : initialValue
    const stored = window.localStorage.getItem(key)
    if (stored == null) return typeof initialValue === 'function' ? initialValue() : initialValue
    return safelyParse(stored, initialValue)
  }

  const [value, setValue] = useState(initializer)
  const prevKeyRef = useRef(key)

  useEffect(() => {
    if (prevKeyRef.current !== key) {
      window.localStorage.removeItem(prevKeyRef.current)
      prevKeyRef.current = key
    }
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

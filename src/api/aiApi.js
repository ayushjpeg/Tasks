const DEFAULT_OLLAMA_BASE = 'https://ollama.ayux.in'
const stripTrailingSlash = (value) => value.replace(/\/$/, '')

const OLLAMA_BASE_URL = stripTrailingSlash(import.meta.env.VITE_OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE)

export const generatePlan = async ({ prompt, model = 'llama3.2:3b', options = {} }) => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        num_ctx: options.num_ctx || 4000,
        ...options,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `AI request failed with status ${response.status}`)
  }

  const data = await response.json()
  return data.response || ''
}

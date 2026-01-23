const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-pro'

const buildGenerationConfig = (options = {}) => {
  const { temperature, top_p, top_k, max_output_tokens } = options
  const cfg = {}
  if (temperature !== undefined) cfg.temperature = temperature
  if (top_p !== undefined) cfg.topP = top_p
  if (top_k !== undefined) cfg.topK = top_k
  if (max_output_tokens !== undefined) cfg.maxOutputTokens = max_output_tokens
  return cfg
}

export const generatePlan = async ({ prompt, model = GEMINI_MODEL, options = {} }) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key (VITE_GEMINI_API_KEY)')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  }

  const genConfig = buildGenerationConfig(options)
  if (Object.keys(genConfig).length) {
    payload.generationConfig = genConfig
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `AI request failed with status ${response.status}`)
  }

  const data = await response.json()
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return candidate
}

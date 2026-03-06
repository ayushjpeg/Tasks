import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

const run = (command, fallback) => {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return fallback
  }
}

const commitCount = run('git rev-list --count HEAD', '0')
const shortSha = run('git rev-parse --short HEAD', 'local')
const autoVersion = `${commitCount}-${shortSha}`
const appVersion = process.env.VITE_APP_VERSION || autoVersion

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  server: {
    host: '0.0.0.0',
    port: 8006,
    strictPort: true,
    allowedHosts: ['tasks.ayux.in'],
  },
  preview: {
    host: '0.0.0.0',
    port: 8006,
    strictPort: true,
  },
})

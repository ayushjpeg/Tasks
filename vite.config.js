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

const ciSha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.CI_COMMIT_SHA ||
  process.env.BUILD_SOURCEVERSION ||
  ''
const ciRun =
  process.env.GITHUB_RUN_NUMBER || process.env.CI_PIPELINE_IID || process.env.BUILD_BUILDID || process.env.VERCEL_GIT_COMMIT_REF || ''

const gitCommitCount = run('git rev-list --count HEAD', '')
const gitShortSha = run('git rev-parse --short HEAD', '')
const ciShortSha = ciSha ? ciSha.slice(0, 7) : ''

const autoVersion = (() => {
  if (gitCommitCount && gitShortSha) return `${gitCommitCount}-${gitShortSha}`
  if (ciRun && ciShortSha) return `${ciRun}-${ciShortSha}`
  if (ciShortSha) return `sha-${ciShortSha}`
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)
  return `build-${stamp}`
})()

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

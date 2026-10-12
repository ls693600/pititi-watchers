import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// Relative base so the build works from any sub-path (GitHub Pages serves it at /pititi-watchers/)
export default defineConfig({
  base: './',
  plugins: [react()],
  // Shown in Settings ("Version Oct 11 · 1a2b3c4") so anyone can tell which version their phone runs
  define: {
    __APP_BUILT__: JSON.stringify(new Date().toISOString()),
    __APP_SHA__: JSON.stringify(gitSha()),
  },
})

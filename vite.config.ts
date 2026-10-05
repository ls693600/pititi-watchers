import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works from any sub-path (GitHub Pages serves it at /pititi-watchers/)
export default defineConfig({
  base: './',
  plugins: [react()],
})

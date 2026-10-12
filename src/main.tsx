import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { watchTheme } from './theme'
import { ErrorBoundary } from './components/ErrorBoundary'
import { flushErrorReports, watchErrors } from './errors'

watchTheme()
watchErrors()
// Reports that waited (offline, or before sign-in) go out a little after start
setTimeout(flushErrorReports, 5000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // The app still works online without the offline cache
  })
}

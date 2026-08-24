import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Ensure all same-origin API requests carry the session cookie.
const originalFetch = globalThis.fetch
globalThis.fetch = function patchedFetch(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('/api/') || (typeof location !== 'undefined' && url.startsWith(location.origin + '/api/'))) {
    return originalFetch(input, { ...init, credentials: 'same-origin' })
  }
  return originalFetch(input, init)
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

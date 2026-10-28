import { RegistryContext } from '@effect/atom-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { appRegistry } from './lib/runtime.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RegistryContext.Provider value={appRegistry}>
      <App />
    </RegistryContext.Provider>
  </StrictMode>,
)

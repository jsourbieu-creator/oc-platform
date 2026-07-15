import React from 'react'
import ReactDOM from 'react-dom/client'
import { IconContext } from '@phosphor-icons/react'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: 'bold' }}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </IconContext.Provider>
  </React.StrictMode>
)

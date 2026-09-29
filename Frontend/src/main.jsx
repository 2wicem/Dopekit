import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { initNativeShell, isNativeApp } from './nativeShell.js'

if (import.meta.env.PROD && !isNativeApp()) {
  registerSW({ immediate: true })
}

void initNativeShell()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
        <App />
    </BrowserRouter>
  </React.StrictMode>
)

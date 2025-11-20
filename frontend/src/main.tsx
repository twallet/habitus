import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

const timestamp = new Date().toISOString();
console.log(`[${timestamp}] Frontend application initializing...`);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

console.log(`[${timestamp}] Frontend application mounted`);


import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and suppress benign WebSocket connection failures and unhandled promise rejections
// caused by Vite's hot module reload client attempting to connect inside the container iframe.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const errorStr = event.reason ? String(event.reason.message || event.reason) : '';
    if (
      errorStr.toLowerCase().includes('websocket') || 
      errorStr.toLowerCase().includes('ws://') ||
      errorStr.toLowerCase().includes('wss://')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    const isWsError = message.toLowerCase().includes('websocket') || 
                      (event.error && String(event.error).toLowerCase().includes('websocket'));
    if (isWsError) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


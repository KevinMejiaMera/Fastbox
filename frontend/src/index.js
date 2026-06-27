import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ===== REGISTRO DEL SERVICE WORKER (SOLO PRODUCCIÓN) =====
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(registration => {
        console.log('✅ Service Worker registrado exitosamente:', registration);
      })
      .catch(error => {
        console.error('❌ Error al registrar Service Worker:', error);
      });
  });
}
// printerWorker.js
// Este Web Worker hace polling del estado de la impresora cada 60 segundos
// y envía los resultados al componente principal sin bloquear el hilo principal.

let intervalId = null;
let config = {
  printerApiUrl: '',
  token: '',
  intervalMs: 60000  // 60 segundos por defecto
};

async function checkPrinterStatus() {
  if (!config.printerApiUrl || !config.token) return;

  try {
    const response = await fetch(`${config.printerApiUrl}/api/hardware/status/`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      self.postMessage({ type: 'PRINTER_STATUS', data, error: null });
    } else {
      self.postMessage({ type: 'PRINTER_STATUS', data: null, error: `HTTP ${response.status}` });
    }
  } catch (err) {
    // No lanzar error para no detener el worker
    self.postMessage({ type: 'PRINTER_STATUS', data: null, error: err.message });
  }
}

function startPolling() {
  if (intervalId) clearInterval(intervalId);
  
  // Primera consulta inmediata al iniciar
  checkPrinterStatus();
  
  // Luego cada N segundos
  intervalId = setInterval(checkPrinterStatus, config.intervalMs);
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Escuchar mensajes del hilo principal
self.onmessage = function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'START':
      config = { ...config, ...payload };
      startPolling();
      break;

    case 'STOP':
      stopPolling();
      break;

    case 'UPDATE_TOKEN':
      config.token = payload.token;
      break;

    case 'UPDATE_INTERVAL':
      config.intervalMs = payload.intervalMs;
      if (intervalId) {
        // Reiniciar con nuevo intervalo
        startPolling();
      }
      break;

    default:
      break;
  }
};

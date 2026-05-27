import React, { useState, useEffect } from 'react';

/**
 * Componente que monitorea el estado de la impresora usando un Web Worker.
 * Centraliza el polling fuera del hilo principal y reduce la frecuencia.
 */
const PrinterStatusIndicator = () => {
    const [status, setStatus] = useState('unknown'); // 'online', 'offline', 'error', 'unknown'
    const [lastChecked, setLastChecked] = useState(null);

    useEffect(() => {
        // Inicializar el Web Worker
        // El archivo debe estar en /public/printerWorker.js
        const worker = new Worker('/printerWorker.js');

        const baseUrl = process.env.REACT_APP_FAST_FOOD_SERVICE || '';
        const token = localStorage.getItem('token');

        // Configurar y arrancar el worker
        worker.postMessage({
            type: 'START',
            payload: {
                printerApiUrl: baseUrl,
                token: token,
                intervalMs: 60000 // Polling cada 1 minuto (60s)
            }
        });

        // Escuchar respuestas del worker
        worker.onmessage = (e) => {
            const { type, data, error } = e.data;

            if (type === 'PRINTER_STATUS') {
                setLastChecked(new Date());
                if (error) {
                    setStatus('error');
                    console.warn('Printer Worker Error:', error);
                } else if (data && data.status === 'ok') {
                    setStatus('online');
                } else {
                    setStatus('offline');
                }
            }
        };

        // Detener el worker al desmontar
        return () => {
            worker.postMessage({ type: 'STOP' });
            worker.terminate();
        };
    }, []);

    const getStatusStyles = () => {
        switch (status) {
            case 'online':
                return { color: '#059669', label: 'Impresora Online' };
            case 'offline':
                return { color: '#dc2626', label: 'Impresora Offline' };
            case 'error':
                return { color: '#f59e0b', label: 'Error Impresora' };
            default:
                return { color: '#6b7280', label: 'Buscando Impresora...' };
        }
    };

    const { color, label } = getStatusStyles();

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            fontSize: '0.75rem',
            color: '#fff',
            marginTop: 'auto'
        }}>
            <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}`
            }}></div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#fff' }}>{label}</div>
                {lastChecked && (
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                        Refresco: {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrinterStatusIndicator;

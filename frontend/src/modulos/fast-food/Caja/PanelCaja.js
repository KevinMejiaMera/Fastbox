import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import Modal from '../../../comun/Modal';
import ReporteCaja from './ReporteCaja'; 

const PanelCaja = () => {
    const [currentShift, setCurrentShift] = useState(null);
    const [shiftsHistory, setShiftsHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [openingCash, setOpeningCash] = useState('');
    const [closingCash, setClosingCash] = useState('');
    const [notes, setNotes] = useState('');
    const [managerName, setManagerName] = useState('');

    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');

    const [selectedShiftId, setSelectedShiftId] = useState(null);

    const getFastFoodBaseURL = () => process.env.REACT_APP_FAST_FOOD_SERVICE || 'http://localhost:8002';

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const currentRes = await api.get('/api/pos/shifts/current/', { baseURL: getFastFoodBaseURL() });
            setCurrentShift(currentRes.data.shift || currentRes.data);
        } catch (err) {
            if (err.response?.status === 404) {
                setCurrentShift(null);
            } else {
                console.error('Error checking current shift:', err);
            }
        }

        try {
            const historyRes = await api.get('/api/pos/shifts/', { baseURL: getFastFoodBaseURL() });
            setShiftsHistory(historyRes.data.results || historyRes.data || []);
        } catch (err) {
            console.error('Error fetching shifts history:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenShift = async (e) => {
        e.preventDefault();
        setError('');
        if (!managerName.trim()) {
            setError('Por favor, ingresa el nombre del encargado.');
            return;
        }
        
        try {
            let registerId = null;
            try {
                const registersRes = await api.get('/api/payments/cash-registers/', { baseURL: getFastFoodBaseURL() });
                const register = registersRes.data.results ? registersRes.data.results[0] : registersRes.data[0];
                if (register) registerId = register.id;
            } catch (err) {
                console.warn('Could not fetch cash registers');
            }

            const payload = {
                manager_name: managerName,
                opening_cash: parseFloat(openingCash) || 0,
                opening_notes: notes || 'Apertura de Caja'
            };
            if (registerId) payload.cash_register = registerId;

            await api.post('/api/pos/shifts/', payload, { baseURL: getFastFoodBaseURL() });
            
            setOpeningCash('');
            setNotes('');
            setManagerName('');
            loadData();
            alert('Caja abierta exitosamente.');
        } catch (err) {
            console.error('Error opening shift:', err);
            const msg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Error al abrir caja.';
            setError(msg);
        }
    };

    const handleCloseShift = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        if (!window.confirm('¿Está seguro de cerrar la caja actual?')) return;

        try {
            await api.post(`/api/pos/shifts/${currentShift.id}/close/`, {
                closing_cash: parseFloat(closingCash) || 0,
                closing_notes: notes || 'Cierre de Caja'
            }, { baseURL: getFastFoodBaseURL() });

            setClosingCash('');
            setNotes('');
            loadData();
            alert('Caja cerrada correctamente.');
        } catch (err) {
            console.error('Error closing shift:', err);
            setError('Error al cerrar la caja.');
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        try {
            await api.post(`/api/pos/shifts/${currentShift.id}/add_expense/`, {
                amount: parseFloat(expenseAmount),
                description: expenseDescription
            }, { baseURL: getFastFoodBaseURL() });
            setExpenseAmount('');
            setExpenseDescription('');
            alert('Gasto registrado exitosamente.');
        } catch (err) {
            console.error('Error adding expense:', err);
            setError(err.response?.data?.error || 'Error al registrar el gasto.');
        }
    };

    if (loading && !shiftsHistory.length) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando Panel de Caja...</div>;

    const styles = {
        container: { minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '2rem' },
        wrapper: { maxWidth: '1200px', margin: '0 auto' },
        header: {
            backgroundColor: '#ffffff', borderRadius: '16px', padding: '2rem',
            marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex', alignItems: 'center', gap: '1.5rem'
        },
        headerIcon: {
            width: '64px', height: '64px', backgroundColor: '#e7f1ff',
            borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', color: '#0d6efd'
        },
        grid: { display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' },
        card: {
            backgroundColor: '#ffffff', borderRadius: '16px', padding: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        },
        input: {
            width: '100%', padding: '0.75rem', borderRadius: '8px',
            border: '1px solid #dee2e6', marginBottom: '1rem',
            outline: 'none', transition: 'border-color 0.2s',
            boxSizing: 'border-box'
        },
        label: { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#495057' },
        buttonPrimary: {
            width: '100%', padding: '0.875rem', borderRadius: '8px',
            backgroundColor: '#0d6efd', color: '#fff', border: 'none',
            fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s'
        },
        buttonDanger: {
            width: '100%', padding: '0.875rem', borderRadius: '8px',
            backgroundColor: '#dc3545', color: '#fff', border: 'none',
            fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s'
        },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e9ecef', color: '#6c757d', fontWeight: '600' },
        td: { padding: '1rem', borderBottom: '1px solid #e9ecef', verticalAlign: 'middle' },
        statusBadge: (isOpen) => ({
            padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600',
            backgroundColor: isOpen ? '#d1e7dd' : '#e2e3e5',
            color: isOpen ? '#0f5132' : '#41464b'
        })
    };

    return (
        <div style={styles.container}>
            <div style={styles.wrapper}>
                
                <div style={styles.header}>
                    <div style={styles.headerIcon}>
                        <i className="bi bi-cash-coin"></i>
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#1a1a2e', fontWeight: '700' }}>Gestión de Caja</h1>
                        <p style={{ margin: '0.5rem 0 0 0', color: '#6c757d' }}>Control de aperturas, cierres e historial de turnos</p>
                    </div>
                </div>

                {error && (
                    <div style={{ backgroundColor: '#f8d7da', color: '#842029', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        {error}
                    </div>
                )}

                <div style={styles.grid}>
                    {/* Panel de Acción */}
                    <div style={{ ...styles.card, borderTop: `4px solid ${currentShift?.status === 'open' ? '#198754' : '#0d6efd'}` }}>
                        {currentShift && currentShift.status === 'open' ? (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#198754', marginBottom: '1.5rem' }}>
                                    <i className="bi bi-unlock-fill" style={{ fontSize: '1.5rem' }}></i>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Caja Abierta</h2>
                                </div>
                                <div style={{ marginBottom: '1.5rem', color: '#495057' }}>
                                    <p style={{ margin: '0 0 0.5rem 0' }}><strong>Turno:</strong> {currentShift.shift_number}</p>
                                    <p style={{ margin: '0 0 0.5rem 0' }}><strong>Apertura:</strong> {new Date(currentShift.opened_at).toLocaleString()}</p>
                                    <p style={{ margin: '0' }}><strong>Base Inicial:</strong> ${parseFloat(currentShift.opening_cash || 0).toFixed(2)}</p>
                                </div>

                                <form onSubmit={handleCloseShift} style={{ borderTop: '1px solid #e9ecef', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1a1a2e' }}>Cerrar Caja</h3>
                                    
                                    <label style={styles.label}>Efectivo Final Físico</label>
                                    <input type="number" step="0.01" required style={styles.input}
                                        value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />

                                    <label style={styles.label}>Notas de Cierre</label>
                                    <textarea style={{ ...styles.input, resize: 'vertical' }} rows="2"
                                        value={notes} onChange={(e) => setNotes(e.target.value)} />

                                    <button type="submit" style={styles.buttonDanger}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#bb2d3b'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#dc3545'}>
                                        Cerrar Caja
                                    </button>
                                </form>

                                <form onSubmit={handleAddExpense} style={{ borderTop: '1px solid #e9ecef', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1a1a2e' }}>Registrar Gasto (Egreso)</h3>
                                    
                                    <label style={styles.label}>Monto del Gasto</label>
                                    <input type="number" step="0.01" required style={styles.input} placeholder="Ej: 15.50"
                                        value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />

                                    <label style={styles.label}>Descripción / Motivo</label>
                                    <textarea style={{ ...styles.input, resize: 'vertical' }} rows="2" required placeholder="Ej: Pago de agua"
                                        value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} />

                                    <button type="submit" style={{...styles.buttonPrimary, backgroundColor: '#ffc107', color: '#000'}}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#ffca2c'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ffc107'}>
                                        Registrar Gasto
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6c757d', marginBottom: '1.5rem' }}>
                                    <i className="bi bi-lock-fill" style={{ fontSize: '1.5rem' }}></i>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Caja Cerrada</h2>
                                </div>
                                <form onSubmit={handleOpenShift}>
                                    <label style={styles.label}>Nombre del Encargado</label>
                                    <input type="text" required style={styles.input} placeholder="Ej: Juan Pérez"
                                        value={managerName} onChange={(e) => setManagerName(e.target.value)} />

                                    <label style={styles.label}>Efectivo Inicial (Base)</label>
                                    <input type="number" step="0.01" required style={styles.input} placeholder="0.00"
                                        value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />

                                    <label style={styles.label}>Notas (Opcional)</label>
                                    <textarea style={{ ...styles.input, resize: 'vertical' }} rows="2"
                                        value={notes} onChange={(e) => setNotes(e.target.value)} />

                                    <button type="submit" style={styles.buttonPrimary}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#0b5ed7'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#0d6efd'}>
                                        Abrir Caja
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Historial de Cajas */}
                    <div style={styles.card}>
                        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#1a1a2e' }}>Historial de Cajas</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Turno / Encargado</th>
                                        <th style={styles.th}>Apertura</th>
                                        <th style={styles.th}>Cierre</th>
                                        <th style={styles.th}>Estado</th>
                                        <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shiftsHistory.map(shift => (
                                        <tr key={shift.id} style={{ transition: 'background-color 0.2s' }} 
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <td style={styles.td}>
                                                <div style={{ fontWeight: '600', color: '#212529' }}>{shift.shift_number}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{shift.user_name || shift.manager_name}</div>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={{ color: '#212529' }}>{new Date(shift.opened_at).toLocaleDateString()}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{new Date(shift.opened_at).toLocaleTimeString()}</div>
                                                <div style={{ color: '#198754', fontWeight: '600', marginTop: '0.25rem' }}>${parseFloat(shift.opening_cash || 0).toFixed(2)}</div>
                                            </td>
                                            <td style={styles.td}>
                                                {shift.closed_at ? (
                                                    <>
                                                        <div style={{ color: '#212529' }}>{new Date(shift.closed_at).toLocaleDateString()}</div>
                                                        <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{new Date(shift.closed_at).toLocaleTimeString()}</div>
                                                        <div style={{ color: '#0d6efd', fontWeight: '600', marginTop: '0.25rem' }}>${parseFloat(shift.closing_cash || 0).toFixed(2)}</div>
                                                    </>
                                                ) : <span style={{ color: '#adb5bd', fontStyle: 'italic' }}>En curso</span>}
                                            </td>
                                            <td style={styles.td}>
                                                <span style={styles.statusBadge(shift.status === 'open')}>
                                                    {shift.status === 'open' ? 'Abierta' : 'Cerrada'}
                                                </span>
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>
                                                {shift.status === 'closed' && (
                                                    <button 
                                                        onClick={() => setSelectedShiftId(shift.id)}
                                                        style={{ 
                                                            background: 'none', border: 'none', color: '#0d6efd',
                                                            cursor: 'pointer', padding: '0.5rem', borderRadius: '8px'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e7f1ff'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                        title="Ver Reporte"
                                                    >
                                                        <i className="bi bi-file-earmark-text" style={{ fontSize: '1.25rem' }}></i>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {shiftsHistory.length === 0 && (
                                        <tr>
                                            <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#6c757d' }}>No hay historial de cajas disponible.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL PARA REPORTE */}
            <Modal isOpen={!!selectedShiftId} onClose={() => setSelectedShiftId(null)} title="Detalle de Caja">
                {selectedShiftId && <ReporteCaja shiftId={selectedShiftId} />}
            </Modal>
        </div>
    );
};

export default PanelCaja;

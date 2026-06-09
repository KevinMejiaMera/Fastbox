import React, { useState, useEffect, useCallback, useContext } from 'react';
import api from '../../../services/api';
import Modal from '../../../comun/Modal';
import ReporteCaja from './ReporteCaja'; 
import { AuthContext } from '../../../context/AuthContext';
import printerService from '../../../services/printerService';

const PanelCaja = () => {
    const { user } = useContext(AuthContext);
    const roleName = user?.role_details?.name;
    const isAdmin = roleName === 'SUPER_ADMIN' || roleName === 'ADMIN_FAST_FOOD' || user?.is_superuser;
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

    const [blindCashCounts, setBlindCashCounts] = useState({
        c1: '', c5: '', c10: '', c25: '', c50: '', d1: '',
        b5: '', b10: '', b20: '', b50: '', b100: '',
        transfer: ''
    });
    const [isBlindModalOpen, setIsBlindModalOpen] = useState(false);

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

    const printCashReportAutomatically = async (shiftId) => {
        try {
            const response = await api.get(`/api/pos/shifts/${shiftId}/report/`, {
                baseURL: getFastFoodBaseURL()
            });
            const shiftData = response.data;
            const reportData = {
                ...shiftData.summary,
                shift_info: shiftData.shift_info,
                orders_detail: shiftData.orders_detail,
                payment_methods: shiftData.payment_methods,
                expenses: shiftData.expenses || []
            };

            const { shift_info } = reportData;
            const openingCashVal = parseFloat(shift_info.opening_cash || 0);
            const closingCashVal = parseFloat(shift_info.closing_cash || 0);
            const totalExpensesVal = parseFloat(reportData.total_expenses || 0);
            const expensesList = reportData.expenses || [];

            let paymentStats = { efectivo: 0, transferencia: 0, tarjeta: 0 };
            if (reportData.payment_methods && Array.isArray(reportData.payment_methods) && reportData.payment_methods.length > 0) {
                reportData.payment_methods.forEach(pm => {
                    const method = String(pm.payment_method__name || pm.method || pm.name || '').toLowerCase();
                    const amount = parseFloat(pm.total || pm.amount || 0);
                    if (method.includes('efectivo') || method === 'cash') paymentStats.efectivo += amount;
                    else if (method.includes('transferencia') || method.includes('transfer')) paymentStats.transferencia += amount;
                    else if (method.includes('tarjeta') || method.includes('card')) paymentStats.tarjeta += amount;
                });
            } else if (reportData.orders_detail && Array.isArray(reportData.orders_detail)) {
                reportData.orders_detail.forEach(order => {
                    if (['delivered', 'completed'].includes(order.status) || order.payment_status === 'paid') {
                        const method = String(order.payment_method_display || order.payment_method || '').toLowerCase();
                        const total = parseFloat(order.total_amount || order.total || 0);
                        if (method.includes('efectivo') || method === 'cash') paymentStats.efectivo += total;
                        else if (method.includes('transferencia') || method.includes('transfer')) paymentStats.transferencia += total;
                        else if (method.includes('tarjeta') || method.includes('card')) paymentStats.tarjeta += total;
                    }
                });
            }

            let transferenciasFisico = 0;
            if (shift_info.closing_notes) {
                if (shift_info.closing_notes.includes('Transferencias: $')) {
                    const matchT = shift_info.closing_notes.match(/Transferencias:\s*\$?([\d.]+)/);
                    if (matchT) transferenciasFisico = parseFloat(matchT[1]);
                }
            }

            const efectivoTotalBruto = openingCashVal + paymentStats.efectivo;
            const efectivoFisico = closingCashVal - transferenciasFisico;
            const sobranteBruto = efectivoFisico - efectivoTotalBruto;
            const efectivoEsperadoFinal = efectivoTotalBruto;
            const sobranteReal = efectivoFisico - efectivoEsperadoFinal;
            const transferenciasSistema = paymentStats.transferencia;
            const sobranteTransferencia = transferenciasFisico - transferenciasSistema;

            const chars_per_line = 42;
            let lines = [];
            const center = (text) => ' '.repeat(Math.max(0, Math.floor((chars_per_line - text.length) / 2))) + text;
            const rightAlign = (label, value) => {
                const valueStr = String(value);
                const padding = Math.max(0, chars_per_line - label.length - valueStr.length);
                return label + ' '.repeat(padding) + valueStr;
            };

            lines.push(center("REPORTE DE CAJA"));
            lines.push("=".repeat(chars_per_line));
            const current_time = new Date();
            lines.push(`Fecha: ${current_time.toLocaleDateString()}  Hora: ${current_time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
            lines.push(`Turno: ${shift_info.number}`);
            lines.push(`Encargado: ${shift_info.user || shift_info.manager_name}`);
            lines.push(`Apertura: ${new Date(shift_info.opened_at).toLocaleString()}`);
            lines.push(`Cierre: ${shift_info.closed_at ? new Date(shift_info.closed_at).toLocaleString() : 'En curso'}`);
            lines.push("-".repeat(chars_per_line));
            
            lines.push(center("EFECTIVO"));
            lines.push(rightAlign("Efectivo Inicial Base:", `$${openingCashVal.toFixed(2)}`));
            lines.push(rightAlign("Ventas en efec. sist.:", `$${paymentStats.efectivo.toFixed(2)}`));
            lines.push(rightAlign("Total Efectivo Esperado:", `$${efectivoEsperadoFinal.toFixed(2)}`));
            lines.push("-".repeat(chars_per_line));
            lines.push(rightAlign("Efectivo Físico Caja:", `$${efectivoFisico.toFixed(2)}`));
            const sobEfStr = sobranteReal >= 0 ? `+$${sobranteReal.toFixed(2)}` : `-$${Math.abs(sobranteReal).toFixed(2)}`;
            lines.push(rightAlign("SOBRANTE/FALTANTE EFEC.:", sobEfStr));
            lines.push("-".repeat(chars_per_line));

            lines.push(center("TRANSFERENCIAS"));
            lines.push(rightAlign("Dinero en transf. sist.:", `$${transferenciasSistema.toFixed(2)}`));
            lines.push(rightAlign("Dinero en transf. caja:", `$${transferenciasFisico.toFixed(2)}`));
            const sobTrStr = sobranteTransferencia >= 0 ? `+$${sobranteTransferencia.toFixed(2)}` : `-$${Math.abs(sobranteTransferencia).toFixed(2)}`;
            lines.push(rightAlign("SOBRANTE/FALTANTE TRANS.:", sobTrStr));
            lines.push("-".repeat(chars_per_line));


            if (expensesList.length > 0) {
                lines.push(center("DETALLE DE GASTOS"));
                expensesList.forEach(exp => {
                    const desc = exp.description.length > 28 ? exp.description.substring(0, 28) + ".." : exp.description;
                    lines.push(rightAlign(desc, `$${parseFloat(exp.amount).toFixed(2)}`));
                });
                lines.push("-".repeat(chars_per_line));
            }

            if (shift_info.closing_notes) {
                lines.push("NOTAS DE CIERRE:");
                const notesText = shift_info.closing_notes;
                for(let i=0; i<notesText.length; i+=chars_per_line) {
                    lines.push(notesText.substring(i, i+chars_per_line));
                }
                lines.push("-".repeat(chars_per_line));
            }

            lines.push("\n\n\n");
            const ticketContent = lines.join("\n");

            await printerService.printCustomTicket(ticketContent, 'report');
            alert('✅ Comprobante de cierre de caja enviado a la impresora automáticamente.');
        } catch (error) {
            console.error('Error auto-printing shift report:', error);
            alert('⚠️ La caja se cerró, pero hubo un error al imprimir el comprobante automáticamente. Por favor verifica si el agente de Windows está activo.');
        }
    };

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

            // AUTO-PRINT
            printCashReportAutomatically(currentShift.id);

            setClosingCash('');
            setNotes('');
            loadData();
            alert('Caja cerrada correctamente.');
        } catch (err) {
            console.error('Error closing shift:', err);
            setError('Error al cerrar la caja.');
        }
    };

    const handleBlindCloseShift = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        if (!window.confirm('¿Está seguro de cerrar la caja con estos valores?')) return;

        const totalCoinsBills = 
            (parseFloat(blindCashCounts.c1 || 0) * 0.01) +
            (parseFloat(blindCashCounts.c5 || 0) * 0.05) +
            (parseFloat(blindCashCounts.c10 || 0) * 0.10) +
            (parseFloat(blindCashCounts.c25 || 0) * 0.25) +
            (parseFloat(blindCashCounts.c50 || 0) * 0.50) +
            (parseFloat(blindCashCounts.d1 || 0) * 1.00) +
            (parseFloat(blindCashCounts.b5 || 0) * 5.00) +
            (parseFloat(blindCashCounts.b10 || 0) * 10.00) +
            (parseFloat(blindCashCounts.b20 || 0) * 20.00) +
            (parseFloat(blindCashCounts.b50 || 0) * 50.00) +
            (parseFloat(blindCashCounts.b100 || 0) * 100.00);
        
        const totalTransfer = parseFloat(blindCashCounts.transfer || 0);
        const total = totalCoinsBills + totalTransfer;

        const notesStr = `Cierre Ciego. Desglose:\n` +
            `Monedas: 1c(${blindCashCounts.c1 || 0}), 5c(${blindCashCounts.c5 || 0}), 10c(${blindCashCounts.c10 || 0}), 25c(${blindCashCounts.c25 || 0}), 50c(${blindCashCounts.c50 || 0}), $1(${blindCashCounts.d1 || 0})\n` +
            `Billetes: $5(${blindCashCounts.b5 || 0}), $10(${blindCashCounts.b10 || 0}), $20(${blindCashCounts.b20 || 0}), $50(${blindCashCounts.b50 || 0}), $100(${blindCashCounts.b100 || 0})\n` +
            `Transferencias: $${totalTransfer.toFixed(2)}`;

        try {
            await api.post(`/api/pos/shifts/${currentShift.id}/close/`, {
                closing_cash: total,
                closing_notes: notesStr
            }, { baseURL: getFastFoodBaseURL() });

            // AUTO-PRINT
            await printCashReportAutomatically(currentShift.id);

            setIsBlindModalOpen(false);
            setBlindCashCounts({
                c1: '', c5: '', c10: '', c25: '', c50: '', d1: '',
                b5: '', b10: '', b20: '', b50: '', b100: '',
                transfer: ''
            });
            loadData();
            alert('Caja cerrada correctamente.');
        } catch (err) {
            console.error('Error closing blind shift:', err);
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
        container: { minHeight: '100vh', backgroundColor: 'var(--sidebar-bg)', padding: '2rem' },
        wrapper: { maxWidth: '1200px', margin: '0 auto' },
        header: {
            backgroundColor: '#ffffff', borderRadius: '16px', padding: '2rem',
            marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex', alignItems: 'center', gap: '1.5rem'
        },
        headerIcon: {
            width: '64px', height: '64px', backgroundColor: 'var(--secondary-color)',
            borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', color: 'var(--primary-color)'
        },
        grid: { display: 'grid', gridTemplateColumns: isAdmin ? '350px 1fr' : '1fr', gap: '2rem' },
        card: {
            backgroundColor: '#ffffff', borderRadius: '16px', padding: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            maxWidth: isAdmin ? '100%' : '500px',
            margin: isAdmin ? '0' : '0 auto'
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
            backgroundColor: 'var(--primary-color)', color: '#fff', border: 'none',
            fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s'
        },
        buttonDanger: {
            width: '100%', padding: '0.875rem', borderRadius: '8px',
            backgroundColor: 'var(--primary-color)', color: '#fff', border: 'none',
            fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s'
        },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { padding: '1rem', textAlign: 'left', borderBottom: '2px solid var(--primary-color)', color: 'var(--primary-color)', fontWeight: '600' },
        td: { padding: '1rem', borderBottom: '1px solid var(--primary-color)', verticalAlign: 'middle' },
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
                    <div style={{ ...styles.card, borderTop: `4px solid ${currentShift?.status === 'open' ? 'var(--success-color)' : 'var(--primary-color)'}` }}>
                        {currentShift && currentShift.status === 'open' ? (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)', marginBottom: '1.5rem' }}>
                                    <i className="bi bi-unlock-fill" style={{ fontSize: '1.5rem' }}></i>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Caja Abierta</h2>
                                </div>
                                <div style={{ marginBottom: '1.5rem', color: '#495057' }}>
                                    <p style={{ margin: '0 0 0.5rem 0' }}><strong>Turno:</strong> {currentShift.shift_number}</p>
                                    <p style={{ margin: '0 0 0.5rem 0' }}><strong>Apertura:</strong> {new Date(currentShift.opened_at).toLocaleString()}</p>
                                    {isAdmin && (
                                        <p style={{ margin: '0' }}><strong>Base Inicial:</strong> ${parseFloat(currentShift.opening_cash || 0).toFixed(2)}</p>
                                    )}
                                </div>

                                <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1a1a2e' }}>Cerrar Caja</h3>
                                    <button onClick={() => setIsBlindModalOpen(true)} style={styles.buttonDanger}
                                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                                        onMouseLeave={(e) => e.target.style.opacity = '1'}>
                                        Cerrar Caja (Conteo de Efectivo)
                                    </button>
                                </div>

                                <form onSubmit={handleAddExpense} style={{ borderTop: '1px solid #e9ecef', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1a1a2e' }}>Registrar Gasto (Egreso)</h3>
                                    
                                    <label style={styles.label}>Monto del Gasto</label>
                                    <input type="number" step="0.01" required style={styles.input} placeholder="Ej: 15.50"
                                        value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />

                                    <label style={styles.label}>Descripción / Motivo</label>
                                    <textarea style={{ ...styles.input, resize: 'vertical' }} rows="2" required placeholder="Ej: Pago de agua"
                                        value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} />

                                    <button type="submit" style={{...styles.buttonPrimary, backgroundColor: 'var(--secondary-color)', color: 'var(--primary-color)'}}
                                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                                        onMouseLeave={(e) => e.target.style.opacity = '1'}>
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
                                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                                        onMouseLeave={(e) => e.target.style.opacity = '1'}>
                                        Abrir Caja
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Historial de Cajas */}
                    {isAdmin && (
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
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-color)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td style={styles.td}>
                                                    <div style={{ fontWeight: '600', color: '#212529' }}>{shift.shift_number}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{shift.user_name || shift.manager_name}</div>
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={{ color: '#212529' }}>{new Date(shift.opened_at).toLocaleDateString()}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{new Date(shift.opened_at).toLocaleTimeString()}</div>
                                                    <div style={{ color: 'var(--success-color)', fontWeight: '600', marginTop: '0.25rem' }}>${parseFloat(shift.opening_cash || 0).toFixed(2)}</div>
                                                </td>
                                                <td style={styles.td}>
                                                    {shift.closed_at ? (
                                                        <>
                                                            <div style={{ color: '#212529' }}>{new Date(shift.closed_at).toLocaleDateString()}</div>
                                                            <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{new Date(shift.closed_at).toLocaleTimeString()}</div>
                                                            <div style={{ color: 'var(--primary-color)', fontWeight: '600', marginTop: '0.25rem' }}>${parseFloat(shift.closing_cash || 0).toFixed(2)}</div>
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
                                                                background: 'none', border: 'none', color: 'var(--primary-color)',
                                                                cursor: 'pointer', padding: '0.5rem', borderRadius: '8px'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--secondary-color)'}
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
                    )}
                </div>
            </div>

            {/* MODAL PARA REPORTE */}
            <Modal isOpen={!!selectedShiftId} onClose={() => setSelectedShiftId(null)} title="Detalle de Caja">
                {selectedShiftId && <ReporteCaja shiftId={selectedShiftId} />}
            </Modal>

            {/* MODAL PARA CAJA CIEGA */}
            <Modal isOpen={isBlindModalOpen} onClose={() => setIsBlindModalOpen(false)} title="Conteo Físico de Caja">
                <form onSubmit={handleBlindCloseShift}>
                    <p style={{ marginBottom: '1rem', color: '#6c757d' }}>Ingrese la <strong>cantidad</strong> (número de unidades) que tiene de cada denominación, y el monto total en transferencias.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Monedas</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>1 centavo</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.c1} onChange={e => setBlindCashCounts({...blindCashCounts, c1: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>5 centavos</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.c5} onChange={e => setBlindCashCounts({...blindCashCounts, c5: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>10 centavos</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.c10} onChange={e => setBlindCashCounts({...blindCashCounts, c10: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>25 centavos</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.c25} onChange={e => setBlindCashCounts({...blindCashCounts, c25: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>50 centavos</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.c50} onChange={e => setBlindCashCounts({...blindCashCounts, c50: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>$1</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.d1} onChange={e => setBlindCashCounts({...blindCashCounts, d1: e.target.value})} placeholder="0" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Billetes</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>$5</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.b5} onChange={e => setBlindCashCounts({...blindCashCounts, b5: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>$10</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.b10} onChange={e => setBlindCashCounts({...blindCashCounts, b10: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>$20</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.b20} onChange={e => setBlindCashCounts({...blindCashCounts, b20: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>$50</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.b50} onChange={e => setBlindCashCounts({...blindCashCounts, b50: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem' }}>$100</label>
                                    <input type="number" min="0" style={styles.input} value={blindCashCounts.b100} onChange={e => setBlindCashCounts({...blindCashCounts, b100: e.target.value})} placeholder="0" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '1rem' }}>
                        <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Otros Pagos</h4>
                        <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Monto total en transferencias ($)</label>
                        <input type="number" step="0.01" min="0" style={{...styles.input, maxWidth: '200px'}} value={blindCashCounts.transfer} onChange={e => setBlindCashCounts({...blindCashCounts, transfer: e.target.value})} placeholder="Ej: 45.50" />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="button" onClick={() => setIsBlindModalOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #dee2e6', background: 'transparent', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                        <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: '#fff', cursor: 'pointer' }}>
                            Confirmar Cierre
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PanelCaja;

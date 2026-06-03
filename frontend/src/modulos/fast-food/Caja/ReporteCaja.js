import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import jsPDF from 'jspdf';
import { formatCurrency, generateDetailedPDF } from '../../../utils/reportUtils';

const ReporteCaja = ({ shiftId }) => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const getFastFoodBaseURL = () => process.env.REACT_APP_FAST_FOOD_SERVICE || 'http://localhost:8002';

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const response = await api.get(`/api/pos/shifts/${shiftId}/report/`, {
                    baseURL: getFastFoodBaseURL()
                });
                
                const shiftData = response.data;
                const normalizedReport = {
                    ...shiftData.summary,
                    shift_info: shiftData.shift_info,
                    orders_detail: shiftData.orders_detail,
                    payment_methods: shiftData.payment_methods,
                    top_products: shiftData.top_products,
                    expenses: shiftData.expenses || [],
                    date: shiftData.shift_info.opened_at,
                    is_shift_report: true,
                    generated_by: shiftData.shift_info.user
                };
                
                setReportData(normalizedReport);
            } catch (err) {
                console.error("Error fetching shift report:", err);
                setError('No se pudo cargar el reporte del turno.');
            } finally {
                setLoading(false);
            }
        };

        if (shiftId) fetchReport();
    }, [shiftId]);

    if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#6c757d' }}>Cargando reporte...</div>;
    if (error) return <div style={{ padding: '3rem', textAlign: 'center', color: '#dc3545' }}>{error}</div>;
    if (!reportData) return null;

    const { shift_info } = reportData;
    
    const openingCash = parseFloat(shift_info.opening_cash || 0);
    const totalCashSales = parseFloat(reportData.total_cash_sales || 0);
    const closingCash = parseFloat(shift_info.closing_cash || 0);
    const totalSales = parseFloat(reportData.total_sales || 0);
    const totalExpenses = parseFloat(reportData.total_expenses || 0);
    const expensesList = reportData.expenses || [];

    // Desglose de métodos de pago
    let paymentStats = {
        efectivo: 0,
        transferencia: 0,
        tarjeta: 0
    };

    if (reportData.payment_methods && Array.isArray(reportData.payment_methods) && reportData.payment_methods.length > 0) {
        reportData.payment_methods.forEach(pm => {
            const method = String(pm.payment_method__name || pm.method || pm.name || '').toLowerCase();
            const amount = parseFloat(pm.total || pm.amount || 0);
            if (method.includes('efectivo') || method === 'cash') {
                paymentStats.efectivo += amount;
            } else if (method.includes('transferencia') || method.includes('transfer')) {
                paymentStats.transferencia += amount;
            } else if (method.includes('tarjeta') || method.includes('card')) {
                paymentStats.tarjeta += amount;
            }
        });
    } else if (reportData.orders_detail && Array.isArray(reportData.orders_detail)) {
        reportData.orders_detail.forEach(order => {
            if (['delivered', 'completed'].includes(order.status) || order.payment_status === 'paid') {
                const method = String(order.payment_method_display || order.payment_method || '').toLowerCase();
                const total = parseFloat(order.total_amount || order.total || 0);
                if (method.includes('efectivo') || method === 'cash') {
                    paymentStats.efectivo += total;
                } else if (method.includes('transferencia') || method.includes('transfer')) {
                    paymentStats.transferencia += total;
                } else if (method.includes('tarjeta') || method.includes('card')) {
                    paymentStats.tarjeta += total;
                }
            }
        });
    }

    const handlePrintCaja = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;
        const MARGIN = 15;

        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('Cuadre de Caja', pageWidth / 2, y, { align: 'center' });
        
        y += 15;
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`Turno: ${shift_info.number}`, MARGIN, y);
        y += 8;
        doc.text(`Encargado: ${shift_info.user}`, MARGIN, y);
        y += 8;
        doc.text(`Apertura: ${new Date(shift_info.opened_at).toLocaleString()}`, MARGIN, y);
        y += 8;
        doc.text(`Cierre: ${shift_info.closed_at ? new Date(shift_info.closed_at).toLocaleString() : 'En curso'}`, MARGIN, y);
        
        y += 15;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Detalle de Cuadre', MARGIN, y);
        y += 10;
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text('Efectivo Inicial:', MARGIN, y);
        doc.text(formatCurrency(openingCash), pageWidth - MARGIN, y, { align: 'right' });
        y += 8;
        
        doc.text('Ventas del Turno (Efectivo):', MARGIN, y);
        doc.text(formatCurrency(paymentStats.efectivo), pageWidth - MARGIN, y, { align: 'right' });
        y += 8;
        
        doc.text('Ventas del Turno (Transferencia):', MARGIN, y);
        doc.text(formatCurrency(paymentStats.transferencia), pageWidth - MARGIN, y, { align: 'right' });
        y += 8;

        doc.text('Ventas del Turno (Tarjeta):', MARGIN, y);
        doc.text(formatCurrency(paymentStats.tarjeta), pageWidth - MARGIN, y, { align: 'right' });
        y += 8;
        
        doc.text('Gastos (Egresos):', MARGIN, y);
        doc.setTextColor(220, 53, 69); // Rojo
        doc.text(`-${formatCurrency(totalExpenses)}`, pageWidth - MARGIN, y, { align: 'right' });
        doc.setTextColor(0, 0, 0); // Reset color
        y += 8;
        
        doc.setFont(undefined, 'bold');
        doc.text('Efectivo Físico Final:', MARGIN, y);
        doc.text(formatCurrency(closingCash), pageWidth - MARGIN, y, { align: 'right' });
        
        y += 15;
        doc.setFontSize(14);
        doc.text('Total General de Ventas (Todos los métodos)', MARGIN, y);
        y += 10;
        doc.setFontSize(16);
        doc.text(formatCurrency(totalSales), MARGIN, y);
        
        if (shift_info.opening_notes || shift_info.closing_notes) {
            y += 15;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text('Notas', MARGIN, y);
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            if (shift_info.opening_notes) {
                y += 8;
                doc.text(`Apertura: ${shift_info.opening_notes}`, MARGIN, y);
            }
            if (shift_info.closing_notes) {
                y += 8;
                doc.text(`Cierre: ${shift_info.closing_notes}`, MARGIN, y);
            }
        }
        
        doc.save(`Cuadre_Caja_${shift_info.number}.pdf`);
    };

    const handlePrintVentas = () => {
        generateDetailedPDF(reportData, 'Reporte de Ventas', `Turno #${shift_info.number}`);
    };

    const styles = {
        container: { fontFamily: 'inherit' },
        headerActions: { display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e9ecef' },
        titleBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
        buttonGroup: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
        titleInfo: { fontSize: '1.1rem', fontWeight: '600', color: '#1a1a2e', marginBottom: '0.75rem' },
        textRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#495057' },
        textTotal: { display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #ced4da', fontWeight: '700', color: '#1a1a2e' },
        section: { backgroundColor: '#f8f9fa', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' },
        btnPDFCaja: { 
            backgroundColor: 'var(--primary-color)', color: '#fff', border: 'none', padding: '0.6rem 1rem', 
            borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1'
        },
        btnPDFVentas: { 
            backgroundColor: 'var(--secondary-color)', color: 'var(--primary-color)', border: 'none', padding: '0.6rem 1rem', 
            borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.headerActions}>
                <div style={styles.titleBar}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1a1a2e' }}>Turno: {shift_info.number}</h2>
                </div>
                <div style={styles.buttonGroup}>
                    <button onClick={handlePrintCaja} style={styles.btnPDFCaja}>
                        <i className="bi bi-printer"></i> Reporte de Caja
                    </button>
                    <button onClick={handlePrintVentas} style={styles.btnPDFVentas}>
                        <i className="bi bi-receipt"></i> Reporte de Ventas
                    </button>
                </div>
            </div>

            <div style={styles.section}>
                <h3 style={styles.titleInfo}>Información General</h3>
                <div style={styles.textRow}><span>Encargado:</span> <strong>{shift_info.user}</strong></div>
                <div style={styles.textRow}><span>Apertura:</span> <span>{new Date(shift_info.opened_at).toLocaleString()}</span></div>
                <div style={styles.textRow}><span>Cierre:</span> <span>{shift_info.closed_at ? new Date(shift_info.closed_at).toLocaleString() : 'En curso'}</span></div>
            </div>

            <div style={{ backgroundColor: 'var(--secondary-color)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h3 style={{ ...styles.titleInfo, color: 'var(--primary-color)' }}>Cuadre de Caja</h3>
                <div style={styles.textRow}>
                    <span style={{ color: 'var(--primary-color)' }}>Efectivo Inicial:</span> 
                    <span style={{ fontWeight: '500', color: 'var(--primary-color)' }}>${openingCash.toFixed(2)}</span>
                </div>
                <div style={styles.textRow}>
                    <span style={{ color: 'var(--primary-color)' }}>Ventas del Turno (Efectivo):</span> 
                    <span style={{ fontWeight: '500', color: 'var(--primary-color)' }}>${paymentStats.efectivo.toFixed(2)}</span>
                </div>
                <div style={styles.textRow}>
                    <span style={{ color: 'var(--primary-color)' }}>Ventas del Turno (Transferencia):</span> 
                    <span style={{ fontWeight: '500', color: 'var(--primary-color)' }}>${paymentStats.transferencia.toFixed(2)}</span>
                </div>
                <div style={styles.textRow}>
                    <span style={{ color: 'var(--primary-color)' }}>Ventas del Turno (Tarjeta):</span> 
                    <span style={{ fontWeight: '500', color: 'var(--primary-color)' }}>${paymentStats.tarjeta.toFixed(2)}</span>
                </div>
                <div style={styles.textRow}>
                    <span style={{ color: 'var(--primary-color)' }}>Gastos (Egresos):</span> 
                    <span style={{ fontWeight: '500', color: 'var(--danger-color)' }}>-${totalExpenses.toFixed(2)}</span>
                </div>
                
                <div style={{ ...styles.textTotal, borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}>
                    <span>Efectivo Físico Final:</span> 
                    <span style={{ fontSize: '1.1rem' }}>${closingCash.toFixed(2)}</span>
                </div>
            </div>

            <div style={styles.section}>
                <h3 style={styles.titleInfo}>Total General de Ventas (Todos los métodos)</h3>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-color)', textAlign: 'center' }}>
                    ${totalSales.toFixed(2)}
                </div>
            </div>
            
            {(shift_info.opening_notes || shift_info.closing_notes) && (
                <div style={{ ...styles.section, backgroundColor: '#fff3cd' }}>
                    <h3 style={{ ...styles.titleInfo, color: '#664d03' }}>Notas</h3>
                    {shift_info.opening_notes && <div style={{ marginBottom: '0.5rem', color: '#664d03' }}><strong>Apertura:</strong> {shift_info.opening_notes}</div>}
                    {shift_info.closing_notes && <div style={{ color: '#664d03' }}><strong>Cierre:</strong> {shift_info.closing_notes}</div>}
                </div>
            )}
        </div>
    );
};

export default ReporteCaja;

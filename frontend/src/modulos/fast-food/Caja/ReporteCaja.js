import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import jsPDF from 'jspdf';
import { formatCurrency, generateDetailedPDF } from '../../../utils/reportUtils';
import printerService from '../../../services/printerService';

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
    const closingCash = parseFloat(shift_info.closing_cash || 0); // Este closingCash puede incluir transferencias si fue caja ciega
    const totalSales = parseFloat(reportData.total_sales || 0);
    const totalExpenses = parseFloat(reportData.total_expenses || 0);
    const expensesList = reportData.expenses || [];

    // Desglose de métodos de pago (Sistema)
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

    // EXTRAER TRANSFERENCIAS Y TARJETAS FÍSICAS DE LAS NOTAS (Caja Ciega)
    let transferenciasFisico = 0;
    if (shift_info.closing_notes) {
        if (shift_info.closing_notes.includes('Transferencias: $')) {
            const matchT = shift_info.closing_notes.match(/Transferencias:\s*\$?([\d.]+)/);
            if (matchT) {
                transferenciasFisico = parseFloat(matchT[1]);
            }
        }
    }

    const efectivoTotalBruto = openingCash + paymentStats.efectivo;
    const efectivoFisico = closingCash - transferenciasFisico; 
    const sobranteBruto = efectivoFisico - efectivoTotalBruto;
    const efectivoEsperadoFinal = efectivoTotalBruto;
    const sobranteEfectivo = efectivoFisico - efectivoEsperadoFinal;
    
    const transferenciasSistema = paymentStats.transferencia;
    const sobranteTransferencia = transferenciasFisico - transferenciasSistema;

    const handlePrintCaja = async () => {
        const chars_per_line = 42;
        let lines = [];
        
        const center = (text) => {
            const padding = Math.max(0, Math.floor((chars_per_line - text.length) / 2));
            return ' '.repeat(padding) + text;
        };
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
        lines.push(rightAlign("Efectivo Inicial Base:", `$${openingCash.toFixed(2)}`));
        lines.push(rightAlign("Ventas en efec. sist.:", `$${paymentStats.efectivo.toFixed(2)}`));
        lines.push(rightAlign("Total Efectivo Esperado:", `$${efectivoEsperadoFinal.toFixed(2)}`));
        lines.push("-".repeat(chars_per_line));
        lines.push(rightAlign("Efectivo Físico Caja:", `$${efectivoFisico.toFixed(2)}`));
        const sobEfStr = sobranteEfectivo >= 0 ? `+$${sobranteEfectivo.toFixed(2)}` : `-$${Math.abs(sobranteEfectivo).toFixed(2)}`;
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

        try {
            await printerService.printCustomTicket(ticketContent, 'report');
        } catch (error) {
            alert('Error al enviar impresión. Revisa la consola para más detalles.');
        }
    };

    const handleDownloadPDFCaja = () => {
        const tempDoc = new jsPDF();
        tempDoc.setFontSize(9);
        const closingLines = shift_info.closing_notes ? tempDoc.splitTextToSize(`Cierre: ${shift_info.closing_notes}`, 70) : [];
        const openingLines = shift_info.opening_notes ? tempDoc.splitTextToSize(`Apertura: ${shift_info.opening_notes}`, 70) : [];
        
        let estHeight = 140; 
        if (shift_info.opening_notes || shift_info.closing_notes || expensesList.length > 0) {
            estHeight += 10;
            if (expensesList.length > 0) {
                estHeight += 6 + (expensesList.length * 4) + 2;
            }
            if (shift_info.opening_notes) {
                estHeight += 6 + (openingLines.length * 4);
            }
            if (shift_info.closing_notes) {
                estHeight += 6 + (closingLines.length * 4);
            }
        }

        const doc = new jsPDF({ format: [80, estHeight + 10] });
        const pageWidth = 80;
        let y = 10;
        const MARGIN = 5;

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('REPORTE DE CAJA', pageWidth / 2, y, { align: 'center' });
        
        y += 8;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Turno: ${shift_info.number}`, MARGIN, y);
        y += 5;
        doc.text(`Encargado: ${shift_info.user || shift_info.manager_name}`, MARGIN, y);
        y += 5;
        doc.text(`Apertura: ${new Date(shift_info.opened_at).toLocaleString()}`, MARGIN, y);
        y += 5;
        doc.text(`Cierre: ${shift_info.closed_at ? new Date(shift_info.closed_at).toLocaleString() : 'En curso'}`, MARGIN, y);
        
        y += 8;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Detalle de Cuadre', MARGIN, y);
        y += 6;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        const addRow = (label, value, bold = false) => {
            if(bold) doc.setFont(undefined, 'bold');
            else doc.setFont(undefined, 'normal');
            doc.text(label, MARGIN, y);
            doc.text(value, pageWidth - MARGIN, y, { align: 'right' });
            y += 5;
        };

        addRow('Efectivo Inicial Base:', formatCurrency(openingCash));
        y += 2;
        addRow('Ventas en efec. sist.:', formatCurrency(paymentStats.efectivo));
        y += 2;
        addRow('Total Efectivo Esperado:', formatCurrency(efectivoEsperadoFinal), true);
        y += 2;
        addRow('Efectivo Físico Caja:', formatCurrency(efectivoFisico));
        doc.setTextColor(sobranteEfectivo >= 0 ? 40 : 220, sobranteEfectivo >= 0 ? 167 : 53, sobranteEfectivo >= 0 ? 69 : 69);
        addRow('SOBRANTE/FALTANTE EFEC.:', `${sobranteEfectivo >= 0 ? '+' : ''}${formatCurrency(sobranteEfectivo)}`);
        doc.setTextColor(0, 0, 0);
        y += 4;

        addRow('Dinero en transf. sist.:', formatCurrency(transferenciasSistema));
        addRow('Dinero en transf. caja:', formatCurrency(transferenciasFisico));
        doc.setTextColor(sobranteTransferencia >= 0 ? 40 : 220, sobranteTransferencia >= 0 ? 167 : 53, sobranteTransferencia >= 0 ? 69 : 69);
        addRow('SOBRANTE/FALTANTE TRANS.:', `${sobranteTransferencia >= 0 ? '+' : ''}${formatCurrency(sobranteTransferencia)}`);
        doc.setTextColor(0, 0, 0);
        y += 4;


        y += 8;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Total Gral. de Ventas (Sistema)', MARGIN, y);
        y += 6;
        doc.setFontSize(14);
        doc.text(formatCurrency(totalSales), MARGIN, y);
        
        if (shift_info.opening_notes || shift_info.closing_notes || expensesList.length > 0) {
            y += 10;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.text('Detalles Adicionales', MARGIN, y);
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            
            if (expensesList.length > 0) {
                y += 6;
                doc.setFont(undefined, 'bold');
                doc.text('Desglose de Gastos:', MARGIN, y);
                doc.setFont(undefined, 'normal');
                expensesList.forEach(exp => {
                    y += 4;
                    doc.text(`- ${exp.description.substring(0,25)}: ${formatCurrency(exp.amount)}`, MARGIN + 2, y);
                });
                y += 2;
            }

            if (shift_info.opening_notes) {
                y += 6;
                doc.text(openingLines, MARGIN, y);
                y += openingLines.length * 4;
            }
            if (shift_info.closing_notes) {
                y += 6;
                doc.text(closingLines, MARGIN, y);
                y += closingLines.length * 4;
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
        btnDownloadPDFCaja: { 
            backgroundColor: '#0d6efd', color: '#fff', border: 'none', padding: '0.6rem 1rem', 
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
                    <button onClick={handleDownloadPDFCaja} style={styles.btnDownloadPDFCaja}>
                        <i className="bi bi-file-pdf"></i> PDF de Caja
                    </button>
                    <button onClick={handlePrintVentas} style={styles.btnPDFVentas}>
                        <i className="bi bi-file-pdf"></i> PDF de Ventas
                    </button>
                    <button onClick={handlePrintCaja} style={styles.btnPDFCaja}>
                        <i className="bi bi-printer"></i> Imprimir Ticket
                    </button>
                </div>
            </div>

            <div style={styles.section}>
                <h3 style={styles.titleInfo}>Información General</h3>
                <div style={styles.textRow}><span>Encargado:</span> <strong>{shift_info.user || shift_info.manager_name}</strong></div>
                <div style={styles.textRow}><span>Apertura:</span> <span>{new Date(shift_info.opened_at).toLocaleString()}</span></div>
                <div style={styles.textRow}><span>Cierre:</span> <span>{shift_info.closed_at ? new Date(shift_info.closed_at).toLocaleString() : 'En curso'}</span></div>
            </div>

            {/* SECCIÓN DE EFECTIVO */}
            <div style={{ backgroundColor: '#e3f2fd', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h3 style={{ ...styles.titleInfo, color: '#0d47a1' }}>Efectivo</h3>
                <div style={styles.textRow}>
                    <span>Efectivo Inicial:</span> 
                    <span>${openingCash.toFixed(2)}</span>
                </div>
                <div style={styles.textRow}>
                    <span>Ventas del Turno:</span> 
                    <span>${paymentStats.efectivo.toFixed(2)}</span>
                </div>
                <div style={{ ...styles.textTotal, borderColor: '#0d47a1', color: '#0d47a1', fontSize: '1.1rem' }}>
                    <span>Total Efectivo Esperado:</span> 
                    <span>${efectivoEsperadoFinal.toFixed(2)}</span>
                </div>
                <div style={{ ...styles.textTotal, borderColor: '#0d47a1', color: '#0d47a1', fontSize: '1.1rem', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    <span>Efectivo Físico (Contado):</span> 
                    <span>${efectivoFisico.toFixed(2)}</span>
                </div>
                <div style={{ ...styles.textTotal, border: 'none', color: sobranteEfectivo >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '1.1rem', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    <span>SOBRANTE / FALTANTE EFEC.:</span> 
                    <span>{sobranteEfectivo >= 0 ? '+' : ''}${sobranteEfectivo.toFixed(2)}</span>
                </div>
            </div>

            {/* SECCIÓN DE TRANSFERENCIAS */}
            <div style={{ backgroundColor: '#e8f5e9', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h3 style={{ ...styles.titleInfo, color: '#1b5e20' }}>Transferencias</h3>
                <div style={{ ...styles.textRow, fontWeight: 'bold' }}>
                    <span>Transferencias en Sistema:</span> 
                    <span>${transferenciasSistema.toFixed(2)}</span>
                </div>
                <div style={{ ...styles.textRow, fontWeight: 'bold' }}>
                    <span>Transferencias en Físico (Contado):</span> 
                    <span>${transferenciasFisico.toFixed(2)}</span>
                </div>
                <div style={{ ...styles.textRow, fontWeight: 'bold', color: sobranteTransferencia >= 0 ? '#1b5e20' : 'var(--danger-color)' }}>
                    <span>Sobrante / Faltante Transferencias:</span> 
                    <span>{sobranteTransferencia >= 0 ? '+' : ''}${sobranteTransferencia.toFixed(2)}</span>
                </div>
            </div>

            <div style={styles.section}>
                <h3 style={styles.titleInfo}>Total General de Ventas (Todos los métodos)</h3>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-color)', textAlign: 'center' }}>
                    ${totalSales.toFixed(2)}
                </div>
            </div>

            {/* GASTOS */}
            {expensesList.length > 0 && (
                <div style={styles.section}>
                    <h3 style={styles.titleInfo}>Detalle de Gastos</h3>
                    {expensesList.map(exp => (
                        <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #dee2e6' }}>
                            <span style={{ color: '#495057' }}>{exp.description} <br/><small style={{color: '#6c757d'}}>{new Date(exp.created_at).toLocaleTimeString()}</small></span>
                            <span style={{ fontWeight: '600', color: 'var(--danger-color)' }}>${parseFloat(exp.amount).toFixed(2)}</span>
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontWeight: 'bold' }}>
                        <span>TOTAL GASTOS</span>
                        <span style={{ color: 'var(--danger-color)' }}>${totalExpenses.toFixed(2)}</span>
                    </div>
                </div>
            )}
            
            {/* NOTAS */}
            {(shift_info.opening_notes || shift_info.closing_notes) && (
                <div style={{ ...styles.section, backgroundColor: '#fff3cd' }}>
                    <h3 style={{ ...styles.titleInfo, color: '#664d03' }}>Notas</h3>
                    {shift_info.opening_notes && <div style={{ marginBottom: '0.5rem', color: '#664d03' }}><strong>Apertura:</strong> {shift_info.opening_notes}</div>}
                    {shift_info.closing_notes && <div style={{ color: '#664d03', whiteSpace: 'pre-wrap' }}><strong>Cierre:</strong><br/>{shift_info.closing_notes}</div>}
                </div>
            )}
        </div>
    );
};

export default ReporteCaja;

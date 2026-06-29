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
    const totalSales = parseFloat(reportData.summary?.total_sales || reportData.total_sales || 0);
    const totalExpenses = parseFloat(reportData.summary?.total_expenses || reportData.total_expenses || 0);
    const expensesList = reportData.expenses || [];

    // Desglose de métodos de pago (Sistema)
    let paymentStats = {
        efectivo: 0,
        transferencia: 0,
        tarjeta: 0
    };
    let cancelledStats = { count: 0, total: 0 };
    let employeeStats = { count: 0, total: 0 };
    
    if (reportData.orders_detail && Array.isArray(reportData.orders_detail)) {
        reportData.orders_detail.forEach(order => {
            if (['cancelled'].includes(order.status) || order.status_display?.toLowerCase() === 'anulada') {
                cancelledStats.count += 1;
                cancelledStats.total += parseFloat(order.total_amount || order.total || 0);
            } else if (order.notes && order.notes.includes('[VENTA_EMPLEADO]')) {
                employeeStats.count += 1;
                employeeStats.total += parseFloat(order.total_amount || order.total || 0);
            }
        });
    }

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

    // EXTRAER TRANSFERENCIAS Y EFECTIVO FÍSICO DE LAS NOTAS (Caja Ciega)
    let transferenciasFisico = 0;
    let efectivoFisicoDeclarado = closingCash;
    if (shift_info.closing_notes) {
        // Formato antiguo
        if (shift_info.closing_notes.includes('Transferencias: $')) {
            const matchT = shift_info.closing_notes.match(/Transferencias:\s*\$?([\d.]+)/);
            if (matchT) {
                transferenciasFisico = parseFloat(matchT[1]);
            }
            efectivoFisicoDeclarado = closingCash - transferenciasFisico;
        }
        // Formato nuevo
        if (shift_info.closing_notes.includes('FisicoTransferUSD=')) {
            const matchT = shift_info.closing_notes.match(/FisicoTransferUSD=([\d.]+)/);
            if (matchT) {
                transferenciasFisico = parseFloat(matchT[1]);
            }
            const matchE = shift_info.closing_notes.match(/FisicoEfectivoUSD=([\d.]+)/);
            if (matchE) {
                efectivoFisicoDeclarado = parseFloat(matchE[1]);
            } else {
                efectivoFisicoDeclarado = closingCash - transferenciasFisico;
            }
        }
    }

    const efectivoTotalBruto = openingCash + paymentStats.efectivo;
    const efectivoEsperadoFinal = efectivoTotalBruto - totalExpenses; 
    
    const sobranteEfectivo = efectivoFisicoDeclarado - efectivoEsperadoFinal;
    
    const transferenciasSistema = paymentStats.transferencia;
    const sobranteTransferencia = transferenciasFisico - transferenciasSistema;

    const handlePrintCaja = async () => {
        const countSales = reportData.orders_detail ? reportData.orders_detail.length : 0;
        const totalSales = parseFloat(reportData.total_sales || 0);

        const chars_per_line = 32;
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

        const formatRow3 = (label, count, amount) => {
            const countStr = `: ${count}`;
            const amountStr = `(${parseFloat(amount).toFixed(2)})`;
            let labelPad = label.length > 16 ? label.substring(0, 16) : label.padEnd(16, ' ');
            let countPad = countStr.length > 6 ? countStr.substring(0, 6) : countStr.padEnd(6, ' ');
            let amountPad = amountStr.padStart(10, ' ');
            return labelPad + countPad + amountPad;
        };

        const current_time = new Date();
        const pad0 = (n) => n.toString().padStart(2, '0');
        const dateStr = `${current_time.getFullYear()}-${pad0(current_time.getMonth()+1)}-${pad0(current_time.getDate())} ${pad0(current_time.getHours())}:${pad0(current_time.getMinutes())}:${pad0(current_time.getSeconds())}`;
        
        lines.push(center("CIERRE DE CAJA"));
        lines.push(center(`#${shift_info.number}`));
        lines.push(center(dateStr));
        lines.push(center(`USUARIO: ${shift_info.user || shift_info.manager_name}`));
        lines.push("");

        if (expensesList.length > 0) {
            lines.push(center("GASTOS DE CAJA"));
            expensesList.forEach(exp => {
                const desc = "- " + exp.description;
                const val = `-${parseFloat(exp.amount).toFixed(2)}`;
                const maxDescLen = chars_per_line - val.length - 1;
                const truncatedDesc = desc.length > maxDescLen ? desc.substring(0, maxDescLen) : desc;
                lines.push(rightAlign(truncatedDesc, val));
            });
            lines.push("-".repeat(chars_per_line));
        }

        lines.push(center("RESUMEN DEL CIERRE"));
        lines.push("-".repeat(chars_per_line));
        
        lines.push(formatRow3("TOTAL VENTAS", countSales, totalSales));
        lines.push(formatRow3("VENTAS ANULADAS", cancelledStats.count, cancelledStats.total));
        lines.push("-".repeat(chars_per_line));
        
        lines.push(rightAlign("EFECTIVO", paymentStats.efectivo.toFixed(2)));
        lines.push(rightAlign("TRANSFERENCIA", paymentStats.transferencia.toFixed(2)));
        lines.push("-".repeat(chars_per_line));
        
        lines.push(formatRow3("TOTAL GASTOS", expensesList.length, `-${totalExpenses.toFixed(2)}`));
        lines.push(formatRow3("TOTAL INGRESOS", 0, "0.00"));
        lines.push(formatRow3("OTROS/EXTRAS", 0, "0.00"));
        lines.push("");

        lines.push(center("CAJA"));
        lines.push("-".repeat(chars_per_line));
        
        lines.push("[EFECTIVO]");
        lines.push(rightAlign("SISTEMA", efectivoTotalBruto.toFixed(2)));
        if (totalExpenses > 0) {
            lines.push(rightAlign("- GASTOS", totalExpenses.toFixed(2)));
            lines.push(rightAlign("ESPERADO", efectivoEsperadoFinal.toFixed(2)));
        }
        lines.push(rightAlign("CONTEO FISICO", efectivoFisicoDeclarado.toFixed(2)));
        lines.push(rightAlign("DIFERENCIA", sobranteEfectivo.toFixed(2)));
        lines.push("");

        lines.push("[TRANSFERENCIA]");
        lines.push(rightAlign("SISTEMA", transferenciasSistema.toFixed(2)));
        lines.push(rightAlign("CONTEO FISICO", transferenciasFisico.toFixed(2)));
        lines.push(rightAlign("DIFERENCIA", sobranteTransferencia.toFixed(2)));
        lines.push("");

        const totalSistema = efectivoEsperadoFinal + transferenciasSistema;
        const totalConteo = efectivoFisicoDeclarado + transferenciasFisico;
        const totalDiferencia = sobranteEfectivo + sobranteTransferencia;

        lines.push("RESUMEN:");
        lines.push(rightAlign("SISTEMA", totalSistema.toFixed(2)));
        lines.push(rightAlign("CONTEO FISICO", totalConteo.toFixed(2)));
        lines.push(rightAlign("DIFERENCIA", totalDiferencia.toFixed(2)));
        lines.push("");

        if (shift_info.closing_notes) {
            if (shift_info.closing_notes.includes('Cierre Ciego')) {
                lines.push(center("Conteo de monedas y billetes:"));
                let notesText = shift_info.closing_notes.replace('Cierre Ciego. Desglose:\n', '');
                const notesLines = notesText.split('\n');
                notesLines.forEach(nLine => {
                    if (nLine.length === 0) lines.push('');
                    for(let i=0; i<nLine.length; i+=chars_per_line) {
                        lines.push(nLine.substring(i, i+chars_per_line));
                    }
                });
            } else {
                lines.push("NOTAS DE CIERRE:");
                const notesLines = shift_info.closing_notes.split('\n');
                notesLines.forEach(nLine => {
                    if (nLine.length === 0) lines.push('');
                    for(let i=0; i<nLine.length; i+=chars_per_line) {
                        lines.push(nLine.substring(i, i+chars_per_line));
                    }
                });
            }
            lines.push("-".repeat(chars_per_line));
        }

        const ticketContent = lines.join("\n");

        try {
            await printerService.printCustomTicket(ticketContent, 'report');
        } catch (error) {
            alert('Error al enviar impresión. Revisa la consola para más detalles.');
        }
    };

    const handleDownloadPDFCaja = () => {
        const countSales = reportData.orders_detail ? reportData.orders_detail.length : 0;
        const totalSales = parseFloat(reportData.total_sales || 0);

        const chars_per_line = 54;
        let lines = [];
        const center = (text) => ' '.repeat(Math.max(0, Math.floor((chars_per_line - text.length) / 2))) + text;
        const rightAlign = (label, value) => {
            const valueStr = String(value);
            const padding = Math.max(0, chars_per_line - label.length - valueStr.length);
            return label + ' '.repeat(padding) + valueStr;
        };
        const formatRow3 = (label, count, amount) => {
            const countStr = `: ${count}`;
            const amountStr = `(${parseFloat(amount).toFixed(2)})`;
            const labelPad = label.padEnd(22, ' ');
            const countPad = countStr.padEnd(12, ' ');
            const amountPad = amountStr.padStart(20, ' ');
            return labelPad + countPad + amountPad;
        };

        const current_time = new Date();
        const pad0 = (n) => n.toString().padStart(2, '0');
        const dateStr = `${current_time.getFullYear()}-${pad0(current_time.getMonth()+1)}-${pad0(current_time.getDate())} ${pad0(current_time.getHours())}:${pad0(current_time.getMinutes())}:${pad0(current_time.getSeconds())}`;
        
        lines.push(center(`CIERRE DE CAJA #${shift_info.number}`));
        lines.push(center(dateStr));
        lines.push(center(`USUARIO: ${shift_info.user || shift_info.manager_name}`));
        lines.push("");

        if (expensesList.length > 0) {
            lines.push(center("GASTOS DE CAJA"));
            expensesList.forEach(exp => {
                const desc = "- " + exp.description;
                lines.push(rightAlign(desc.length > 30 ? desc.substring(0, 30) : desc, `-${parseFloat(exp.amount).toFixed(2)}`));
            });
            lines.push("-".repeat(chars_per_line));
        }

        lines.push(center("RESUMEN DEL CIERRE"));
        lines.push("-".repeat(chars_per_line));
        
        lines.push(formatRow3("TOTAL VENTAS", countSales, totalSales));
        lines.push(formatRow3("VENTAS ANULADAS", cancelledStats.count, cancelledStats.total));
        lines.push("-".repeat(chars_per_line));
        
        lines.push(rightAlign("EFECTIVO", paymentStats.efectivo.toFixed(2)));
        lines.push(rightAlign("TRANSFERENCIA", paymentStats.transferencia.toFixed(2)));
        lines.push("-".repeat(chars_per_line));
        
        lines.push(formatRow3("TOTAL GASTOS", expensesList.length, `-${totalExpenses.toFixed(2)}`));
        lines.push(formatRow3("TOTAL INGRESOS", 0, "0.00"));
        lines.push(formatRow3("TOTAL OTROS/EXTRAS", 0, "0.00"));
        lines.push("");

        lines.push(center("CAJA"));
        lines.push("-".repeat(chars_per_line));
        
        lines.push("[EFECTIVO]");
        lines.push(rightAlign("SISTEMA", efectivoTotalBruto.toFixed(2)));
        if (totalExpenses > 0) {
            lines.push(rightAlign("- GASTOS", totalExpenses.toFixed(2)));
            lines.push(rightAlign("ESPERADO", efectivoEsperadoFinal.toFixed(2)));
        }
        lines.push(rightAlign("CONTEO FISICO", efectivoFisicoDeclarado.toFixed(2)));
        lines.push(rightAlign("DIFERENCIA", sobranteEfectivo.toFixed(2)));
        lines.push("");

        lines.push("[TRANSFERENCIA]");
        lines.push(rightAlign("SISTEMA", transferenciasSistema.toFixed(2)));
        lines.push(rightAlign("CONTEO FISICO", transferenciasFisico.toFixed(2)));
        lines.push(rightAlign("DIFERENCIA", sobranteTransferencia.toFixed(2)));
        lines.push("");

        const totalSistema = efectivoEsperadoFinal + transferenciasSistema;
        const totalConteo = efectivoFisicoDeclarado + transferenciasFisico;
        const totalDiferencia = sobranteEfectivo + sobranteTransferencia;

        lines.push("RESUMEN:");
        lines.push(rightAlign("SISTEMA", totalSistema.toFixed(2)));
        lines.push(rightAlign("CONTEO FISICO", totalConteo.toFixed(2)));
        lines.push(rightAlign("DIFERENCIA", totalDiferencia.toFixed(2)));
        lines.push("");

        if (shift_info.closing_notes) {
            lines.push("NOTAS DE CIERRE:");
            const shortNotes = shift_info.closing_notes.split('---')[0].trim();
            if (shortNotes) {
                const noteLines = shortNotes.split('\n');
                noteLines.forEach(l => {
                    if (!l.includes('COP') && !l.includes('[CIERRE_CIEGO_V2]')) {
                        lines.push(l);
                    }
                });
            }
            
            const parts = shift_info.closing_notes.split('---');
            if (parts.length > 1) {
                const cierreCiegoDetalle = parts[1];
                lines.push("-".repeat(chars_per_line));
                const detLines = cierreCiegoDetalle.split('\n');
                let horiz = [];
                detLines.forEach(l => {
                    const match = l.match(/([^:]+):\s*(\d+)/);
                    if (match && !l.includes('USD') && !l.includes('COP') && !l.includes('Fisico')) {
                        let name = match[1].trim().replace('Billetes de ', 'B.');
                        horiz.push(`${name}=${match[2]}`);
                    }
                });
                if (horiz.length > 0) {
                    lines.push("DETALLE DE MONEDAS:");
                    let outLine = "";
                    horiz.forEach(item => {
                        if ((outLine + item).length > chars_per_line) {
                            lines.push(outLine.trim());
                            outLine = "";
                        }
                        outLine += item + "  ";
                    });
                    if (outLine) lines.push(outLine.trim());
                }
            }
        }

        const lineSpacing = 3.5;
        const docHeight = Math.max(60, (lines.length * lineSpacing) + 15);
        const doc = new jsPDF({ format: [80, docHeight] });
        doc.setFont('courier', 'normal');
        doc.setFontSize(6.6);
        
        let y = 10;
        lines.forEach(line => {
            doc.text(line, 2, y);
            y += lineSpacing;
        });

        doc.save(`Cierre_Caja_${shift_info.number}.pdf`);
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
                {totalExpenses > 0 && (
                    <div style={styles.textRow}>
                        <span>Gastos (Egresos):</span> 
                        <span style={{ color: 'var(--danger-color)' }}>-${totalExpenses.toFixed(2)}</span>
                    </div>
                )}
                <div style={{ ...styles.textTotal, borderColor: '#0d47a1', color: '#0d47a1', fontSize: '1.1rem' }}>
                    <span>Total Efectivo Esperado:</span> 
                    <span>${efectivoEsperadoFinal.toFixed(2)}</span>
                </div>
                
                <div style={{ ...styles.textRow, marginTop: '1rem' }}>
                    <span>Efec. Físico (Cajero):</span> 
                    <span>${efectivoFisicoDeclarado.toFixed(2)}</span>
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

            {/* SECCIÓN DE VENTAS ANULADAS */}
            <div style={{ backgroundColor: '#fee2e2', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h3 style={{ ...styles.titleInfo, color: '#991b1b' }}>Ventas Anuladas</h3>
                <div style={{ ...styles.textRow, fontWeight: 'bold' }}>
                    <span>Cantidad de Ventas Anuladas:</span> 
                    <span>{cancelledStats.count}</span>
                </div>
                <div style={{ ...styles.textRow, fontWeight: 'bold', color: '#991b1b' }}>
                    <span>Total Ventas Anuladas:</span> 
                    <span>${cancelledStats.total.toFixed(2)}</span>
                </div>
            </div>

            {/* SECCIÓN DE VENTAS A EMPLEADOS */}
            <div style={{ backgroundColor: '#e0e7ff', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h3 style={{ ...styles.titleInfo, color: '#3730a3' }}>Ventas a Empleados</h3>
                <div style={{ ...styles.textRow, fontWeight: 'bold' }}>
                    <span>Cantidad de Ventas:</span> 
                    <span>{employeeStats.count}</span>
                </div>
                <div style={{ ...styles.textRow, fontWeight: 'bold', color: '#3730a3' }}>
                    <span>Total Ventas:</span> 
                    <span>${employeeStats.total.toFixed(2)}</span>
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

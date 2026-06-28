import React, { useState, useEffect, useCallback, useContext } from 'react';
import api from '../../../services/api';
import Modal from '../../../comun/Modal';
import ReporteCaja from './ReporteCaja'; 
import { AuthContext } from '../../../context/AuthContext';
import printerService from '../../../services/printerService';

const PanelCaja = () => {
    const { user } = useContext(AuthContext);
    const roleName = user?.role_details?.name;
    const isAdmin = true; // Habilitado todo lo de caja para todos los usuarios
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
    const [expenseCurrency, setExpenseCurrency] = useState('COP');

    const [selectedShiftId, setSelectedShiftId] = useState(null);

    const [blindCashCounts, setBlindCashCounts] = useState({
        c1: '', c5: '', c10: '', c25: '', c50: '', d1: '',
        b5: '', b10: '', b20: '', b50: '', b100: '',
        transfer_usd: '',
        cop_m50: '', cop_m100: '', cop_m200: '', cop_m500: '', cop_m1000: '',
        cop_b2000: '', cop_b5000: '', cop_b10000: '', cop_b20000: '', cop_b50000: '', cop_b100000: '',
        transfer_cop: ''
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

            let paymentStats = { efectivo: 0, transferencia: 0, tarjeta: 0, efectivo_usd: 0, transferencia_usd: 0 };
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
                    if (method === 'efectivo_dolares') paymentStats.efectivo_usd += amount;
                    else if (method === 'transferencia_dolares') paymentStats.transferencia_usd += amount;
                    else if (method.includes('efectivo') || method === 'cash') paymentStats.efectivo += amount;
                    else if (method.includes('transferencia') || method.includes('transfer')) paymentStats.transferencia += amount;
                    else if (method.includes('tarjeta') || method.includes('card')) paymentStats.tarjeta += amount;
                });
            } else if (reportData.orders_detail && Array.isArray(reportData.orders_detail)) {
                reportData.orders_detail.forEach(order => {
                    if (['delivered', 'completed'].includes(order.status) || order.payment_status === 'paid') {
                        const method = String(order.payment_method_display || order.payment_method || '').toLowerCase();
                        const total = parseFloat(order.total_amount || order.total || 0);
                        if (method === 'efectivo_dolares') paymentStats.efectivo_usd += total;
                        else if (method === 'transferencia_dolares') paymentStats.transferencia_usd += total;
                        else if (method.includes('efectivo') || method === 'cash') paymentStats.efectivo += total;
                        else if (method.includes('transferencia') || method.includes('transfer')) paymentStats.transferencia += total;
                        else if (method.includes('tarjeta') || method.includes('card')) paymentStats.tarjeta += total;
                    }
                });
            }

            let transferenciasFisico = 0;
            let fisicoEfectivoUSD = 0, fisicoTransferUSD = 0, fisicoEfectivoCOP = 0, fisicoTransferCOP = 0;
            let isCierreCiegoV2 = false;
            let cierreCiegoDetalle = "";

            if (shift_info.closing_notes) {
                if (shift_info.closing_notes.includes('[CIERRE_CIEGO_V2]')) {
                    isCierreCiegoV2 = true;
                    const noteLines = shift_info.closing_notes.split('\n');
                    noteLines.forEach(l => {
                        if (l.startsWith('FisicoEfectivoUSD=')) fisicoEfectivoUSD = parseFloat(l.split('=')[1]);
                        if (l.startsWith('FisicoTransferUSD=')) fisicoTransferUSD = parseFloat(l.split('=')[1]);
                        if (l.startsWith('FisicoEfectivoCOP=')) fisicoEfectivoCOP = parseFloat(l.split('=')[1]);
                        if (l.startsWith('FisicoTransferCOP=')) fisicoTransferCOP = parseFloat(l.split('=')[1]);
                    });
                    const parts = shift_info.closing_notes.split('---\n');
                    if (parts.length > 1) {
                        cierreCiegoDetalle = parts[1];
                    }
                } else if (shift_info.closing_notes.includes('Transferencias: $')) {
                    const matchT = shift_info.closing_notes.match(/Transferencias:\s*\$?([\d.]+)/);
                    if (matchT) transferenciasFisico = parseFloat(matchT[1]);
                }
            }

            const efectivoTotalBruto = openingCashVal + paymentStats.efectivo;
            const efectivoEsperadoFinal = efectivoTotalBruto;
            const efectivoFisicoDeclarado = closingCashVal - transferenciasFisico;
            const sobranteEfectivo = efectivoFisicoDeclarado - efectivoEsperadoFinal;
            const transferenciasSistema = paymentStats.transferencia;
            const sobranteTransferencia = transferenciasFisico - transferenciasSistema;

            const exchangeRate = parseFloat(localStorage.getItem('usdExchangeRate')) || 4000;
            const dolaresEfectivoSistema = paymentStats.efectivo_usd / exchangeRate;
            const dolaresTransferenciaSistema = paymentStats.transferencia_usd / exchangeRate;

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
            
            lines.push(formatRow3("TOTAL GASTOS", expensesList.length, `-${totalExpensesVal.toFixed(2)}`));
            lines.push(formatRow3("TOTAL INGRESOS", 0, "0.00"));
            lines.push(formatRow3("TOTAL OTROS/EXTRAS", 0, "0.00"));
            lines.push("");

            lines.push(center("-------DESGLOCE TRIBUTARIO VENTAS-------"));
            lines.push(formatRow3("NOTAS DE ENTREGA", countSales, totalSales));
            lines.push(formatRow3("FACTURAS", 0, "0.00"));
            lines.push(rightAlign("      BASE 0% :", totalSales.toFixed(2)));
            lines.push(rightAlign("      BASE IVA :", "0.00"));
            lines.push(rightAlign("      IVA :", "0.00"));
            lines.push(rightAlign("      TOTAL :", totalSales.toFixed(2)));
            lines.push("");

            lines.push(center("CAJA"));
            lines.push("-".repeat(chars_per_line));
            
            if (isCierreCiegoV2) {
                // PESOS COP
                lines.push("[EFECTIVO COP]");
                lines.push(rightAlign("SISTEMA", efectivoEsperadoFinal.toFixed(2)));
                lines.push(rightAlign("CONTEO FISICO", fisicoEfectivoCOP.toFixed(2)));
                lines.push(rightAlign("DIFERENCIA", (fisicoEfectivoCOP - efectivoEsperadoFinal).toFixed(2)));
                lines.push("");

                lines.push("[TRANSFERENCIA COP]");
                lines.push(rightAlign("SISTEMA", transferenciasSistema.toFixed(2)));
                lines.push(rightAlign("CONTEO FISICO", fisicoTransferCOP.toFixed(2)));
                lines.push(rightAlign("DIFERENCIA", (fisicoTransferCOP - transferenciasSistema).toFixed(2)));
                lines.push("");

                // DOLARES USD
                lines.push("[EFECTIVO USD]");
                lines.push(rightAlign("SISTEMA", dolaresEfectivoSistema.toFixed(2)));
                lines.push(rightAlign("CONTEO FISICO", fisicoEfectivoUSD.toFixed(2)));
                lines.push(rightAlign("DIFERENCIA", (fisicoEfectivoUSD - dolaresEfectivoSistema).toFixed(2)));
                lines.push("");

                lines.push("[TRANSFERENCIA USD]");
                lines.push(rightAlign("SISTEMA", dolaresTransferenciaSistema.toFixed(2)));
                lines.push(rightAlign("CONTEO FISICO", fisicoTransferUSD.toFixed(2)));
                lines.push(rightAlign("DIFERENCIA", (fisicoTransferUSD - dolaresTransferenciaSistema).toFixed(2)));
                lines.push("");
                
                // RESUMEN GLOBAL (COP + USD convertido)
                const totalGlobalSist = efectivoEsperadoFinal + transferenciasSistema + ((dolaresEfectivoSistema + dolaresTransferenciaSistema) * exchangeRate);
                const totalGlobalConteo = fisicoEfectivoCOP + fisicoTransferCOP + ((fisicoEfectivoUSD + fisicoTransferUSD) * exchangeRate);
                lines.push("-".repeat(chars_per_line));
                lines.push(center("RESUMEN GLOBAL (CONVERTIDO A COP)"));
                lines.push(rightAlign("TOTAL SISTEMA", totalGlobalSist.toFixed(2)));
                lines.push(rightAlign("TOTAL FISICO", totalGlobalConteo.toFixed(2)));
                lines.push(rightAlign("DIFERENCIA GLOBAL", (totalGlobalConteo - totalGlobalSist).toFixed(2)));
                lines.push("");

                lines.push("-".repeat(chars_per_line));
                lines.push(center("DETALLE DE CONTEO FISICO"));
                if (cierreCiegoDetalle) {
                    const detLines = cierreCiegoDetalle.split('\n');
                    detLines.forEach(l => {
                        if (l.trim()) lines.push(l);
                    });
                }
            } else {
                lines.push("[EFECTIVO]");
                lines.push(rightAlign("SISTEMA", efectivoEsperadoFinal.toFixed(2)));
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

                if (dolaresEfectivoSistema > 0 || dolaresTransferenciaSistema > 0) {
                    lines.push("-".repeat(chars_per_line));
                    lines.push(center("CAJA DOLARES (USD)"));
                    lines.push("-".repeat(chars_per_line));
                    lines.push("[EFECTIVO USD]");
                    lines.push(rightAlign("SISTEMA", dolaresEfectivoSistema.toFixed(2)));
                    lines.push("");
                    lines.push("[TRANSFERENCIA USD]");
                    lines.push(rightAlign("SISTEMA", dolaresTransferenciaSistema.toFixed(2)));
                    lines.push("");
                }

                if (shift_info.closing_notes) {
                    if (shift_info.closing_notes.includes('Cierre Ciego')) {
                        lines.push(center("Conteo de monedas y billetes:"));
                        let notesText = shift_info.closing_notes.replace('Cierre Ciego. Desglose:\n', '');
                        notesText = notesText.replace(/, /g, '\n');
                        const notesLines = notesText.split('\n');
                        notesLines.forEach(l => lines.push(l));
                    } else {
                        lines.push("NOTAS DE CIERRE:");
                        const notesText = shift_info.closing_notes;
                        for(let i=0; i<notesText.length; i+=chars_per_line) {
                            lines.push(notesText.substring(i, i+chars_per_line));
                        }
                    }
                    lines.push("-".repeat(chars_per_line));
                }
            }

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

            const closedShiftId = currentShift.id;
            setClosingCash('');
            setNotes('');
            loadData();
            setSelectedShiftId(closedShiftId);
            alert('Caja cerrada correctamente. Puedes ver el detalle a continuación.');
        } catch (err) {
            console.error('Error closing shift:', err);
            setError('Error al cerrar la caja.');
        }
    };

    const handleBlindCloseShift = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        if (!window.confirm('¿Está seguro de cerrar la caja con estos valores?')) return;

        const totalCoinsBillsUSD = 
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
        
        const totalTransferUSD = parseFloat(blindCashCounts.transfer_usd || 0);
        const totalUSD = totalCoinsBillsUSD + totalTransferUSD;

        const totalCoinsBillsCOP = 
            (parseFloat(blindCashCounts.cop_m50 || 0) * 50) +
            (parseFloat(blindCashCounts.cop_m100 || 0) * 100) +
            (parseFloat(blindCashCounts.cop_m200 || 0) * 200) +
            (parseFloat(blindCashCounts.cop_m500 || 0) * 500) +
            (parseFloat(blindCashCounts.cop_m1000 || 0) * 1000) +
            (parseFloat(blindCashCounts.cop_b2000 || 0) * 2000) +
            (parseFloat(blindCashCounts.cop_b5000 || 0) * 5000) +
            (parseFloat(blindCashCounts.cop_b10000 || 0) * 10000) +
            (parseFloat(blindCashCounts.cop_b20000 || 0) * 20000) +
            (parseFloat(blindCashCounts.cop_b50000 || 0) * 50000) +
            (parseFloat(blindCashCounts.cop_b100000 || 0) * 100000);
        
        const totalTransferCOP = parseFloat(blindCashCounts.transfer_cop || 0);
        const totalCOP = totalCoinsBillsCOP + totalTransferCOP;

        const exchangeRate = parseFloat(localStorage.getItem('usdExchangeRate')) || 4000;
        const finalTotalCOP = totalCOP + (totalUSD * exchangeRate);
        const finalTotalUSD = totalUSD + (totalCOP / exchangeRate);

        let det = "";
        
        // USD DETAILS
        if (totalCoinsBillsUSD > 0) {
            det += "DOLARES (USD):\n";
            if (blindCashCounts.c1 > 0) det += `  1c: ${blindCashCounts.c1}\n`;
            if (blindCashCounts.c5 > 0) det += `  5c: ${blindCashCounts.c5}\n`;
            if (blindCashCounts.c10 > 0) det += `  10c: ${blindCashCounts.c10}\n`;
            if (blindCashCounts.c25 > 0) det += `  25c: ${blindCashCounts.c25}\n`;
            if (blindCashCounts.c50 > 0) det += `  50c: ${blindCashCounts.c50}\n`;
            if (blindCashCounts.d1 > 0) det += `  $1: ${blindCashCounts.d1}\n`;
            
            if (blindCashCounts.b5 > 0) det += `  Billetes de $5: ${blindCashCounts.b5}\n`;
            if (blindCashCounts.b10 > 0) det += `  Billetes de $10: ${blindCashCounts.b10}\n`;
            if (blindCashCounts.b20 > 0) det += `  Billetes de $20: ${blindCashCounts.b20}\n`;
            if (blindCashCounts.b50 > 0) det += `  Billetes de $50: ${blindCashCounts.b50}\n`;
            if (blindCashCounts.b100 > 0) det += `  Billetes de $100: ${blindCashCounts.b100}\n`;
        }

        // COP DETAILS
        if (totalCoinsBillsCOP > 0) {
            if (det) det += "\n";
            det += "PESOS (COP):\n";
            if (blindCashCounts.cop_m50 > 0) det += `  $50: ${blindCashCounts.cop_m50}\n`;
            if (blindCashCounts.cop_m100 > 0) det += `  $100: ${blindCashCounts.cop_m100}\n`;
            if (blindCashCounts.cop_m200 > 0) det += `  $200: ${blindCashCounts.cop_m200}\n`;
            if (blindCashCounts.cop_m500 > 0) det += `  $500: ${blindCashCounts.cop_m500}\n`;
            if (blindCashCounts.cop_m1000 > 0) det += `  $1000: ${blindCashCounts.cop_m1000}\n`;
            
            if (blindCashCounts.cop_b2000 > 0) det += `  Billetes de $2mil: ${blindCashCounts.cop_b2000}\n`;
            if (blindCashCounts.cop_b5000 > 0) det += `  Billetes de $5mil: ${blindCashCounts.cop_b5000}\n`;
            if (blindCashCounts.cop_b10000 > 0) det += `  Billetes de $10mil: ${blindCashCounts.cop_b10000}\n`;
            if (blindCashCounts.cop_b20000 > 0) det += `  Billetes de $20mil: ${blindCashCounts.cop_b20000}\n`;
            if (blindCashCounts.cop_b50000 > 0) det += `  Billetes de $50mil: ${blindCashCounts.cop_b50000}\n`;
            if (blindCashCounts.cop_b100000 > 0) det += `  Billetes de $100mil: ${blindCashCounts.cop_b100000}\n`;
        }

        const notesStr = `[CIERRE_CIEGO_V2]\n` +
            `FisicoEfectivoUSD=${totalCoinsBillsUSD}\n` +
            `FisicoTransferUSD=${totalTransferUSD}\n` +
            `FisicoEfectivoCOP=${totalCoinsBillsCOP}\n` +
            `FisicoTransferCOP=${totalTransferCOP}\n` +
            `---\n` + det;

        try {
            await api.post(`/api/pos/shifts/${currentShift.id}/close/`, {
                closing_cash: finalTotalUSD,
                closing_notes: notesStr
            }, { baseURL: getFastFoodBaseURL() });

            // AUTO-PRINT
            await printCashReportAutomatically(currentShift.id);

            const closedShiftId = currentShift.id;
            setIsBlindModalOpen(false);
            setBlindCashCounts({
                c1: '', c5: '', c10: '', c25: '', c50: '', d1: '',
                b5: '', b10: '', b20: '', b50: '', b100: '',
                transfer_usd: '',
                cop_m50: '', cop_m100: '', cop_m200: '', cop_m500: '', cop_m1000: '',
                cop_b2000: '', cop_b5000: '', cop_b10000: '', cop_b20000: '', cop_b50000: '', cop_b100000: '',
                transfer_cop: ''
            });
            loadData();
            setSelectedShiftId(closedShiftId);
            alert('Caja cerrada correctamente. Puedes ver el detalle a continuación.');
        } catch (err) {
            console.error('Error closing blind shift:', err);
            setError('Error al cerrar la caja.');
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        try {
            const exchangeRate = parseFloat(localStorage.getItem('usdExchangeRate')) || 4000;
            const rawAmount = parseFloat(expenseAmount);
            // Tag description with currency so ReporteCaja can separate them
            const taggedDesc = expenseCurrency === 'USD'
                ? `[USD] ${expenseDescription}`
                : expenseDescription;
            // Always store in COP (base currency)
            const amountInCOP = expenseCurrency === 'USD' ? rawAmount * exchangeRate : rawAmount;

            await api.post(`/api/pos/shifts/${currentShift.id}/add_expense/`, {
                amount: amountInCOP,
                description: taggedDesc
            }, { baseURL: getFastFoodBaseURL() });
            setExpenseAmount('');
            setExpenseDescription('');
            setExpenseCurrency('COP');
            alert('Gasto registrado exitosamente.');
        } catch (err) {
            console.error('Error adding expense:', err);
            setError(err.response?.data?.error || 'Error al registrar el gasto.');
        }
    };

    if (loading && !shiftsHistory.length) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando Panel de Caja...</div>;

    // ===== ESTILOS CORREGIDOS =====
    const styles = {
        container: { 
            minHeight: '100vh', 
            backgroundColor: 'var(--sidebar-bg)', 
            padding: '2rem' 
        },
        wrapper: { 
            maxWidth: '1400px', 
            margin: '0 auto' 
        },
        header: {
            backgroundColor: '#ffffff', 
            borderRadius: '16px', 
            padding: '2rem',
            marginBottom: '2rem', 
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex', 
            alignItems: 'center', 
            gap: '1.5rem'
        },
        headerIcon: {
            width: '64px', 
            height: '64px', 
            backgroundColor: 'var(--secondary-color)',
            borderRadius: '14px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '2rem', 
            color: 'var(--primary-color)'
        },
        // GRID CORREGIDO - ahora con 2 columnas equilibradas
        grid: { 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '2rem',
            alignItems: 'start'
        },
        card: {
            backgroundColor: '#ffffff', 
            borderRadius: '16px', 
            padding: '2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            maxWidth: '100%',
            margin: '0'
        },
        input: {
            width: '100%', 
            padding: '0.75rem', 
            borderRadius: '8px',
            border: '1px solid #dee2e6', 
            marginBottom: '1rem',
            outline: 'none', 
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
            fontSize: '0.95rem'
        },
        label: { 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '600', 
            color: '#495057',
            fontSize: '0.9rem'
        },
        buttonPrimary: {
            width: '100%', 
            padding: '0.875rem', 
            borderRadius: '8px',
            backgroundColor: 'var(--primary-color)', 
            color: '#fff', 
            border: 'none',
            fontWeight: '600', 
            cursor: 'pointer', 
            transition: 'opacity 0.2s',
            fontSize: '1rem'
        },
        buttonDanger: {
            width: '100%', 
            padding: '0.875rem', 
            borderRadius: '8px',
            backgroundColor: '#dc3545', 
            color: '#fff', 
            border: 'none',
            fontWeight: '600', 
            cursor: 'pointer', 
            transition: 'opacity 0.2s',
            fontSize: '1rem'
        },
        table: { 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '0.9rem'
        },
        th: { 
            padding: '0.75rem 1rem', 
            textAlign: 'left', 
            borderBottom: '2px solid var(--primary-color)', 
            color: 'var(--primary-color)', 
            fontWeight: '600',
            backgroundColor: '#fafafa'
        },
        td: { 
            padding: '0.75rem 1rem', 
            borderBottom: '1px solid #e9ecef', 
            verticalAlign: 'middle' 
        },
        statusBadge: (isOpen) => ({
            padding: '0.3rem 0.8rem', 
            borderRadius: '20px', 
            fontSize: '0.8rem', 
            fontWeight: '600',
            backgroundColor: isOpen ? '#d4edda' : '#e9ecef',
            color: isOpen ? '#155724' : '#495057'
        }),
        // Estilos adicionales para mejor visualización
        cardBorderOpen: {
            borderTop: '4px solid #28a745'
        },
        cardBorderClosed: {
            borderTop: '4px solid var(--primary-color)'
        },
        tableContainer: {
            overflowX: 'auto',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
        }
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
                    {/* Panel de Acción - COLUMNA IZQUIERDA */}
                    <div style={{ 
                        ...styles.card, 
                        ...(currentShift?.status === 'open' ? styles.cardBorderOpen : styles.cardBorderClosed)
                    }}>
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
                                    <button 
                                        onClick={() => setIsBlindModalOpen(true)} 
                                        style={styles.buttonDanger}
                                        onMouseEnter={(e) => e.target.style.opacity = '0.85'}
                                        onMouseLeave={(e) => e.target.style.opacity = '1'}>
                                        <i className="bi bi-cash-stack" style={{ marginRight: '0.5rem' }}></i>
                                        Cerrar Caja (Conteo de Efectivo)
                                    </button>
                                </div>

                                <form onSubmit={handleAddExpense} style={{ borderTop: '1px solid #e9ecef', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1a1a2e' }}>
                                        <i className="bi bi-dash-circle" style={{ marginRight: '0.5rem' }}></i>
                                        Registrar Gasto (Egreso)
                                    </h3>
                                    
                                    {/* Currency Toggle */}
                                    <label style={styles.label}>Moneda del Gasto</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <button type="button"
                                            onClick={() => setExpenseCurrency('COP')}
                                            style={{
                                                flex: 1, padding: '0.6rem', borderRadius: '8px', border: '2px solid',
                                                borderColor: expenseCurrency === 'COP' ? '#1b5e20' : '#dee2e6',
                                                backgroundColor: expenseCurrency === 'COP' ? '#e8f5e9' : '#fff',
                                                color: expenseCurrency === 'COP' ? '#1b5e20' : '#6c757d',
                                                fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s'
                                            }}>
                                            🇨🇴 Pesos (COP)
                                        </button>
                                        <button type="button"
                                            onClick={() => setExpenseCurrency('USD')}
                                            style={{
                                                flex: 1, padding: '0.6rem', borderRadius: '8px', border: '2px solid',
                                                borderColor: expenseCurrency === 'USD' ? '#0d47a1' : '#dee2e6',
                                                backgroundColor: expenseCurrency === 'USD' ? '#e3f2fd' : '#fff',
                                                color: expenseCurrency === 'USD' ? '#0d47a1' : '#6c757d',
                                                fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s'
                                            }}>
                                            🇺🇸 Dólares (USD)
                                        </button>
                                    </div>

                                    <label style={styles.label}>
                                        Monto del Gasto ({expenseCurrency === 'USD' ? 'en USD $' : 'en COP $'})
                                    </label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        required 
                                        style={styles.input}
                                        placeholder={expenseCurrency === 'USD' ? 'Ej: 2.50' : 'Ej: 15000'}
                                        value={expenseAmount} 
                                        onChange={(e) => setExpenseAmount(e.target.value)} 
                                    />

                                    <label style={styles.label}>Descripción / Motivo</label>
                                    <textarea 
                                        style={{ ...styles.input, resize: 'vertical' }} 
                                        rows="2" 
                                        required 
                                        placeholder="Ej: Pago de agua"
                                        value={expenseDescription} 
                                        onChange={(e) => setExpenseDescription(e.target.value)} 
                                    />

                                    <button 
                                        type="submit" 
                                        style={{
                                            ...styles.buttonPrimary,
                                            backgroundColor: expenseCurrency === 'USD' ? '#0d47a1' : 'var(--secondary-color)',
                                            color: expenseCurrency === 'USD' ? '#fff' : 'var(--primary-color)'
                                        }}
                                        onMouseEnter={(e) => e.target.style.opacity = '0.85'}
                                        onMouseLeave={(e) => e.target.style.opacity = '1'}>
                                        <i className="bi bi-plus-circle" style={{ marginRight: '0.5rem' }}></i>
                                        Registrar Gasto ({expenseCurrency})
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
                                    <input 
                                        type="text" 
                                        required 
                                        style={styles.input} 
                                        placeholder="Ej: Juan Pérez"
                                        value={managerName} 
                                        onChange={(e) => setManagerName(e.target.value)} 
                                    />

                                    <label style={styles.label}>Efectivo Inicial (Base)</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        required 
                                        style={styles.input} 
                                        placeholder="0.00"
                                        value={openingCash} 
                                        onChange={(e) => setOpeningCash(e.target.value)} 
                                    />

                                    <label style={styles.label}>Notas (Opcional)</label>
                                    <textarea 
                                        style={{ ...styles.input, resize: 'vertical' }} 
                                        rows="2"
                                        value={notes} 
                                        onChange={(e) => setNotes(e.target.value)} 
                                    />

                                    <button 
                                        type="submit" 
                                        style={styles.buttonPrimary}
                                        onMouseEnter={(e) => e.target.style.opacity = '0.85'}
                                        onMouseLeave={(e) => e.target.style.opacity = '1'}>
                                        <i className="bi bi-unlock" style={{ marginRight: '0.5rem' }}></i>
                                        Abrir Caja
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Historial de Cajas - COLUMNA DERECHA */}
                    {isAdmin && (
                        <div style={styles.card}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1a1a2e' }}>
                                    <i className="bi bi-clock-history" style={{ marginRight: '0.5rem', color: 'var(--primary-color)' }}></i>
                                    Historial de Cajas
                                </h2>
                                <button
                                    onClick={async () => {
                                        if (!window.confirm('¿Deseas recalcular los valores de cierres de caja que puedan estar en COP? Solo afecta cajas con valores mayores a $10,000.')) return;
                                        try {
                                            const exchangeRate = parseFloat(localStorage.getItem('usdExchangeRate')) || 4000;
                                            const resp = await api.post('/api/pos/shifts/fix_closing_cash/', {
                                                exchange_rate: exchangeRate,
                                                threshold: 10000
                                            }, { baseURL: getFastFoodBaseURL() });
                                            if (resp.data.corrected_count === 0) {
                                                alert('No se encontraron cajas con valores incorrectos (mayores a $10,000).');
                                            } else {
                                                alert(`✅ ${resp.data.message}`);
                                                loadData();
                                            }
                                        } catch (err) {
                                            console.error(err);
                                            alert('Error al recalcular los valores: ' + (err.response?.data?.error || err.message));
                                        }
                                    }}
                                    style={{
                                        padding: '0.4rem 1rem',
                                        borderRadius: '8px',
                                        backgroundColor: '#e8f4fd',
                                        color: '#0d6efd',
                                        border: '1px solid #0d6efd',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}>
                                    <i className="bi bi-arrow-clockwise"></i> Actualizar Cajas
                                </button>
                            </div>
                            <div style={styles.tableContainer}>
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
                                            <tr 
                                                key={shift.id} 
                                                style={{ transition: 'background-color 0.2s' }} 
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
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
                                                                background: 'none', 
                                                                border: 'none', 
                                                                color: 'var(--primary-color)',
                                                                cursor: 'pointer', 
                                                                padding: '0.5rem', 
                                                                borderRadius: '8px',
                                                                transition: 'background-color 0.2s'
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
                                                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#6c757d' }}>
                                                    <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}></i>
                                                    No hay historial de cajas disponible.
                                                </td>
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
            <Modal isOpen={isBlindModalOpen} onClose={() => setIsBlindModalOpen(false)} title="Conteo Físico de Caja" maxWidth="1200px">
                <form onSubmit={handleBlindCloseShift}>
                    <p style={{ marginBottom: '1rem', color: '#6c757d' }}>Ingrese la <strong>cantidad</strong> (número de unidades) que tiene de cada denominación, y el monto total en transferencias.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1rem' }}>
                        {/* DÓLARES (USD) */}
                        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                            <h3 style={{ borderBottom: '2px solid var(--primary-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>DÓLARES (USD)</h3>
                            
                            <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Monedas</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><label style={{ fontSize: '0.85rem' }}>1 centavo</label><input type="number" min="0" style={styles.input} value={blindCashCounts.c1} onChange={e => setBlindCashCounts({...blindCashCounts, c1: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>5 centavos</label><input type="number" min="0" style={styles.input} value={blindCashCounts.c5} onChange={e => setBlindCashCounts({...blindCashCounts, c5: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>10 centavos</label><input type="number" min="0" style={styles.input} value={blindCashCounts.c10} onChange={e => setBlindCashCounts({...blindCashCounts, c10: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>25 centavos</label><input type="number" min="0" style={styles.input} value={blindCashCounts.c25} onChange={e => setBlindCashCounts({...blindCashCounts, c25: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>50 centavos</label><input type="number" min="0" style={styles.input} value={blindCashCounts.c50} onChange={e => setBlindCashCounts({...blindCashCounts, c50: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$1</label><input type="number" min="0" style={styles.input} value={blindCashCounts.d1} onChange={e => setBlindCashCounts({...blindCashCounts, d1: e.target.value})} placeholder="0" /></div>
                            </div>

                            <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem', marginTop: '1rem' }}>Billetes</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><label style={{ fontSize: '0.85rem' }}>$5</label><input type="number" min="0" style={styles.input} value={blindCashCounts.b5} onChange={e => setBlindCashCounts({...blindCashCounts, b5: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$10</label><input type="number" min="0" style={styles.input} value={blindCashCounts.b10} onChange={e => setBlindCashCounts({...blindCashCounts, b10: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$20</label><input type="number" min="0" style={styles.input} value={blindCashCounts.b20} onChange={e => setBlindCashCounts({...blindCashCounts, b20: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$50</label><input type="number" min="0" style={styles.input} value={blindCashCounts.b50} onChange={e => setBlindCashCounts({...blindCashCounts, b50: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$100</label><input type="number" min="0" style={styles.input} value={blindCashCounts.b100} onChange={e => setBlindCashCounts({...blindCashCounts, b100: e.target.value})} placeholder="0" /></div>
                            </div>

                            <div style={{ borderTop: '1px solid #dee2e6', paddingTop: '1rem', marginTop: '1rem' }}>
                                <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Transferencias (USD)</h4>
                                <input type="number" step="0.01" min="0" style={styles.input} value={blindCashCounts.transfer_usd} onChange={e => setBlindCashCounts({...blindCashCounts, transfer_usd: e.target.value})} placeholder="Ej: 45.50" />
                            </div>
                        </div>

                        {/* PESOS (COP) */}
                        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                            <h3 style={{ borderBottom: '2px solid var(--primary-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>PESOS (COP)</h3>
                            
                            <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Monedas</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><label style={{ fontSize: '0.85rem' }}>$50</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_m50} onChange={e => setBlindCashCounts({...blindCashCounts, cop_m50: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$100</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_m100} onChange={e => setBlindCashCounts({...blindCashCounts, cop_m100: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$200</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_m200} onChange={e => setBlindCashCounts({...blindCashCounts, cop_m200: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$500</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_m500} onChange={e => setBlindCashCounts({...blindCashCounts, cop_m500: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$1,000</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_m1000} onChange={e => setBlindCashCounts({...blindCashCounts, cop_m1000: e.target.value})} placeholder="0" /></div>
                            </div>

                            <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem', marginTop: '1rem' }}>Billetes</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><label style={{ fontSize: '0.85rem' }}>$2,000</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_b2000} onChange={e => setBlindCashCounts({...blindCashCounts, cop_b2000: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$5,000</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_b5000} onChange={e => setBlindCashCounts({...blindCashCounts, cop_b5000: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$10,000</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_b10000} onChange={e => setBlindCashCounts({...blindCashCounts, cop_b10000: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$20,000</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_b20000} onChange={e => setBlindCashCounts({...blindCashCounts, cop_b20000: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$50,000</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_b50000} onChange={e => setBlindCashCounts({...blindCashCounts, cop_b50000: e.target.value})} placeholder="0" /></div>
                                <div><label style={{ fontSize: '0.85rem' }}>$100,000</label><input type="number" min="0" style={styles.input} value={blindCashCounts.cop_b100000} onChange={e => setBlindCashCounts({...blindCashCounts, cop_b100000: e.target.value})} placeholder="0" /></div>
                            </div>

                            <div style={{ borderTop: '1px solid #dee2e6', paddingTop: '1rem', marginTop: '1rem' }}>
                                <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Transferencias (COP)</h4>
                                <input type="number" step="1" min="0" style={styles.input} value={blindCashCounts.transfer_cop} onChange={e => setBlindCashCounts({...blindCashCounts, transfer_cop: e.target.value})} placeholder="Ej: 45000" />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="button" onClick={() => setIsBlindModalOpen(false)} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: '1px solid #dee2e6', background: 'transparent', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                        <button type="submit" style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: '#fff', cursor: 'pointer' }}>
                            Confirmar Cierre
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PanelCaja;
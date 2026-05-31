import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

// Formato de moneda
export const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '$0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD', // Ecuador usa USD
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num || 0);
};

// Formato de fecha
export const formatDate = (dateString) => {
    try {
        if (!dateString) return 'Fecha no disponible';

        // Fix para strings "YYYY-MM-DD" que JS interpreta como UTC
        let date;
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [y, m, d] = dateString.split('-').map(Number);
            date = new Date(y, m - 1, d); // Constructor local
        } else {
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString('es-EC', {
            weekday: 'long', // "lunes", "martes"...
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Guayaquil'
        });
    } catch (e) {
        return dateString;
    }
};

// Obtener fecha válida
export const getValidDate = (dateValue) => {
    if (!dateValue) return null;

    // Fix para strings "YYYY-MM-DD"
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const [y, m, d] = dateValue.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
};

// Generar PDF Detallado
// Obtener fecha actual en zona horaria de Ecuador
export const getEcuadorDate = () => {
    const now = new Date();
    const options = { timeZone: 'America/Guayaquil', year: 'numeric', month: 'numeric', day: 'numeric' };
    const fmt = new Intl.DateTimeFormat('en-US', options);
    const parts = fmt.formatToParts(now);

    // Encontrar partes
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;

    // Construir fecha local (Mes es 0-indexado)
    return new Date(year, month - 1, day);
};

// Generar PDF Simplificado (Estilo Recibo/Reporte Simple)
export const generateDetailedPDF = (report, reportType, dateRangeStr) => {
    if (!report) {
        alert('No hay reporte seleccionado para imprimir.');
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const MARGIN = 15;

    // --- 1. Encabezado Simple ---
    doc.setFontSize(10);
    doc.setTextColor(50);

    // Fecha y hora de impresión
    const printDate = format(getEcuadorDate(), 'dd/MM/yyyy HH:mm');
    doc.text(printDate, MARGIN, y);

    // Nombre del Negocio / Usuario (Derecha)
    const businessName = "FASTBOX"; 
    doc.text(businessName, pageWidth - MARGIN, y, { align: 'right' });
    
    if (report.shift_info?.user) {
        y += 5;
        doc.text(`Usuario: ${report.shift_info.user}`, pageWidth - MARGIN, y, { align: 'right' });
    }

    y += 20;

    // --- 2. Título Central ---
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text('Detalles de ventas', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Rango de fechas / Fechas del turno
    doc.setFontSize(10);
    doc.setTextColor(0);

    let dateInfo = '';
    if (report.is_shift_report && report.shift_info) {
        // Usar fechas reales del turno si existen
        const open = report.shift_info.opened_at ? format(new Date(report.shift_info.opened_at), 'dd/MM/yyyy HH:mm:ss') : '';
        const close = report.shift_info.closed_at ? format(new Date(report.shift_info.closed_at), 'dd/MM/yyyy HH:mm:ss') : '';
        dateInfo = `${open} - ${close}`;
    } else {
        dateInfo = dateRangeStr;
    }

    doc.text(dateInfo, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // --- 3. Tabla de Productos (Productos) ---
    doc.setFontSize(14);
    doc.text('Productos', MARGIN, y);
    y += 5;

    const topProducts = (report.top_products || [])
        .map(p => {
            // Calcular precio unitario aproximado si no viene
            const qty = p.quantity || p.quantity_sold || 0;
            const total = p.total_amount || 0;
            const unitPrice = qty > 0 ? (total / qty) : 0;

            // Backend puede devolver product__name o product_name
            const pName = p.product_name || p.product__name || 'Desconocido';

            return [
                pName,
                `${qty.toFixed(1)} Unidades`,
                unitPrice.toFixed(1) // Mostrar con 1 decimal o 2 según imagen (imagen muestra 15.0, 3.9, 0.7)
            ];
        });

    if (topProducts.length === 0) {
        topProducts.push(['Sin ventas registradas', '-', '-']);
    }

    doc.autoTable({
        startY: y,
        head: [['Producto', 'Cantidad', 'Unidad de precio']],
        body: topProducts,
        theme: 'plain', // Estilo simple sin stripes
        styles: {
            fontSize: 10,
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: { bottom: 0.1 }
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: { bottom: 1 }, // Línea negra bajo header
            lineColor: [0, 0, 0]
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' },
            2: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: MARGIN, right: MARGIN },
    });

    y = doc.lastAutoTable.finalY + 15;

    // --- 3.5 Desglose de Métodos de Pago ---
    let paymentStats = {
        efectivo: { count: 0, amount: 0 },
        transferencia: { count: 0, amount: 0 }
    };

    if (report.payment_methods && Array.isArray(report.payment_methods) && report.payment_methods.length > 0) {
        report.payment_methods.forEach(pm => {
            const method = String(pm.payment_method__name || pm.method || pm.name || '').toLowerCase();
            const count = parseInt(pm.count || 0);
            const amount = parseFloat(pm.total || pm.amount || 0);
            if (method.includes('efectivo') || method === 'cash') {
                paymentStats.efectivo.count += count;
                paymentStats.efectivo.amount += amount;
            } else if (method.includes('transferencia') || method.includes('transfer')) {
                paymentStats.transferencia.count += count;
                paymentStats.transferencia.amount += amount;
            }
        });
    } else if (report.orders_detail && Array.isArray(report.orders_detail) && report.orders_detail.length > 0) {
        report.orders_detail.forEach(order => {
            // Asumimos pagado si status es delivered/completed
            if (['delivered', 'completed'].includes(order.status) || order.payment_status === 'paid') {
                const method = String(order.payment_method_display || order.payment_method || '').toLowerCase();
                const total = parseFloat(order.total_amount || order.total || 0);
                if (method.includes('efectivo') || method === 'cash') {
                    paymentStats.efectivo.count += 1;
                    paymentStats.efectivo.amount += total;
                } else if (method.includes('transferencia') || method.includes('transfer')) {
                    paymentStats.transferencia.count += 1;
                    paymentStats.transferencia.amount += total;
                }
            }
        });
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Resumen de Pagos', MARGIN, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    doc.text(`Efectivo: ${paymentStats.efectivo.count} pedidos - ${formatCurrency(paymentStats.efectivo.amount)}`, MARGIN, y);
    y += 5;
    doc.text(`Transferencia: ${paymentStats.transferencia.count} pedidos - ${formatCurrency(paymentStats.transferencia.amount)}`, MARGIN, y);
    y += 15;

    // --- 4. Total Final ---
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');

    // Fix: total_sales puede estar en 'summary' (shift report) o en raíz (daily report)
    const totalSalesVal = report.summary?.total_sales !== undefined
        ? report.summary.total_sales
        : (report.total_sales || 0);

    const totalText = `Total: ${formatCurrency(totalSalesVal).replace('$', '')}`; // Quitar símbolo si la imagen no lo tiene, o dejarlo. Imagen: "Total: 1.620,20" (formato europeo/latino).
    // Nuestra formatCurrency usa $ y formato inglés/EC (.,). Ajustamos si es necesario.
    // El usuario pidió "como en la foto".

    doc.text(totalText, MARGIN + 10, y);

    const reportFileName = report.is_shift_report && report.shift_info
        ? `Reporte_Turno_${report.shift_info.number}.pdf`
        : `Reporte_Ventas_${format(getEcuadorDate(), 'yyyyMMdd_HHmm')}.pdf`;

    doc.save(reportFileName);
};

import React, { useState, useEffect, useContext } from 'react';
import inventoryService from '../../services/inventoryService';
import printerService from '../../services/printerService';
import { AuthContext } from '../../context/AuthContext';

// Traduce el tipo de movimiento al español
const traducirTipo = (type) => {
    const map = {
        'out': 'Salida',
        'in': 'Entrada',
        'SALIDA': 'Salida',
        'ENTRADA': 'Entrada',
        'sale': 'Venta',
        'adjustment': 'Ajuste',
        'purchase': 'Compra',
        'production': 'Produccion',
        'manual': 'Manual',
    };
    return map[type] || type;
};

// Limpia los motivos automáticos del sistema para que sean legibles
const limpiarMotivo = (reason) => {
    if (!reason) return '—';
    // Motivos generados por el sistema tienen patrones reconocibles
    if (/venta orden/i.test(reason)) {
        const match = reason.match(/ORD-([A-Z0-9-]+)/i);
        return match ? `Venta #${match[1].substring(0, 8)}` : 'Venta';
    }
    if (/anulac/i.test(reason)) {
        const match = reason.match(/ORD-([A-Z0-9-]+)/i);
        return match ? `Anulacion #${match[1].substring(0, 8)}` : 'Anulacion';
    }
    if (/produccion/i.test(reason) || /production/i.test(reason)) return 'Produccion';
    return reason;
};

const tipoBadgeStyle = (type) => {
    const isOut = type === 'out' || type === 'SALIDA' || type === 'sale';
    const isAdjust = type === 'adjustment';
    return {
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: isAdjust ? '#fef3c7' : (isOut ? '#fee2e2' : '#d1fae5'),
        color: isAdjust ? '#d97706' : (isOut ? 'var(--danger-color)' : 'var(--success-color)'),
        whiteSpace: 'nowrap',
    };
};

const MovimientosInventario = () => {
    const { user } = useContext(AuthContext);
    const roleName = user?.role_details?.name;
    const isAdmin = roleName === 'SUPER_ADMIN' || roleName === 'ADMIN_FAST_FOOD' || user?.is_superuser;

    const [view, setView] = useState('pos'); // 'pos' | 'history'

    const [supplies, setSupplies] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState('');

    // Estado del item actual que se esta ingresando
    const [selectedSupply, setSelectedSupply] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');

    // Lista acumulada de items a registrar
    const [cart, setCart] = useState([]);

    const [submitting, setSubmitting] = useState(false);
    const [printStatus, setPrintStatus] = useState('');

    // -----------------------------------------------------------------------
    const fetchData = async () => {
        setLoadingData(true);
        try {
            const [suppliesResp, movementsResp] = await Promise.all([
                inventoryService.getSupplies(),
                inventoryService.getMovements()
            ]);
            setSupplies(suppliesResp);
            setMovements(movementsResp);
        } catch (err) {
            console.error('Error al cargar datos de inventario', err);
            setError('No se pudieron cargar los datos.');
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // -----------------------------------------------------------------------
    const getSupply = (id) => supplies.find(s => String(s.id) === String(id));

    const handleAddToCart = () => {
        if (!selectedSupply || !quantity || parseFloat(quantity) <= 0) return;
        const supply = getSupply(selectedSupply);
        if (!supply) return;

        setCart(prev => {
            const existing = prev.find(i => String(i.supply) === String(selectedSupply));
            if (existing) {
                return prev.map(i =>
                    String(i.supply) === String(selectedSupply)
                        ? { ...i, quantity: parseFloat(i.quantity) + parseFloat(quantity) }
                        : i
                );
            }
            return [...prev, {
                supply: selectedSupply,
                supplyName: supply.name,
                unit: supply.unit_display || supply.unit || '',
                quantity: parseFloat(quantity),
                reason: reason || 'Consumo manual'
            }];
        });

        // Limpiar campos para el siguiente item
        setSelectedSupply('');
        setQuantity('');
        setReason('');
    };

    const handleRemoveFromCart = (supplyId) => {
        setCart(prev => prev.filter(i => String(i.supply) !== String(supplyId)));
    };

    const handleConfirmMovements = async () => {
        if (cart.length === 0) return;
        setSubmitting(true);
        setPrintStatus('');
        try {
            await Promise.all(cart.map(item =>
                inventoryService.recordMovement(item.supply, {
                    movement_type: 'out',
                    quantity: item.quantity,
                    reason: item.reason
                })
            ));

            await printMovementTicket(cart);

            setCart([]);
            setView('history');
            fetchData();
        } catch (err) {
            console.error('Error al registrar movimientos', err);
            alert('Error al registrar los movimientos. Verifique los datos.');
        } finally {
            setSubmitting(false);
        }
    };

    const printMovementTicket = async (items) => {
        try {
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-EC');
            const timeStr = now.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
            const userName = user?.username || user?.email || 'Usuario';

            const lines = [
                '================================',
                '     CONSUMO DE INSUMOS',
                '================================',
                `Fecha:    ${dateStr}`,
                `Hora:     ${timeStr}`,
                `Usuario:  ${userName}`,
                '--------------------------------',
                'INSUMO          CANT   UNIDAD',
                '--------------------------------',
                ...items.map(item => {
                    const name = item.supplyName.substring(0, 14).padEnd(14);
                    const qty = String(item.quantity).padStart(6);
                    const unit = (item.unit || '').substring(0, 6);
                    return `${name} ${qty}  ${unit}`;
                }),
                '================================',
                `Total registros: ${items.length}`,
                '================================',
                '',
            ];

            await printerService.printCustomTicket(lines.join('\n'), 'other');
            setPrintStatus('Ticket impreso correctamente');
        } catch (err) {
            console.error('Error al imprimir ticket', err);
            setPrintStatus('Movimientos guardados. No se pudo imprimir el ticket.');
        }
    };

    // -----------------------------------------------------------------------
    // Vista: Historial
    // -----------------------------------------------------------------------
    const renderHistory = () => (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <h4 style={{ margin: 0 }}>Historial de Movimientos</h4>
                <button
                    className="btn btn-primary"
                    onClick={() => { setCart([]); setPrintStatus(''); setView('pos'); }}
                >
                    + Registrar Movimiento
                </button>
            </div>

            {loadingData ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Cargando...</div>
            ) : error ? (
                <div className="alert alert-error">{error}</div>
            ) : (
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Insumo</th>
                                <th>Tipo</th>
                                <th>Cantidad</th>
                                <th>Motivo</th>
                                <th>Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movements.filter(m => m.movement_type === 'out').length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No hay movimientos registrados
                                    </td>
                                </tr>
                            ) : (
                                movements.filter(m => m.movement_type === 'out').map(m => {
                                    const sup = supplies.find(s => String(s.id) === String(m.supply));
                                    const nombre = sup ? `${sup.name} (${sup.unit_display || sup.unit || ''})` : (m.supply_name || '—');
                                    const fecha = m.timestamp || m.created_at || m.date;
                                    return (
                                        <tr key={m.id}>
                                            <td>{nombre}</td>
                                            <td>
                                                <span style={tipoBadgeStyle(m.movement_type)}>
                                                    {traducirTipo(m.movement_type)}
                                                </span>
                                            </td>
                                            <td>{Number(m.quantity)}</td>
                                            <td>{limpiarMotivo(m.reason)}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {fecha ? new Date(fecha).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // -----------------------------------------------------------------------
    // Vista: POS de consumo
    // -----------------------------------------------------------------------
    const renderPOS = () => (
        <div style={{ display: 'flex', gap: '1.5rem', minHeight: '420px' }}>

            {/* Panel izquierdo: formulario de item */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                borderRight: '1px solid var(--border-color)',
                paddingRight: '1.5rem'
            }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Seleccionar Insumo</h4>

                <div className="form-group">
                    <label>Insumo</label>
                    <select
                        className="form-control"
                        value={selectedSupply}
                        onChange={e => setSelectedSupply(e.target.value)}
                    >
                        <option value="">Seleccione un insumo</option>
                        {supplies.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name} — {s.unit_display || s.unit || ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Cantidad a consumir</label>
                    <input
                        type="number"
                        className="form-control"
                        min="0.01"
                        step="0.01"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        placeholder="0"
                    />
                </div>

                <div className="form-group">
                    <label>Motivo (opcional)</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: Consumo de produccion"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                    />
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleAddToCart}
                    disabled={!selectedSupply || !quantity || parseFloat(quantity) <= 0}
                    style={{ width: '100%', marginTop: 'auto' }}
                >
                    Agregar al movimiento
                </button>
            </div>

            {/* Panel derecho: lista acumulada */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                }}>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>
                        Movimiento a registrar
                        {cart.length > 0 && (
                            <span style={{
                                marginLeft: '8px',
                                background: 'var(--primary-color)',
                                color: '#fff',
                                borderRadius: '50%',
                                fontSize: '0.7rem',
                                width: '20px', height: '20px',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {cart.length}
                            </span>
                        )}
                    </h4>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {cart.length === 0 ? (
                        <div style={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            textAlign: 'center',
                            border: '1px dashed var(--border-color)',
                            borderRadius: 'var(--radius)',
                            padding: '2rem',
                            minHeight: '180px'
                        }}>
                            <span>Agrega insumos para registrar el consumo</span>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.supply} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'var(--background-color)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius)',
                                padding: '10px 14px',
                                marginBottom: '8px',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                        {item.supplyName}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {item.quantity} {item.unit}
                                        {item.reason !== 'Consumo manual' ? ` · ${item.reason}` : ''}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveFromCart(item.supply)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--danger-color)',
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        padding: '4px 8px',
                                        lineHeight: 1
                                    }}
                                >
                                    x
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {printStatus && (
                    <div style={{
                        marginTop: '8px',
                        fontSize: '0.8rem',
                        color: printStatus.startsWith('Ticket') ? 'var(--success-color)' : 'var(--warning-color)'
                    }}>
                        {printStatus}
                    </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', gap: '10px' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setView('history')}
                        style={{ flex: 1 }}
                    >
                        Ver historial
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirmMovements}
                        disabled={cart.length === 0 || submitting}
                        style={{ flex: 2 }}
                    >
                        {submitting ? 'Guardando...' : `Confirmar e imprimir (${cart.length})`}
                    </button>
                </div>
            </div>
        </div>
    );

    // -----------------------------------------------------------------------
    return (
        <div>
            {view === 'history' ? renderHistory() : renderPOS()}
        </div>
    );
};

export default MovimientosInventario;

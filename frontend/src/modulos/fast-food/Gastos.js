import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Gastos = () => {
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [cashRegisters, setCashRegisters] = useState([]);
    const [formData, setFormData] = useState({
        amount: '',
        description: '',
        performed_by: '',
        cash_register: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch cajas
            const cajasRes = await api.get('/api/payments/cash-registers/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            const cajasList = cajasRes.data.results || cajasRes.data;
            setCashRegisters(cajasList);

            if (cajasList.length > 0) {
                setFormData(prev => ({ ...prev, cash_register: cajasList[0].id }));
            }

            // Fetch movimientos
            const res = await api.get('/api/payments/cash-movements/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            const allMovements = res.data.results || res.data;
            // Filtrar solo gastos
            const onlyExpenses = allMovements.filter(m => m.reason === 'expense');
            setGastos(onlyExpenses);
        } catch (err) {
            console.error(err);
            setError('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (gasto = null) => {
        if (gasto) {
            setFormData({
                amount: gasto.amount,
                description: gasto.description,
                performed_by: gasto.performed_by,
                cash_register: gasto.cash_register
            });
            setCurrentId(gasto.id);
        } else {
            setFormData({
                amount: '',
                description: '',
                performed_by: 'Sistema',
                cash_register: cashRegisters.length > 0 ? cashRegisters[0].id : ''
            });
            setCurrentId(null);
        }
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de eliminar este gasto?')) {
            try {
                await api.delete(`/api/payments/cash-movements/${id}/`, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
                fetchData();
            } catch (err) {
                console.error(err);
                alert('Error al eliminar');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                movement_type: 'out',
                reason: 'expense'
            };

            if (currentId) {
                await api.put(`/api/payments/cash-movements/${currentId}/`, payload, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
            } else {
                await api.post('/api/payments/cash-movements/', payload, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Error al guardar');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, var(--sidebar-bg), var(--sidebar-bg))', padding: '24px' }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Gestión de Gastos</h1>
                        <p style={{ color: '#6b7280' }}>Administra los gastos operativos</p>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        style={{
                            backgroundColor: '#2563eb', color: 'white', padding: '12px 24px',
                            borderRadius: '8px', border: 'none', fontWeight: '500', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        + Nuevo Gasto
                    </button>
                </div>

                {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}
                
                {loading ? <p>Cargando...</p> : (
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Fecha</th>
                                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Descripción</th>
                                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Monto (USD)</th>
                                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Realizado por</th>
                                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gastos.map(g => (
                                    <tr key={g.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '16px', color: '#1f2937' }}>{new Date(g.created_at).toLocaleString()}</td>
                                        <td style={{ padding: '16px', color: '#1f2937' }}>{g.description}</td>
                                        <td style={{ padding: '16px', color: '#dc2626', fontWeight: '500' }}>${parseFloat(g.amount).toFixed(2)}</td>
                                        <td style={{ padding: '16px', color: '#6b7280' }}>{g.performed_by}</td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <button onClick={() => handleOpenModal(g)} style={{ marginRight: '8px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#f3f4f6', border: 'none', cursor: 'pointer' }}>Editar</button>
                                            <button onClick={() => handleDelete(g.id)} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer' }}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                                {gastos.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>No hay gastos registrados</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '500px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>{currentId ? 'Editar Gasto' : 'Nuevo Gasto'}</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Caja Registradora</label>
                                <select 
                                    value={formData.cash_register} 
                                    onChange={(e) => setFormData({...formData, cash_register: e.target.value})}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    required
                                >
                                    {cashRegisters.map(c => <option key={c.id} value={c.id}>{c.register_number}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Descripción</label>
                                <input 
                                    type="text" 
                                    value={formData.description} 
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Monto (USD)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={formData.amount} 
                                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Realizado por</label>
                                <input 
                                    type="text" 
                                    value={formData.performed_by} 
                                    onChange={(e) => setFormData({...formData, performed_by: e.target.value})}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer' }}>
                                    {submitting ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gastos;

import React, { useState, useEffect } from 'react';
import Modal from '../../comun/Modal';
import printerService from '../../services/printerService';

const Impresoras = () => {
    const [printers, setPrinters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState(null);

    const initialPrinterState = {
        name: '',
        printer_type: 'thermal',
        connection_type: 'usb',
        connection_string: '',
        paper_width: 80,
        characters_per_line: 42,
        has_cash_drawer: true,
        is_active: true,
        is_default: false,
        config: { prints_receipt: true, prints_command: false }
    };

    const [printerForm, setPrinterForm] = useState(initialPrinterState);

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        company_name: '',
        company_address: '',
        company_phone: '',
        tax_id: '',
        receipt_header: '',
        receipt_footer: ''
    });

    const fetchPrinters = async () => {
        try {
            setLoading(true);
            const data = await printerService.getPrinters();
            setPrinters(data.results || data || []);
            setError('');
        } catch (err) {
            console.error('Error fetching printers:', err);
            setError('Error al cargar las impresoras');
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const data = await printerService.getSettings();
            if (data) {
                setSettingsForm({
                    company_name: data.company_name || '',
                    company_address: data.company_address || '',
                    company_phone: data.company_phone || '',
                    tax_id: data.tax_id || '',
                    receipt_header: data.receipt_header || '',
                    receipt_footer: data.receipt_footer || ''
                });
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    };

    useEffect(() => {
        fetchPrinters();
        fetchSettings();
    }, []);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setPrinterForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleConfigChange = (e) => {
        const { name, checked } = e.target;
        setPrinterForm(prev => ({
            ...prev,
            config: {
                ...prev.config,
                [name]: checked
            }
        }));
    };

    const handleSettingsChange = (e) => {
        const { name, value } = e.target;
        setSettingsForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const openSettingsModal = () => {
        fetchSettings();
        setIsSettingsModalOpen(true);
    };

    const handleSettingsSubmit = async (e) => {
        e.preventDefault();
        try {
            await printerService.updateSettings(settingsForm);
            setIsSettingsModalOpen(false);
            alert('Configuración del ticket guardada exitosamente');
        } catch (err) {
            console.error('Error saving settings:', err);
            alert('Error al guardar la configuración');
        }
    };

    const openNewModal = () => {
        setEditingPrinter(null);
        setPrinterForm(initialPrinterState);
        setIsModalOpen(true);
    };

    const openEditModal = (printer) => {
        setEditingPrinter(printer);
        setPrinterForm({
            name: printer.name || '',
            printer_type: printer.printer_type || 'thermal',
            connection_type: printer.connection_type || 'usb',
            connection_string: printer.connection_string || '',
            paper_width: printer.paper_width || 80,
            characters_per_line: printer.characters_per_line || 42,
            has_cash_drawer: printer.has_cash_drawer !== undefined ? printer.has_cash_drawer : true,
            is_active: printer.is_active !== undefined ? printer.is_active : true,
            is_default: printer.is_default !== undefined ? printer.is_default : false,
            config: {
                prints_receipt: printer.config?.prints_receipt !== undefined ? printer.config.prints_receipt : true,
                prints_command: printer.config?.prints_command !== undefined ? printer.config.prints_command : false
            }
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPrinter) {
                await printerService.updatePrinter(editingPrinter.id, printerForm);
            } else {
                await printerService.createPrinter(printerForm);
            }
            setIsModalOpen(false);
            fetchPrinters();
        } catch (err) {
            console.error('Error saving printer:', err);
            alert('Error al guardar la impresora. Verifique los datos.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de eliminar esta impresora?')) {
            try {
                await printerService.deletePrinter(id);
                fetchPrinters();
            } catch (err) {
                console.error('Error deleting printer:', err);
                alert('Error al eliminar la impresora');
            }
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Administración de Impresoras</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={openSettingsModal}>
                        Configurar Ticket
                    </button>
                    <button className="btn btn-primary" onClick={openNewModal}>
                        Nueva Impresora
                    </button>
                </div>
            </div>

            {loading ? <div>Cargando impresoras...</div> : error ? <div className="alert alert-error">{error}</div> : (
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Conexión</th>
                                <th>Papel (mm)</th>
                                <th>Caja</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printers.length === 0 ? (
                                <tr><td colSpan="7">No hay impresoras registradas</td></tr>
                            ) : (
                                printers.map(printer => (
                                    <tr key={printer.id}>
                                        <td>{printer.name} {printer.is_default && <span style={{fontSize: '0.8em', color: 'green'}}>(Default)</span>}</td>
                                        <td>{printer.printer_type === 'thermal' ? 'Térmica' : printer.printer_type}</td>
                                        <td>{printer.connection_type === 'rawbt' ? 'App RawBT (Tablet)' : printer.connection_type.toUpperCase()}</td>
                                        <td>{printer.paper_width}mm</td>
                                        <td>{printer.has_cash_drawer ? 'Sí' : 'No'}</td>
                                        <td>{printer.is_active ? 'Activa' : 'Inactiva'}</td>
                                        <td>
                                            <button 
                                                className="btn btn-secondary" 
                                                onClick={() => openEditModal(printer)}
                                                style={{ marginRight: '5px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                            >
                                                Editar
                                            </button>
                                            <button 
                                                className="btn btn-danger" 
                                                onClick={() => handleDelete(printer.id)}
                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPrinter ? "Editar Impresora" : "Nueva Impresora"}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nombre de Impresora</label>
                        <input
                            type="text"
                            name="name"
                            value={printerForm.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Tipo de Conexión</label>
                        <select name="connection_type" value={printerForm.connection_type} onChange={handleInputChange} className="form-control">
                            <option value="usb">USB (Agente PC)</option>
                            <option value="network">Red / IP (Agente PC)</option>
                            <option value="bluetooth">Bluetooth (Agente PC)</option>
                            <option value="serial">Serial / COM (Agente PC)</option>
                            <option value="rawbt">Inalámbrica (App RawBT Tablet)</option>
                        </select>
                    </div>

                    {printerForm.connection_type !== 'rawbt' && (
                        <div className="form-group">
                            <label>Cadena de Conexión</label>
                            <input
                                type="text"
                                name="connection_string"
                                value={printerForm.connection_string}
                                onChange={handleInputChange}
                                placeholder="Ej: /dev/usb/lp0, 192.168.1.100, COM1"
                            />
                        </div>
                    )}

                    <div className="form-group" style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>Ancho de Papel (mm)</label>
                            <select name="paper_width" value={printerForm.paper_width} onChange={handleInputChange} className="form-control">
                                <option value="58">58mm</option>
                                <option value="80">80mm</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Caracteres por línea</label>
                            <input
                                type="number"
                                name="characters_per_line"
                                value={printerForm.characters_per_line}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                name="has_cash_drawer"
                                checked={printerForm.has_cash_drawer}
                                onChange={handleInputChange}
                                style={{ marginRight: '8px' }}
                            />
                            Tiene Caja Registradora
                        </label>
                    </div>

                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                name="is_default"
                                checked={printerForm.is_default}
                                onChange={handleInputChange}
                                style={{ marginRight: '8px' }}
                            />
                            Es la Impresora Principal (Por Defecto)
                        </label>
                    </div>

                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                name="is_active"
                                checked={printerForm.is_active}
                                onChange={handleInputChange}
                                style={{ marginRight: '8px' }}
                            />
                            Activa
                        </label>
                    </div>

                    <h4 style={{ margin: '1.5rem 0 0.5rem 0', color: 'var(--primary-color)' }}>Documentos a Imprimir</h4>
                    <p style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '1rem' }}>Seleccione qué documentos debe imprimir esta impresora</p>
                    
                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                name="prints_receipt"
                                checked={printerForm.config?.prints_receipt ?? true}
                                onChange={handleConfigChange}
                                style={{ marginRight: '8px' }}
                            />
                            Imprimir Factura/Ticket (Con detalles y precios para el cliente)
                        </label>
                    </div>

                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                name="prints_command"
                                checked={printerForm.config?.prints_command ?? false}
                                onChange={handleConfigChange}
                                style={{ marginRight: '8px' }}
                            />
                            Imprimir Comanda (Sin precios, para cocina o preparación)
                        </label>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar Impresora</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Configuración del Ticket">
                <form onSubmit={handleSettingsSubmit}>
                    <div className="form-group">
                        <label>Nombre de la Empresa</label>
                        <input type="text" name="company_name" value={settingsForm.company_name} onChange={handleSettingsChange} placeholder="Ej: Mi Restaurante S.A." />
                    </div>
                    <div className="form-group">
                        <label>RUC / NIT</label>
                        <input type="text" name="tax_id" value={settingsForm.tax_id} onChange={handleSettingsChange} placeholder="Ej: 0912345678001" />
                    </div>
                    <div className="form-group">
                        <label>Dirección</label>
                        <input type="text" name="company_address" value={settingsForm.company_address} onChange={handleSettingsChange} placeholder="Ej: Av. Principal y Calle 1" />
                    </div>
                    <div className="form-group">
                        <label>Teléfono</label>
                        <input type="text" name="company_phone" value={settingsForm.company_phone} onChange={handleSettingsChange} placeholder="Ej: 0999999999" />
                    </div>
                    <div className="form-group">
                        <label>Mensaje Cabecera (Opcional)</label>
                        <input type="text" name="receipt_header" value={settingsForm.receipt_header} onChange={handleSettingsChange} placeholder="Texto adicional arriba del ticket" />
                    </div>
                    <div className="form-group">
                        <label>Mensaje Pie de Ticket (Opcional)</label>
                        <input type="text" name="receipt_footer" value={settingsForm.receipt_footer} onChange={handleSettingsChange} placeholder="Ej: ¡Gracias por su compra!" />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsSettingsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar Configuración</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Impresoras;

const styles = `
    .page-container {
        padding: 20px;
        max-width: 1600px;
        margin: 0 auto;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .page-header h2 {
        margin: 0;
        color: #1f2937;
    }
    
    .btn {
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
    }
    .btn-primary {
        background-color: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }
    .btn-primary:hover {
        background-color: #2563eb;
    }
    .btn-secondary {
        background-color: var(--sidebar-bg);
        color: #374151;
        border-color: #d1d5db;
    }
    .btn-secondary:hover {
        background-color: #e5e7eb;
    }
    .btn-danger {
        background-color: #fee2e2;
        color: #dc2626;
        border-color: #fca5a5;
    }
    .btn-danger:hover {
        background-color: #fecaca;
    }

    /* Table */
    .table-responsive {
        width: 100%;
        overflow-x: auto;
        overflow-y: auto;
        max-height: 70vh;
        -webkit-overflow-scrolling: touch;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border: 1px solid #e5e7eb;
        position: relative;
    }
    .table {
        width: 100%;
        border-collapse: collapse;
        background-color: white;
        min-width: 600px; 
    }
    .table th, .table td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
    }
    .table th {
        background-color: var(--sidebar-bg);
        font-weight: 600;
        color: #374151;
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        position: sticky;
        top: 0;
        z-index: 10;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .table td {
        font-size: 0.875rem;
        color: #4b5563;
    }

    /* Form */
    .form-group {
        margin-bottom: 1rem;
    }
    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #374151;
    }
    .form-control, input[type="text"], input[type="number"], select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 1rem;
        box-sizing: border-box;
    }
    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        margin-top: 1.5rem;
    }

    .alert {
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 0.375rem;
    }
    .alert-error {
        background-color: #fee2e2;
        color: #991b1b;
        border: 1px solid #fecaca;
    }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

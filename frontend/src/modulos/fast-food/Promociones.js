import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../comun/Modal';

const Promociones = () => {
    const [promotions, setPromotions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [newPromo, setNewPromo] = useState({
        name: '',
        description: '',
        price: '',
        image: null,
        product_id: '',
        quantity: 1,
        is_active: true
    });
    const [editingPromo, setEditingPromo] = useState(null);

    const fetchPromotions = async () => {
        try {
            const response = await api.get('/api/menu/combos/?is_promotion=true', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setPromotions(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching promotions:', err);
            setError('Error al cargar las promociones');
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await api.get('/api/menu/products/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setProducts(response.data.results || response.data || []);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    };

    useEffect(() => {
        fetchPromotions();
        fetchProducts();
    }, []);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        setNewPromo(prev => ({ ...prev, [name]: newValue }));
    };

    const handleProductChange = (e) => {
        const prodId = e.target.value;
        const selectedProd = products.find(p => p.id === prodId);
        setNewPromo(prev => ({ 
            ...prev, 
            product_id: prodId,
            price: selectedProd ? selectedProd.price : prev.price
        }));
    };

    const handleImageChange = (e) => {
        setNewPromo(prev => ({ ...prev, image: e.target.files[0] }));
    };

    const handleEditPromo = async (promo) => {
        try {
            // Obtener los productos del combo para rellenar el formulario
            const response = await api.get(`/api/menu/combos/${promo.id}/products/`, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            const promoProducts = response.data;
            
            setEditingPromo(promo);
            setNewPromo({
                name: promo.name,
                description: promo.description,
                price: promo.price,
                is_active: promo.is_active,
                image: null,
                product_id: promoProducts.length > 0 ? promoProducts[0].product.id : '',
                quantity: promoProducts.length > 0 ? promoProducts[0].quantity : 1
            });
            setIsModalOpen(true);
        } catch (err) {
            console.error('Error fetching promo products:', err);
        }
    };

    const handleDeletePromo = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta promoción?')) {
            try {
                await api.delete(`/api/menu/combos/${id}/`, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
                fetchPromotions();
            } catch (err) {
                console.error('Error deleting promo:', err);
                alert('Error al eliminar la promoción');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!newPromo.product_id) {
            alert("Por favor seleccione un producto para la promoción.");
            return;
        }

        const slug = newPromo.name.toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

        // Paso 1: Guardar la promoción (Combo) usando FormData (para imagen)
        const formData = new FormData();
        formData.append('name', newPromo.name);
        formData.append('slug', slug);
        formData.append('description', newPromo.description);
        formData.append('price', newPromo.price);
        formData.append('is_promotion', 'true');
        formData.append('is_active', newPromo.is_active ? 'true' : 'false');
        
        if (newPromo.image instanceof File) {
            formData.append('image', newPromo.image);
        }

        try {
            let comboId;
            if (editingPromo) {
                await api.patch(`/api/menu/combos/${editingPromo.id}/`, formData, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                comboId = editingPromo.id;
            } else {
                const res = await api.post('/api/menu/combos/', formData, {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                comboId = res.data.id;
            }
            
            // Paso 2: Actualizar los productos de la promoción (Json)
            await api.patch(`/api/menu/combos/${comboId}/`, {
                combo_products: [
                    {
                        product_id: newPromo.product_id,
                        quantity: parseInt(newPromo.quantity, 10),
                        display_order: 1
                    }
                ]
            }, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
            });

            setIsModalOpen(false);
            setNewPromo({ name: '', description: '', price: '', image: null, product_id: '', quantity: 1, is_active: true });
            setEditingPromo(null);
            fetchPromotions();
        } catch (err) {
            console.error('Error saving promotion:', err);
            alert('Error al guardar la promoción. Verifique los datos.');
        }
    };

    if (loading) return <div>Cargando promociones...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#1f2937' }}>Gestión de Promociones</h2>
                    <p style={{ margin: 0, color: '#6c757d', fontSize: '0.9rem' }}>Crea ofertas, descuentos, 2x1 o sorteos asociados a tus productos.</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditingPromo(null);
                    setNewPromo({ name: '', description: '', price: '', image: null, product_id: '', quantity: 1, is_active: true });
                    setIsModalOpen(true);
                }} style={{ backgroundColor: '#ffc107', borderColor: '#ffc107', color: '#000', fontWeight: 'bold' }}>
                    + Nueva Promoción
                </button>
            </div>

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Imagen</th>
                            <th>Nombre Promoción</th>
                            <th>Precio Cobrado</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {promotions.length === 0 ? (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '2rem'}}>No hay promociones registradas. ¡Crea una para atraer clientes!</td></tr>
                        ) : (
                            promotions.map(promo => (
                                <tr key={promo.id}>
                                    <td>
                                        {promo.image ? (
                                            <img
                                                src={promo.image.startsWith('http') ? promo.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${promo.image}`}
                                                alt={promo.name}
                                                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }}
                                            />
                                        ) : (
                                            <div style={{ width: '50px', height: '50px', backgroundColor: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: '10px' }}>Sin foto</div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{fontWeight: 'bold', color: '#1a202c'}}>{promo.name}</div>
                                        <div style={{fontSize: '0.8rem', color: '#718096'}}>{promo.description}</div>
                                    </td>
                                    <td>
                                        <span style={{fontWeight: 'bold', color: '#38a169'}}>${promo.price}</span>
                                    </td>
                                    <td>
                                        {promo.is_active ? 
                                            <span style={{backgroundColor: '#c6f6d5', color: '#22543d', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem'}}>Activa</span> : 
                                            <span style={{backgroundColor: '#fed7d7', color: '#822727', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem'}}>Inactiva</span>
                                        }
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => handleEditPromo(promo)}
                                            style={{ marginRight: '5px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => handleDeletePromo(promo.id)}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPromo ? "Editar Promoción" : "Nueva Promoción"}>
                <form onSubmit={handleSubmit}>
                    <div style={{backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e9ecef'}}>
                        <h4 style={{marginTop: 0, marginBottom: '15px', fontSize: '1rem', color: '#495057'}}>1. Definir la Oferta</h4>
                        <div className="form-group">
                            <label>Nombre de la Promoción (Ej. 2x1 Fresas con Crema)</label>
                            <input type="text" name="name" value={newPromo.name} onChange={handleInputChange} required />
                        </div>
                        <div className="form-group">
                            <label>Descripción corta</label>
                            <textarea name="description" value={newPromo.description} onChange={handleInputChange} rows="2" />
                        </div>
                        <div className="form-group">
                            <label>Imagen Promocional</label>
                            <input type="file" accept="image/*" onChange={handleImageChange} required={!editingPromo} />
                        </div>
                    </div>

                    <div style={{backgroundColor: '#eef2ff', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #c7d2fe'}}>
                        <h4 style={{marginTop: 0, marginBottom: '15px', fontSize: '1rem', color: '#4338ca'}}>2. Reglas de Descuento e Inventario</h4>
                        <div className="form-group">
                            <label>¿A qué producto del menú aplica?</label>
                            <select className="form-control" name="product_id" value={newPromo.product_id} onChange={handleProductChange} required>
                                <option value="">Seleccione un producto</option>
                                {products.map(prod => (
                                    <option key={prod.id} value={prod.id}>{prod.name} (Stock: {prod.is_available ? 'Disp.' : 'Agotado'})</option>
                                ))}
                            </select>
                            {newPromo.product_id && products.find(p => p.id === newPromo.product_id) && (() => {
                                const sp = products.find(p => p.id === newPromo.product_id);
                                return (
                                    <div style={{display: 'flex', alignItems: 'center', marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                        {sp.image ? (
                                            <img src={sp.image.startsWith('http') ? sp.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${sp.image}`} alt={sp.name} style={{width: '50px', height: '50px', objectFit: 'contain', borderRadius: '4px', marginRight: '15px'}} />
                                        ) : (
                                            <div style={{width: '50px', height: '50px', backgroundColor: '#f1f5f9', borderRadius: '4px', marginRight: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8', textAlign: 'center'}}>Sin foto</div>
                                        )}
                                        <div>
                                            <div style={{fontWeight: 'bold', color: '#1e293b'}}>{sp.name}</div>
                                            <div style={{color: '#64748b', fontSize: '0.85rem'}}>Precio Base: <span style={{fontWeight: 'bold', color: '#10b981'}}>${sp.price}</span></div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        <div style={{display: 'flex', gap: '15px'}}>
                            <div className="form-group" style={{flex: 1}}>
                                <label>Cantidad que entregas al cliente</label>
                                <input type="number" name="quantity" value={newPromo.quantity} onChange={handleInputChange} min="1" step="1" required />
                                <small style={{color: '#6c757d', display: 'block', marginTop: '5px'}}>Esta cantidad se restará de bodega al vender.</small>
                            </div>
                            <div className="form-group" style={{flex: 1}}>
                                <label>Precio Final a Cobrar ($)</label>
                                <input type="number" name="price" value={newPromo.price} onChange={handleInputChange} min="0" step="0.01" required />
                                <small style={{color: '#6c757d', display: 'block', marginTop: '5px'}}>Ej: Para 2x1 pon el precio de 1.</small>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>
                            <input type="checkbox" name="is_active" checked={newPromo.is_active} onChange={handleInputChange} style={{ marginRight: '8px' }} />
                            Promoción Activa (Visible en el Punto de Venta)
                        </label>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" style={{backgroundColor: '#ffc107', borderColor: '#ffc107', color: '#000', fontWeight: 'bold'}}>Guardar Promoción</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Promociones;

// Mismos estilos que en Inventario.js
const styles = `
    .page-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
    .table-responsive { width: 100%; overflow-x: auto; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
    .table { width: 100%; border-collapse: collapse; background-color: white; min-width: 600px; }
    .table th, .table td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .table th { background-color: var(--sidebar-bg); font-weight: 600; color: #374151; font-size: 0.875rem; text-transform: uppercase; }
    .table td { font-size: 0.875rem; color: #4b5563; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; }
    .form-control, input[type="text"], input[type="number"], textarea, select { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 1rem; }
    .form-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

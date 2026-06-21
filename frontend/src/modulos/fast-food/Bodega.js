import React, { useState, useEffect, useContext } from 'react';
import inventoryService from '../../services/inventoryService';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import { AuthContext } from '../../context/AuthContext';

const Bodega = () => {
    const { user } = useContext(AuthContext);
    const roleName = user?.role_details?.name;
    const isAdmin = roleName === 'SUPER_ADMIN' || roleName === 'ADMIN_FAST_FOOD' || user?.is_superuser;

    const [activeTab, setActiveTab] = useState('insumos'); // insumos, movimientos, recetas
    
    // Estados generales
    const [supplies, setSupplies] = useState([]);
    const [movements, setMovements] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estado para Modales
    const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
    
    // Formularios
    const [editingSupply, setEditingSupply] = useState(null);
    const [supplyForm, setSupplyForm] = useState({ name: '', description: '', unit: '', current_stock: 0, is_active: true, is_production_item: false });
    const [unitOptions, setUnitOptions] = useState([]);
    
    const [movementForm, setMovementForm] = useState({ supply: '', movement_type: 'in', quantity: 0, reason: '', lockedSupply: false });
    
    const [allRecipes, setAllRecipes] = useState([]);
    const [recipeForm, setRecipeForm] = useState({ id: null, product: '', supply: '', quantity: 0 });
    const [viewDetailsProductId, setViewDetailsProductId] = useState(null);

    // (Mezclas movido a su propia página /fast-food/mezclas)

    const fetchData = async () => {
        setLoading(true);
        try {
            const [suppliesData, productsData, optionsData] = await Promise.all([
                inventoryService.getSupplies(),
                api.get('/api/menu/products/', { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE }),
                api.options('/api/menu/supplies/', { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE })
            ]);
            setSupplies(suppliesData);
            setProducts(productsData.data?.results || productsData.data || []);
            
            if (optionsData.data?.actions?.POST?.unit?.choices) {
                setUnitOptions(optionsData.data.actions.POST.unit.choices);
                if (optionsData.data.actions.POST.unit.choices.length > 0 && !supplyForm.unit) {
                    setSupplyForm(prev => ({ ...prev, unit: optionsData.data.actions.POST.unit.choices[0].value }));
                }
            }
            
            if (activeTab === 'movimientos') {
                const movs = await inventoryService.getMovements();
                setMovements(movs);
            }
            
            if (activeTab === 'recetas') {
                const recs = await inventoryService.getRecipeIngredients();
                setAllRecipes(recs);
            }
        } catch (error) {
            console.error("Error fetching bodega data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    // ---- HANDLERS INSUMOS ----
    const handleSupplySubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSupply) {
                await inventoryService.updateSupply(editingSupply.id, supplyForm);
            } else {
                const stockToSet = parseFloat(supplyForm.current_stock) || 0;
                const newSupply = await inventoryService.createSupply({ ...supplyForm, current_stock: 0 }); // create with 0
                if (stockToSet > 0) {
                    await inventoryService.recordMovement(newSupply.id, {
                        movement_type: 'in',
                        quantity: stockToSet,
                        reason: 'Stock inicial'
                    });
                }
            }
            setIsSupplyModalOpen(false);
            fetchData();
        } catch (error) {
            alert('Error al guardar insumo');
        }
    };

    const handleDeleteSupply = async (id) => {
        if(window.confirm('¿Eliminar este insumo? Se eliminarán también sus movimientos.')) {
            try {
                await inventoryService.deleteSupply(id);
                fetchData();
            } catch (error) {
                alert('Error al eliminar insumo');
            }
        }
    };

    // ---- HANDLERS MOVIMIENTOS ----
    const handleMovementSubmit = async (e) => {
        e.preventDefault();
        try {
            await inventoryService.recordMovement(movementForm.supply, {
                movement_type: movementForm.movement_type,
                quantity: parseFloat(movementForm.quantity),
                reason: movementForm.reason
            });
            setIsMovementModalOpen(false);
            fetchData();
        } catch (error) {
            alert('Error al registrar movimiento. Verifique los datos.');
        }
    };

    // ---- HANDLERS RECETAS ----
    const loadAllRecipes = async () => {
        try {
            const data = await inventoryService.getRecipeIngredients();
            setAllRecipes(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleRecipeSubmit = async (e) => {
        e.preventDefault();
        try {
            // Edit not implemented in service, but we can delete and create if needed, 
            // or if the service supports it we would use updateRecipeIngredient.
            // But wait, the service only has createRecipeIngredient and deleteRecipeIngredient.
            // So if editing, we delete the old and create the new.
            if (recipeForm.id) {
                await inventoryService.deleteRecipeIngredient(recipeForm.id);
            }
            await inventoryService.createRecipeIngredient({
                product: recipeForm.product,
                supply: recipeForm.supply,
                quantity: parseFloat(recipeForm.quantity),
                size: null
            });
            setIsRecipeModalOpen(false);
            loadAllRecipes();
        } catch (error) {
            console.error(error.response?.data || error);
            const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            alert('Error al guardar receta: ' + msg);
        }
    };
    
    const handleDeleteRecipe = async (id) => {
        if(window.confirm('¿Eliminar esta receta?')) {
            try {
                await inventoryService.deleteRecipeIngredient(id);
                loadAllRecipes();
            } catch (error) {
                alert('Error al eliminar');
            }
        }
    }


    const getStockDisplay = (supplyId) => {
        const s = supplies.find(sp => sp.id === supplyId);
        if (!s) return { stock: 0, unit: '', color: 'gray' };
        return {
            stock: s.current_stock,
            unit: s.unit_display,
            color: s.current_stock <= 0 ? 'red' : 'green'
        };
    };

    if (loading && supplies.length === 0) return <div>Cargando Bodega...</div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Bodega e Insumos</h2>
            </div>

            <div className="tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
                <button className={`btn ${activeTab === 'insumos' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('insumos')}>Insumos</button>
                {isAdmin && <button className={`btn ${activeTab === 'movimientos' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('movimientos')}>Movimientos</button>}
                <button className={`btn ${activeTab === 'recetas' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('recetas')}>Recetas (Descuentos)</button>
            </div>

            {/* TAB INSUMOS */}
            {activeTab === 'insumos' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn btn-primary" onClick={() => {
                            setEditingSupply(null);
                            setSupplyForm({ name: '', description: '', unit: unitOptions.length ? unitOptions[0].value : '', current_stock: 0, is_active: true, is_production_item: false });
                            setIsSupplyModalOpen(true);
                        }}>Nuevo Insumo</button>
                    </div>
                    
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Unidad</th>
                                    {isAdmin && <th>Stock Actual</th>}
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {supplies.length === 0 ? <tr><td colSpan="6">No hay insumos</td></tr> : supplies.map(s => (
                                    <tr key={s.id}>
                                        <td>{s.name}</td>
                                        <td>{s.unit_display}</td>
                                        {isAdmin && <td style={{ fontWeight: 'bold', color: s.current_stock <= 0 ? 'red' : 'green'}}>{Math.round(s.current_stock)}</td>}
                                        <td>
                                            {s.is_active ? 'Activo' : 'Inactivo'}
                                            {s.is_production_item && <span style={{ marginLeft: '4px', fontSize: '11px', background: '#0d6efd', color: '#fff', padding: '1px 6px', borderRadius: '8px' }}>Mezcla</span>}
                                        </td>
                                        <td>
                                            <button className="btn btn-secondary" style={{ marginRight: '5px', padding: '0.25rem' }} onClick={() => {
                                                setEditingSupply(s);
                                                setSupplyForm({ name: s.name, description: s.description, unit: s.unit, current_stock: s.current_stock, is_active: s.is_active, is_production_item: s.is_production_item || false });
                                                setIsSupplyModalOpen(true);
                                            }}>Editar</button>
                                            
                                            {isAdmin && (
                                                <button className="btn btn-danger" style={{ marginRight: '5px', padding: '0.25rem' }} onClick={() => handleDeleteSupply(s.id)}>Eliminar</button>
                                            )}
                                            
                                            <button className="btn btn-success" style={{ marginRight: '5px', padding: '0.25rem' }} title="Agregar Stock" onClick={() => {
                                                setMovementForm({ supply: s.id, movement_type: 'in', quantity: 0, reason: '', lockedSupply: true });
                                                setIsMovementModalOpen(true);
                                            }}><i className="bi bi-arrow-up"></i></button>
                                            
                                            {isAdmin && (
                                                <button className="btn btn-warning" style={{ padding: '0.25rem' }} title="Reducir Stock" onClick={() => {
                                                    setMovementForm({ supply: s.id, movement_type: 'out', quantity: 0, reason: '', lockedSupply: true });
                                                    setIsMovementModalOpen(true);
                                                }}><i className="bi bi-arrow-down"></i></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB MOVIMIENTOS */}
            {activeTab === 'movimientos' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn btn-primary" onClick={() => {
                            setMovementForm({ supply: supplies[0]?.id || '', movement_type: 'in', quantity: 0, reason: '', lockedSupply: false });
                            setIsMovementModalOpen(true);
                        }}>Registrar Movimiento</button>
                    </div>
                    
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Insumo</th>
                                    <th>Tipo</th>
                                    <th>Cantidad</th>
                                    <th>Motivo / Ref</th>
                                    <th>Usuario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.length === 0 ? <tr><td colSpan="6">No hay movimientos</td></tr> : movements.map(m => (
                                    <tr key={m.id}>
                                        <td>{new Date(m.created_at).toLocaleString()}</td>
                                        <td>{m.supply_name}</td>
                                        <td>
                                            <span className={`tag ${m.movement_type === 'in' ? 'tag-green' : m.movement_type === 'out' ? 'tag-red' : 'tag-gray'}`}>
                                                {m.movement_type_display}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 'bold', color: m.movement_type === 'in' ? 'green' : (m.movement_type === 'out' || m.movement_type === 'sale' ? 'red' : 'inherit') }}>
                                            {m.movement_type === 'in' ? '+' : (m.movement_type === 'out' || m.movement_type === 'sale' ? '-' : '')}{Math.round(m.quantity)}
                                        </td>
                                        <td>{m.reason} {m.reference_id && `(Ref: ${m.reference_id})`}</td>
                                        <td>{m.created_by}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB RECETAS */}
            {activeTab === 'recetas' && (() => {
                const productsWithRecipes = [...new Set(allRecipes.map(r => r.product))].map(productId => {
                    return {
                        product: productId,
                        product_name: allRecipes.find(r => r.product === productId).product_name,
                        recipes: allRecipes.filter(r => r.product === productId)
                    }
                });

                return (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn btn-primary" onClick={() => {
                            setRecipeForm({ id: null, product: products[0]?.id || '', supply: supplies[0]?.id || '', quantity: 0 });
                            setIsRecipeModalOpen(true);
                        }}>Nueva Receta</button>
                    </div>

                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Producto Principal</th>
                                    <th>Insumos Configurados</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productsWithRecipes.length === 0 ? <tr><td colSpan="3">No hay productos con recetas configuradas.</td></tr> : productsWithRecipes.map(p => (
                                    <tr key={p.product}>
                                        <td>{p.product_name}</td>
                                        <td>{p.recipes.length} insumo(s)</td>
                                        <td>
                                            <button className="btn btn-primary" style={{ padding: '0.25rem' }} onClick={() => setViewDetailsProductId(p.product)}>Ver Detalles / Editar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                );
            })()}

            {/* FIN TABLAS - Mezclas movido a su propia página /fast-food/mezclas */}

            {/* MODALS */}
            {/* Modal Insumo */}
            <Modal isOpen={isSupplyModalOpen} onClose={() => setIsSupplyModalOpen(false)} title={editingSupply ? 'Editar Insumo' : 'Nuevo Insumo'}>
                <form onSubmit={handleSupplySubmit}>
                    <div className="form-group">
                        <label>Nombre del Insumo</label>
                        <input type="text" required value={supplyForm.name} onChange={e => setSupplyForm({...supplyForm, name: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Unidad de Medida</label>
                        <select className="form-control" value={supplyForm.unit} onChange={e => setSupplyForm({...supplyForm, unit: e.target.value})}>
                            {unitOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.display_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Stock Inicial</label>
                        <input type="number" step="1" required value={supplyForm.current_stock} onChange={e => setSupplyForm({...supplyForm, current_stock: e.target.value})} disabled={!!editingSupply} />
                        {editingSupply && <small>Para modificar el stock de un insumo existente, registre un movimiento (Ingreso/Ajuste).</small>}
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id="is_production_item"
                            checked={supplyForm.is_production_item}
                            onChange={e => setSupplyForm({...supplyForm, is_production_item: e.target.checked})} />
                        <label htmlFor="is_production_item" style={{ margin: 0 }}>
                            Producto de mezcla (no aparece en POS, solo se gestiona desde Mezclas)
                        </label>
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsSupplyModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </Modal>

            {/* Modal Movimiento */}
            <Modal isOpen={isMovementModalOpen} onClose={() => setIsMovementModalOpen(false)} title="Registrar Movimiento de Bodega">
                <form onSubmit={handleMovementSubmit}>
                    <div className="form-group">
                        <label>Insumo</label>
                        <select className="form-control" required value={movementForm.supply} onChange={e => setMovementForm({...movementForm, supply: e.target.value})} disabled={movementForm.lockedSupply}>
                            {supplies.map(s => <option key={s.id} value={s.id}>{s.name} {isAdmin ? `(Stock actual: ${s.current_stock})` : ''}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Tipo de Movimiento</label>
                        <select className="form-control" value={movementForm.movement_type} onChange={e => setMovementForm({...movementForm, movement_type: e.target.value})}>
                            <option value="in">Ingreso (Sumar al stock)</option>
                            {isAdmin && (
                                <>
                                    <option value="out">Egreso (Restar al stock)</option>
                                    <option value="adjustment">Ajuste (Reemplazar stock exacto)</option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Cantidad</label>
                        <input type="number" step="1" required value={movementForm.quantity} onChange={e => setMovementForm({...movementForm, quantity: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Motivo</label>
                        <input type="text" required value={movementForm.reason} onChange={e => setMovementForm({...movementForm, reason: e.target.value})} placeholder="Ej: Compra a proveedor, daño..." />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsMovementModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Registrar</button>
                    </div>
                </form>
            </Modal>

            {/* Modal Detalles Receta */}
            {viewDetailsProductId && (() => {
                const viewDetailsProduct = [...new Set(allRecipes.map(r => r.product))]
                    .map(productId => ({
                        product: productId,
                        product_name: allRecipes.find(r => r.product === productId).product_name,
                        recipes: allRecipes.filter(r => r.product === productId)
                    })).find(p => p.product === viewDetailsProductId);

                if (!viewDetailsProduct) return null;

                return (
                    <Modal isOpen={true} onClose={() => setViewDetailsProductId(null)} title={`Detalles de Receta: ${viewDetailsProduct.product_name}`} maxWidth="800px">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                            <button className="btn btn-primary" onClick={() => {
                                setRecipeForm({ id: null, product: viewDetailsProduct.product, supply: supplies[0]?.id || '', quantity: 0 });
                                setIsRecipeModalOpen(true);
                            }}>Agregar Insumo a esta Receta</button>
                        </div>
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Insumo</th>
                                        <th>Cantidad</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewDetailsProduct.recipes.map(r => (
                                        <tr key={r.id}>
                                            <td>{r.supply_name}</td>
                                            <td>{Math.round(r.quantity)} {r.supply_unit}</td>
                                            <td>
                                                <button className="btn btn-secondary" style={{ marginRight: '5px', padding: '0.25rem' }} onClick={() => {
                                                    setRecipeForm({ id: r.id, product: r.product, supply: r.supply, quantity: r.quantity });
                                                    setIsRecipeModalOpen(true);
                                                }}>Editar</button>
                                                <button className="btn btn-danger" style={{ padding: '0.25rem' }} onClick={() => handleDeleteRecipe(r.id)}>Eliminar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Modal>
                );
            })()}

            {/* Modal Receta */}
            <Modal isOpen={isRecipeModalOpen} onClose={() => setIsRecipeModalOpen(false)} title={recipeForm.id ? "Editar Receta" : "Nueva Receta"}>
                <form onSubmit={handleRecipeSubmit}>
                    <div className="form-group">
                        <label>Producto del Menú</label>
                        <select className="form-control" required value={recipeForm.product} onChange={e => setRecipeForm({...recipeForm, product: e.target.value})}>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Insumo a descontar</label>
                        <select className="form-control" required value={recipeForm.supply} onChange={e => setRecipeForm({...recipeForm, supply: e.target.value})}>
                            {supplies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit_display})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Cantidad a descontar por cada venta</label>
                        <input type="number" step="1" required value={recipeForm.quantity} onChange={e => setRecipeForm({...recipeForm, quantity: e.target.value})} />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsRecipeModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};

export default Bodega;

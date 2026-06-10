import React, { useState, useEffect, useContext } from 'react';
import inventoryService from '../../services/inventoryService';
import api from '../../services/api';
import Modal from '../../comun/Modal';
import { AuthContext } from '../../context/AuthContext';

const Mezclas = () => {
    const { user } = useContext(AuthContext);
    const roleName = user?.role_details?.name;
    const isAdmin = roleName === 'SUPER_ADMIN' || roleName === 'ADMIN_FAST_FOOD' || user?.is_superuser;

    const [activeTab, setActiveTab] = useState('recetas');

    // Data
    const [supplies, setSupplies] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [productions, setProductions] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [movementFilter, setMovementFilter] = useState('');

    // Modales
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isProduceModalOpen, setIsProduceModalOpen] = useState(false);
    const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);

    // Formulario receta
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [recipeForm, setRecipeForm] = useState({
        name: '', description: '',
        output_supply: '', output_quantity: 0,
        is_active: true, ingredients: []
    });
    const [ingredientForm, setIngredientForm] = useState({ supply: '', quantity_required: 0 });

    // Cola
    const [productionQueue, setProductionQueue] = useState([]);
    const [queueForm, setQueueForm] = useState({ recipe: '', batch_multiplier: 1 });

    // Producir directo
    const [produceData, setProduceData] = useState({ recipe: null, batch_multiplier: 1, notes: '' });
    const [productionResult, setProductionResult] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [suppliesData, recipesData, productionsData] = await Promise.all([
                inventoryService.getSupplies(),
                inventoryService.getRecipes(),
                inventoryService.getProductions()
            ]);
            setSupplies(suppliesData);
            setRecipes(recipesData);
            setProductions(productionsData);

            if (activeTab === 'movimientos') {
                await fetchMovements(movementFilter);
            }
        } catch (error) {
            console.error("Error fetching mezcla data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMovements = async (movementType) => {
        try {
            const params = {};
            if (movementType) {
                params.movement_type = movementType;
            }
            const response = await api.get('/api/menu/supply-movements/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE,
                params
            });
            setMovements(response.data.results || response.data);
        } catch (error) {
            console.error("Error fetching movements:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const getStockDisplay = (supplyId) => {
        const s = supplies.find(sp => sp.id === supplyId);
        if (!s) return { stock: 0, unit: '', color: 'gray' };
        return {
            stock: s.current_stock,
            unit: s.unit_display,
            color: s.current_stock <= 0 ? 'red' : 'green'
        };
    };

    // --- Receta CRUD ---
    const handleOpenNewRecipe = () => {
        setEditingRecipe(null);
        setRecipeForm({ name: '', description: '', output_supply: '', output_quantity: 0, is_active: true, ingredients: [] });
        setIsRecipeModalOpen(true);
    };

    const handleOpenEditRecipe = (recipe) => {
        setEditingRecipe(recipe);
        setRecipeForm({
            name: recipe.name,
            description: recipe.description || '',
            output_supply: recipe.output_supply || '',
            output_quantity: recipe.output_quantity || 0,
            is_active: recipe.is_active,
            ingredients: recipe.ingredients || []
        });
        setIsEditModalOpen(true);
    };

    const handleAddIngredient = () => {
        if (!ingredientForm.supply || !ingredientForm.quantity_required) {
            alert('Seleccione un insumo y especifique la cantidad');
            return;
        }
        const supply = supplies.find(s => s.id === ingredientForm.supply);
        setRecipeForm(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, {
                supply: ingredientForm.supply,
                quantity_required: parseFloat(ingredientForm.quantity_required),
                supply_name: supply?.name || '',
                supply_unit: supply?.unit_display || ''
            }]
        }));
        setIngredientForm({ supply: '', quantity_required: 0 });
    };

    const handleRemoveIngredient = (index) => {
        setRecipeForm(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== index)
        }));
    };

    const handleSaveRecipe = async (e) => {
        e.preventDefault();
        try {
            const data = {
                name: recipeForm.name,
                description: recipeForm.description,
                output_supply: recipeForm.output_supply || null,
                output_quantity: parseFloat(recipeForm.output_quantity) || 0,
                is_active: recipeForm.is_active,
                ingredients: recipeForm.ingredients.map(ing => ({
                    supply: ing.supply,
                    quantity_required: parseFloat(ing.quantity_required)
                }))
            };

            if (editingRecipe) {
                await inventoryService.updateRecipe(editingRecipe.id, data);
            } else {
                await inventoryService.createRecipe(data);
            }
            setIsRecipeModalOpen(false);
            setIsEditModalOpen(false);
            fetchData();
        } catch (error) {
            const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            alert('Error al guardar receta: ' + msg);
        }
    };

    const handleDeleteRecipe = async (id) => {
        if (window.confirm('¿Eliminar esta receta de producción?')) {
            try {
                await inventoryService.deleteRecipe(id);
                fetchData();
            } catch (error) {
                alert('Error al eliminar receta');
            }
        }
    };

    // --- Producir ---
    const handleOpenProduce = (recipe) => {
        setProduceData({ recipe, batch_multiplier: 1, notes: '' });
        setProductionResult(null);
        setIsProduceModalOpen(true);
    };

    const handleConfirmProduce = async () => {
        try {
            const result = await inventoryService.produceRecipe(produceData.recipe.id, {
                batch_multiplier: parseFloat(produceData.batch_multiplier),
                notes: produceData.notes
            });
            setProductionResult(result);
            fetchData();
        } catch (error) {
            const errData = error.response?.data;
            if (errData?.details) {
                alert('Error de stock:\n' + errData.details.join('\n'));
            } else {
                alert('Error al producir: ' + (errData?.error || error.message));
            }
        }
    };

    // --- Cola de producción ---
    const handleAddToQueue = (recipe) => {
        setQueueForm({ recipe, batch_multiplier: 1 });
        setIsQueueModalOpen(true);
    };

    const handleConfirmAddToQueue = () => {
        if (!queueForm.recipe) return;
        const existing = productionQueue.find(q => q.recipe.id === queueForm.recipe.id);
        if (existing) {
            setProductionQueue(productionQueue.map(q =>
                q.recipe.id === queueForm.recipe.id
                    ? { ...q, batch_multiplier: q.batch_multiplier + parseFloat(queueForm.batch_multiplier) }
                    : q
            ));
        } else {
            setProductionQueue([...productionQueue, {
                recipe: queueForm.recipe,
                batch_multiplier: parseFloat(queueForm.batch_multiplier)
            }]);
        }
        setIsQueueModalOpen(false);
    };

    const handleRemoveFromQueue = (index) => {
        setProductionQueue(productionQueue.filter((_, i) => i !== index));
    };

    const handleProduceQueue = async () => {
        if (productionQueue.length === 0) return;
        let allResults = [];
        let hasError = false;
        for (const item of productionQueue) {
            try {
                const result = await inventoryService.produceRecipe(item.recipe.id, {
                    batch_multiplier: item.batch_multiplier,
                    notes: 'Producción desde cola'
                });
                allResults.push(result);
            } catch (error) {
                const errData = error.response?.data;
                hasError = true;
                alert(`Error con ${item.recipe.name}: ${errData?.error || error.message}`);
                break;
            }
        }
        if (!hasError) {
            setProductionResult({
                message: 'Producción en cola completada',
                items: allResults
            });
            setProductionQueue([]);
            fetchData();
        }
    };

    if (loading) return <div>Cargando Mezclas...</div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Mezclas / Producción</h2>
            </div>

            <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '10px', paddingBottom: '10px' }}>
                <button className={`btn ${activeTab === 'recetas' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('recetas')}>Recetas</button>
                <button className={`btn ${activeTab === 'producir' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('producir')}>Producir</button>
                <button className={`btn ${activeTab === 'historial' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('historial')}>Historial de Producciones</button>
                <button className={`btn ${activeTab === 'movimientos' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setActiveTab('movimientos'); fetchMovements(movementFilter); }}>Movimientos de Mezcla</button>
            </div>

            {/* TAB RECETAS */}
            {activeTab === 'recetas' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn btn-primary" onClick={handleOpenNewRecipe}>+ Nueva Receta</button>
                    </div>

                    {recipes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            <p>No hay recetas de producción</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {recipes.map(recipe => (
                                <div key={recipe.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '14px 18px', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <i className="bi bi-files" style={{ fontSize: '1.25rem', color: 'var(--primary-color)' }}></i>
                                                <strong style={{ fontSize: '17px' }}>{recipe.name}</strong>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--secondary-color)', padding: '2px 8px', borderRadius: '10px' }}>
                                                    {recipe.ingredients_count || 0} ingredientes
                                                </span>
                                            </div>
                                            {recipe.description && (
                                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{recipe.description}</p>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                            <button className="btn btn-success" style={{ padding: '0.5rem 1rem', fontWeight: 'bold' }}
                                                onClick={() => handleOpenProduce(recipe)}>▶ Producir</button>
                                            <button className="btn btn-outline-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '12px' }}
                                                onClick={() => handleAddToQueue(recipe)}>+ Cola</button>
                                            {isAdmin && (
                                                <>
                                                    <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '12px' }}
                                                        onClick={() => handleOpenEditRecipe(recipe)}>Editar</button>
                                                    <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '12px' }}
                                                        onClick={() => handleDeleteRecipe(recipe.id)}>Eliminar</button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ padding: '10px 18px' }}>
                                        {(recipe.ingredients || []).length === 0 ? (
                                            <p style={{ margin: '6px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>Sin ingredientes definidos</p>
                                        ) : (
                                            <table className="table" style={{ marginTop: 0 }}>
                                                <tbody>
                                                    {(recipe.ingredients || []).map((ing, i) => {
                                                        const stock = getStockDisplay(ing.supply);
                                                        const sufficient = stock.stock >= ing.quantity_required;
                                                        return (
                                                            <tr key={i} style={{ borderBottom: i < (recipe.ingredients || []).length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                                                <td style={{ padding: '6px 4px' }}>{ing.supply_name}</td>
                                                                <td style={{ padding: '6px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                    {Math.round(ing.quantity_required)} {ing.supply_unit}
                                                                </td>
                                                                <td style={{ padding: '6px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                    <span style={{ color: sufficient ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold', fontSize: '13px' }}>
                                                                        {Math.round(stock.stock)} {stock.unit}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                        {recipe.output_supply_name && (
                                            <div style={{ marginTop: '8px', padding: '6px 4px', borderTop: '1px solid var(--border-color)', color: 'var(--primary-color)', fontSize: '13px', fontWeight: 500 }}>
                                                → Genera: {Math.round(recipe.output_quantity)} {recipe.output_supply_unit || ''} de {recipe.output_supply_name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB PRODUCIR */}
            {activeTab === 'producir' && (
                <div>
                    {productionQueue.length > 0 && (
                        <div style={{ background: '#fff3cd', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', border: '1px solid #ffc107' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <strong>Cola de producción ({productionQueue.length} items)</strong>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button className="btn btn-success" style={{ padding: '0.25rem 0.5rem', fontSize: '13px' }} onClick={handleProduceQueue}>Producir Todo</button>
                                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '13px' }} onClick={() => setProductionQueue([])}>Vaciar</button>
                                </div>
                            </div>
                            {productionQueue.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: idx < productionQueue.length - 1 ? '1px solid #ffe69c' : 'none' }}>
                                    <span><strong>{item.recipe.name}</strong> x{item.batch_multiplier}</span>
                                    <button className="btn btn-danger" style={{ padding: '0.15rem 0.4rem', fontSize: '12px' }} onClick={() => handleRemoveFromQueue(idx)}>X</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {recipes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            <p>No hay recetas. Cree una primero en la pestaña Recetas.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {recipes.map(recipe => (
                                <div key={recipe.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '14px 18px', background: 'var(--sidebar-bg)'
                                    }}>
                                        <div>
                                            <strong style={{ fontSize: '17px' }}>{recipe.name}</strong>
                                            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--secondary-color)', padding: '2px 8px', borderRadius: '10px' }}>
                                                {recipe.ingredients_count || 0} ingredientes
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button className="btn btn-success" style={{ padding: '0.5rem 1rem', fontWeight: 'bold' }}
                                                onClick={() => handleOpenProduce(recipe)}>▶ Producir</button>
                                            <button className="btn btn-outline-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '12px' }}
                                                onClick={() => handleAddToQueue(recipe)}>+ Cola</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB HISTORIAL DE PRODUCCIONES */}
            {activeTab === 'historial' && (
                <div>
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Receta</th>
                                    <th>Batches</th>
                                    <th>Responsable</th>
                                    <th>Notas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productions.length === 0 ? (
                                    <tr><td colSpan="5">No hay producciones registradas.</td></tr>
                                ) : productions.map(p => (
                                    <tr key={p.id}>
                                        <td>{new Date(p.created_at).toLocaleString()}</td>
                                        <td><strong>{p.recipe_name}</strong></td>
                                        <td>x{p.batch_multiplier}</td>
                                        <td>{p.created_by || '-'}</td>
                                        <td>{p.notes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB MOVIMIENTOS DE MEZCLA */}
            {activeTab === 'movimientos' && (
                <div>
                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ marginBottom: 0 }}>Filtrar por tipo:</label>
                        <select className="form-control" style={{ width: 'auto' }}
                            value={movementFilter}
                            onChange={(e) => { setMovementFilter(e.target.value); fetchMovements(e.target.value); }}>
                            <option value="">Todos (Producción)</option>
                            <option value="production_out">Egresos por Producción</option>
                            <option value="production_in">Ingresos por Producción</option>
                        </select>
                    </div>
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Insumo</th>
                                    <th>Tipo</th>
                                    <th>Cantidad</th>
                                    <th>Motivo</th>
                                    <th>Usuario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.length === 0 ? (
                                    <tr><td colSpan="6">No hay movimientos de mezcla</td></tr>
                                ) : movements.map(m => {
                                    const isIn = m.movement_type === 'production_in';
                                    return (
                                        <tr key={m.id}>
                                            <td>{new Date(m.created_at).toLocaleString()}</td>
                                            <td>{m.supply_name}</td>
                                            <td>
                                                <span className={`tag ${isIn ? 'tag-green' : 'tag-red'}`}>
                                                    {m.movement_type_display}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 'bold', color: isIn ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                                {isIn ? '+' : '-'}{Math.round(m.quantity)}
                                            </td>
                                            <td>{m.reason}</td>
                                            <td>{m.created_by}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL NUEVA RECETA */}
            <Modal isOpen={isRecipeModalOpen} onClose={() => setIsRecipeModalOpen(false)} title="Nueva Receta de Producción">
                <form onSubmit={handleSaveRecipe}>
                    <div className="form-group">
                        <label>Nombre de la Receta</label>
                        <input type="text" className="form-control" required
                            value={recipeForm.name} onChange={e => setRecipeForm({...recipeForm, name: e.target.value})}
                            placeholder="Ej: Masa para Pan" />
                    </div>
                    <div className="form-group">
                        <label>Descripción</label>
                        <textarea className="form-control" rows="2"
                            value={recipeForm.description}
                            onChange={e => setRecipeForm({...recipeForm, description: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Insumo de Salida (opcional)</label>
                        <select className="form-control"
                            value={recipeForm.output_supply}
                            onChange={e => setRecipeForm({...recipeForm, output_supply: e.target.value})}>
                            <option value="">-- Sin producto de salida --</option>
                            {supplies.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.unit_display}){s.is_production_item ? ' [Solo Mezclas]' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    {recipeForm.output_supply && (
                        <div className="form-group">
                            <label>Cantidad generada por batch</label>
                            <input type="number" step="0.001" className="form-control"
                                value={recipeForm.output_quantity}
                                onChange={e => setRecipeForm({...recipeForm, output_quantity: e.target.value})} />
                        </div>
                    )}

                    <h4 style={{ marginTop: '16px', marginBottom: '8px' }}>Ingredientes</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label>Insumo</label>
                            <select className="form-control"
                                value={ingredientForm.supply}
                                onChange={e => setIngredientForm({...ingredientForm, supply: e.target.value})}>
                                <option value="">-- Seleccione --</option>
                                {supplies.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.unit_display})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: '0 0 120px', marginBottom: 0 }}>
                            <label>Cantidad</label>
                            <input type="number" step="0.001" className="form-control"
                                value={ingredientForm.quantity_required}
                                onChange={e => setIngredientForm({...ingredientForm, quantity_required: e.target.value})} />
                        </div>
                        <button type="button" className="btn btn-primary" style={{ marginBottom: '2px' }}
                            onClick={handleAddIngredient}>+</button>
                    </div>

                    {recipeForm.ingredients.length > 0 && (
                        <table className="table">
                            <thead>
                                <tr><th>Insumo</th><th>Cantidad</th><th>Acción</th></tr>
                            </thead>
                            <tbody>
                                {recipeForm.ingredients.map((ing, idx) => (
                                    <tr key={idx}>
                                        <td>{ing.supply_name || supplies.find(s => s.id === ing.supply)?.name || '?'}</td>
                                        <td>{Math.round(ing.quantity_required)} {ing.supply_unit || supplies.find(s => s.id === ing.supply)?.unit_display || ''}</td>
                                        <td>
                                            <button type="button" className="btn btn-danger btn-sm"
                                                onClick={() => handleRemoveIngredient(idx)}>X</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsRecipeModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar Receta</button>
                    </div>
                </form>
            </Modal>

            {/* MODAL EDITAR RECETA */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Receta de Producción">
                <form onSubmit={handleSaveRecipe}>
                    <div className="form-group">
                        <label>Nombre de la Receta</label>
                        <input type="text" className="form-control" required
                            value={recipeForm.name} onChange={e => setRecipeForm({...recipeForm, name: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Descripción</label>
                        <textarea className="form-control" rows="2"
                            value={recipeForm.description} onChange={e => setRecipeForm({...recipeForm, description: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Insumo de Salida (opcional)</label>
                        <select className="form-control"
                            value={recipeForm.output_supply}
                            onChange={e => setRecipeForm({...recipeForm, output_supply: e.target.value})}>
                            <option value="">-- Sin producto de salida --</option>
                            {supplies.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.unit_display}){s.is_production_item ? ' [Solo Mezclas]' : ''}</option>
                            ))}
                        </select>
                    </div>
                    {recipeForm.output_supply && (
                        <div className="form-group">
                            <label>Cantidad generada por batch</label>
                            <input type="number" step="0.001" className="form-control"
                                value={recipeForm.output_quantity}
                                onChange={e => setRecipeForm({...recipeForm, output_quantity: e.target.value})} />
                        </div>
                    )}

                    <h4 style={{ marginTop: '16px', marginBottom: '8px' }}>Ingredientes</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label>Insumo</label>
                            <select className="form-control"
                                value={ingredientForm.supply}
                                onChange={e => setIngredientForm({...ingredientForm, supply: e.target.value})}>
                                <option value="">-- Seleccione --</option>
                                {supplies.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.unit_display})</option>))}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: '0 0 120px', marginBottom: 0 }}>
                            <label>Cantidad</label>
                            <input type="number" step="0.001" className="form-control"
                                value={ingredientForm.quantity_required}
                                onChange={e => setIngredientForm({...ingredientForm, quantity_required: e.target.value})} />
                        </div>
                        <button type="button" className="btn btn-primary" style={{ marginBottom: '2px' }}
                            onClick={handleAddIngredient}>+</button>
                    </div>

                    {recipeForm.ingredients.length > 0 && (
                        <table className="table">
                            <thead><tr><th>Insumo</th><th>Cantidad</th><th>Acción</th></tr></thead>
                            <tbody>
                                {recipeForm.ingredients.map((ing, idx) => (
                                    <tr key={idx}>
                                        <td>{ing.supply_name || supplies.find(s => s.id === ing.supply)?.name || '?'}</td>
                                        <td>{Math.round(ing.quantity_required)} {ing.supply_unit || supplies.find(s => s.id === ing.supply)?.unit_display || ''}</td>
                                        <td><button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveIngredient(idx)}>X</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar Cambios</button>
                    </div>
                </form>
            </Modal>

            {/* MODAL PRODUCIR */}
            <Modal isOpen={isProduceModalOpen} onClose={() => { setIsProduceModalOpen(false); setProductionResult(null); }}
                title={productionResult ? 'Producción Exitosa' : `Producir: ${produceData.recipe?.name || ''}`}>
                {!productionResult ? (
                    <div>
                        {produceData.recipe && (
                            <div style={{ marginBottom: '16px' }}>
                                <p><strong>Receta:</strong> {produceData.recipe.name}</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{produceData.recipe.description}</p>
                                {(produceData.recipe.ingredients || []).length > 0 && (
                                    <table className="table">
                                        <thead><tr><th>Insumo</th><th>Cantidad por batch</th><th>Stock actual</th></tr></thead>
                                        <tbody>
                                            {(produceData.recipe.ingredients || []).map((ing, i) => {
                                                const stock = getStockDisplay(ing.supply);
                                                return (
                                                    <tr key={i}>
                                                        <td>{ing.supply_name}</td>
                                                        <td>{Math.round(ing.quantity_required)} {ing.supply_unit}</td>
                                                        <td style={{ color: stock.color, fontWeight: 'bold' }}>{Math.round(stock.stock)} {stock.unit}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        <div className="form-group">
                            <label>Cantidad de batches a producir</label>
                            <input type="number" step="0.5" min="0.5" className="form-control"
                                value={produceData.batch_multiplier}
                                onChange={e => setProduceData({...produceData, batch_multiplier: e.target.value})} />
                            {produceData.recipe?.output_supply_name && (
                                <small style={{ display: 'block', marginTop: '4px', color: 'var(--primary-color)' }}>
                                    Se generarán: {Math.round(parseFloat(produceData.batch_multiplier || 1) * parseFloat(produceData.recipe.output_quantity || 0))} {produceData.recipe.output_supply_unit || ''} de {produceData.recipe.output_supply_name}
                                </small>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Notas (opcional)</label>
                            <textarea className="form-control" rows="2"
                                value={produceData.notes}
                                onChange={e => setProduceData({...produceData, notes: e.target.value})} />
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => { setIsProduceModalOpen(false); setProductionResult(null); }}>Cancelar</button>
                            <button type="button" className="btn btn-success" onClick={handleConfirmProduce}>Confirmar Producción</button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <span style={{ fontSize: '48px' }}>✅</span>
                            <p style={{ fontWeight: 'bold', fontSize: '18px', margin: '8px 0' }}>{productionResult.message}</p>
                        </div>

                        {productionResult.items ? (
                            productionResult.items.map((item, idx) => (
                                <div key={idx} className="card" style={{ marginBottom: '12px', padding: '8px' }}>
                                    <p><strong>{item.recipe_name}</strong> x{item.batch_multiplier}</p>
                                    {item.deductions && (
                                        <div>
                                            <p style={{ fontWeight: 'bold', color: 'var(--danger-color)', margin: '4px 0' }}>Descontado:</p>
                                            {item.deductions.map((d, i) => (
                                                <p key={i} style={{ margin: '2px 0', fontSize: '13px' }}>- {d.supply_name}: {d.quantity} {d.unit}</p>
                                            ))}
                                        </div>
                                    )}
                                    {item.output && (
                                        <div>
                                            <p style={{ fontWeight: 'bold', color: 'var(--success-color)', margin: '4px 0' }}>Generado:</p>
                                            <p style={{ margin: '2px 0', fontSize: '13px' }}>+ {item.output.supply_name}: {item.output.quantity} {item.output.unit}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div>
                                {productionResult.deductions && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <p style={{ fontWeight: 'bold', color: 'var(--danger-color)', margin: '4px 0' }}>Descontado de inventario:</p>
                                        {productionResult.deductions.map((d, i) => (
                                            <p key={i} style={{ margin: '2px 0' }}>- {d.supply_name}: {d.quantity} {d.unit}</p>
                                        ))}
                                    </div>
                                )}
                                {productionResult.output && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <p style={{ fontWeight: 'bold', color: 'var(--success-color)', margin: '4px 0' }}>Generado:</p>
                                        <p style={{ margin: '2px 0' }}>+ {productionResult.output.supply_name}: {productionResult.output.quantity} {productionResult.output.unit}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="button" className="btn btn-primary" onClick={() => { setIsProduceModalOpen(false); setProductionResult(null); }}>Cerrar</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL COLA */}
            <Modal isOpen={isQueueModalOpen} onClose={() => setIsQueueModalOpen(false)} title="Agregar Mezcla a la Cola de Producción">
                {!queueForm.recipe ? (
                    <div>
                        <p>Seleccione una receta para agregar a la cola:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                            {recipes.map(r => (
                                <button key={r.id} className="btn btn-outline-primary"
                                    style={{ textAlign: 'left', padding: '12px', display: 'flex', justifyContent: 'space-between' }}
                                    onClick={() => setQueueForm({ ...queueForm, recipe: r })}>
                                    <span><strong>{r.name}</strong></span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{r.ingredients_count} ingredientes</span>
                                </button>
                            ))}
                            {recipes.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No hay recetas disponibles.</p>}
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setIsQueueModalOpen(false)}>Cancelar</button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p><strong>Receta seleccionada:</strong> {queueForm.recipe.name}</p>
                        <div className="form-group">
                            <label>Cantidad de batches</label>
                            <input type="number" step="0.5" min="0.5" className="form-control"
                                value={queueForm.batch_multiplier}
                                onChange={e => setQueueForm({...queueForm, batch_multiplier: e.target.value})} />
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setQueueForm({ ...queueForm, recipe: '' })}>Atrás</button>
                            <button type="button" className="btn btn-primary" onClick={handleConfirmAddToQueue}>Agregar a Cola</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Mezclas;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import printerService from '../../services/printerService';

// ====================================================================
// 1. Funciones de Ayuda (Definiciones de formato)
// ====================================================================

const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '$0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num || 0);
};

const formatDate = (dateString) => {
    try {
        if (!dateString) return 'Fecha no disponible';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString('es-MX', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
};

// Constantes para áreas táctiles (mínimo 44x44px)
const TOUCH_MIN_SIZE = '44px';

const PuntosVenta = () => {
    const navigate = useNavigate();

    // =====================================
    // 1. ESTADO DE DATOS Y CARGA
    // =====================================
    const [currentShift, setCurrentShift] = useState(null);
    const [checkingShift, setCheckingShift] = useState(true);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingOrder, setProcessingOrder] = useState(false);
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [showOrderDetails, setShowOrderDetails] = useState(false);
    const [editingNoteForItem, setEditingNoteForItem] = useState(null);
    const [noteText, setNoteText] = useState('');

    // 2. ESTADO DEL PUNTO DE VENTA
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [discountCode, setDiscountCode] = useState('');
    const [orderDiscountPercentage, setOrderDiscountPercentage] = useState(0);
    const [appliedDiscount, setAppliedDiscount] = useState(null);

    const [paymentMethod, setPaymentMethod] = useState('efectivo');
    const [transferReference, setTransferReference] = useState('');

    const [showReviewModal, setShowReviewModal] = useState(false);

    // 3.5 ESTADO DE CALCULADORA DE VUELTO
    const [cashGiven, setCashGiven] = useState(null);
    const [inputCash, setInputCash] = useState('');

    // 3. ESTADO DE CLIENTES
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        email: '',
        password: 'Password123!',
        password_confirmation: 'Password123!',
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        city: '',
        cedula: ''
    });

    // =====================================
    // 4. EFECTOS - CARGA INICIAL DE DATOS Y RESPONSIVIDAD
    // =====================================
    // Inject custom scrollbar styles
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            ::-webkit-scrollbar-track {
                background: #f1f1f1; 
            }
            ::-webkit-scrollbar-thumb {
                background: var(--border-color); 
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: var(--border-color); 
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const shiftRes = await api.get('/api/pos/shifts/current/', {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
                if (isMounted) {
                    setCurrentShift(shiftRes.data.shift || shiftRes.data);
                }
            } catch (err) {
                console.warn('No hay caja abierta o error cargando caja:', err);
                if (isMounted) {
                    setCurrentShift(null);
                }
            } finally {
                if (isMounted) {
                    setCheckingShift(false);
                }
            }

            try {
                const productsRes = await api.get('/api/menu/products/', {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });

                if (!isMounted) return;

                const loadedProducts = productsRes.data.results || productsRes.data || [];
                setProducts(loadedProducts);

            } catch (err) {
                console.error('Error cargando productos:', err);
            }

            try {
                const categoriesRes = await api.get('/api/menu/categories/', {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });

                if (!isMounted) return;

                const loadedCategories = categoriesRes.data.results || categoriesRes.data || [];
                setCategories(loadedCategories);

            } catch (err) {
                console.error('Error cargando categorías:', err);
            }

            try {
                const promosRes = await api.get('/api/menu/combos/?is_promotion=true', {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });

                if (!isMounted) return;

                const loadedPromos = promosRes.data.results || promosRes.data || [];
                setPromotions(loadedPromos.filter(p => p.is_active));

            } catch (err) {
                console.error('Error cargando promociones:', err);
            }

            try {
                const tablesRes = await api.get('/api/pos/tables/', {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });

                if (!isMounted) return;
                setTables(tablesRes.data.results || tablesRes.data || []);

            } catch (err) {
                console.warn('Mesas no disponibles');
                if (isMounted) {
                    setTables([]);
                }
            }

            if (isMounted) {
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, []);

    // Detectar tamaño de pantalla
    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth);
        };

        handleResize(); // Ejecutar al inicio
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // =====================================
    // 5. LÓGICA DEL CARRITO
    // =====================================
    const addToCart = useCallback((product, isPromo = false, promoQuantity = 1, promoDiscountPct = 0, promoName = '') => {
        setCart(prevCart => {
            const existingItemIndex = prevCart.findIndex(item => 
                item.product_id === product.id && 
                item.isPromo === isPromo &&
                item.name === (isPromo ? promoName : product.name)
            );
            if (existingItemIndex >= 0) {
                const newCart = [...prevCart];
                newCart[existingItemIndex] = {
                    ...newCart[existingItemIndex],
                    quantity: newCart[existingItemIndex].quantity + (isPromo ? promoQuantity : 1)
                };
                return newCart;
            } else {
                return [...prevCart, {
                    product_id: product.id,
                    name: isPromo ? promoName : product.name,
                    description: product.description || '',
                    price: parseFloat(product.price),
                    quantity: isPromo ? promoQuantity : 1,
                    image: isPromo ? product.promoImage : product.image,
                    note: isPromo ? 'Promo aplicada' : '',
                    discount_percentage: isPromo ? promoDiscountPct : 0,
                    isPromo: isPromo
                }];
            }
        });
    }, []);

    const handleAddPromo = async (promo) => {
        try {
            const res = await api.get(`/api/menu/combos/${promo.id}/products/`, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            const promoProducts = res.data;
            if (promoProducts.length > 0) {
                const comboProduct = promoProducts[0];
                const realProduct = comboProduct.product;
                const quantity = comboProduct.quantity;
                
                const originalTotal = realProduct.price * quantity;
                let discountPct = 0;
                if (originalTotal > 0 && promo.price < originalTotal) {
                    discountPct = ((originalTotal - promo.price) / originalTotal) * 100;
                }
                
                // Agregamos imagen de la promo al producto temporalmente
                realProduct.promoImage = promo.image;
                
                addToCart(realProduct, true, quantity, discountPct, promo.name);
            } else {
                alert("Esta promoción no tiene productos asociados.");
            }
        } catch(e) {
            console.error("Error al cargar la promo", e);
        }
    };

    const removeFromCart = useCallback((itemToRemove) => {
        setCart(prevCart => prevCart.filter(item => 
            !(item.product_id === itemToRemove.product_id && 
              item.isPromo === itemToRemove.isPromo && 
              item.name === itemToRemove.name)
        ));
    }, []);

    const updateQuantity = useCallback((itemToUpdate, delta) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.product_id === itemToUpdate.product_id && 
                    item.isPromo === itemToUpdate.isPromo && 
                    item.name === itemToUpdate.name) {
                    const newQuantity = Math.max(1, item.quantity + delta);
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });
        });
    }, []);

    const updateItemDiscount = useCallback((itemToUpdate, percentage) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.product_id === itemToUpdate.product_id && 
                    item.isPromo === itemToUpdate.isPromo && 
                    item.name === itemToUpdate.name) {
                    return { ...item, discount_percentage: Math.max(0, Math.min(100, percentage)) };
                }
                return item;
            });
        });
    }, []);

    const handleAddNote = (itemToNote) => {
        const item = cart.find(i => 
            i.product_id === itemToNote.product_id && 
            i.isPromo === itemToNote.isPromo && 
            i.name === itemToNote.name
        );
        // Usamos una combinacion unica para el estado
        setEditingNoteForItem(`${itemToNote.product_id}-${itemToNote.isPromo ? 'promo' : 'norm'}-${itemToNote.name}`);
        setNoteText(item?.note || '');
    };

    const saveNote = () => {
        if (!editingNoteForItem) return;

        setCart(prevCart => {
            return prevCart.map(item => {
                const itemId = `${item.product_id}-${item.isPromo ? 'promo' : 'norm'}-${item.name}`;
                if (itemId === editingNoteForItem) {
                    return { ...item, note: noteText.trim() };
                }
                return item;
            });
        });

        setEditingNoteForItem(null);
        setNoteText('');
    };

    const cancelNote = () => {
        setEditingNoteForItem(null);
        setNoteText('');
    };

    // =====================================
    // 6. CÁLCULOS DE PRECIOS
    // =====================================
    const calculateSubtotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }, [cart]);

    const calculateItemDiscounts = useMemo(() => {
        return cart.reduce((total, item) => {
            const percentage = parseFloat(item.discount_percentage) || 0;
            return total + (item.price * (percentage / 100) * item.quantity);
        }, 0);
    }, [cart]);

    const calculateOrderDiscount = useMemo(() => {
        const subtotalAfterItemDiscounts = calculateSubtotal - calculateItemDiscounts;
        const percentage = parseFloat(orderDiscountPercentage) || 0;
        return subtotalAfterItemDiscounts * (percentage / 100);
    }, [calculateSubtotal, calculateItemDiscounts, orderDiscountPercentage]);

    const calculateDiscountAmount = useMemo(() => {
        // También mantenemos appliedDiscount por si acaso
        let oldDiscount = 0;
        if (appliedDiscount) {
            const subtotal = calculateSubtotal - calculateItemDiscounts;
            if (appliedDiscount.discount_type === 'percentage') {
                oldDiscount = subtotal * (parseFloat(appliedDiscount.discount_value) / 100);
            } else if (appliedDiscount.discount_type === 'fixed_amount') {
                oldDiscount = Math.min(parseFloat(appliedDiscount.discount_value), subtotal);
            }
        }
        return calculateItemDiscounts + calculateOrderDiscount + oldDiscount;
    }, [calculateItemDiscounts, calculateOrderDiscount, appliedDiscount, calculateSubtotal]);

    const calculateTotal = useMemo(() => {
        const subtotal = calculateSubtotal;
        const discount = calculateDiscountAmount;
        return (subtotal - discount);
    }, [calculateSubtotal, calculateDiscountAmount]);

    // =====================================
    // 7. LÓGICA DE DESCUENTOS
    // =====================================
    const handleApplyDiscount = async () => {
        if (!discountCode) return;
        try {
            const response = await api.post('/api/pos/discounts/validate/', { code: discountCode }, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            if (response.data.valid) {
                setAppliedDiscount(response.data.discount);
                alert('Descuento aplicado correctamente');
            } else {
                alert(response.data.message || 'Código inválido');
                setAppliedDiscount(null);
            }
        } catch (err) {
            console.error('Error validating discount:', err);
            alert('Error al validar descuento');
            setAppliedDiscount(null);
        }
    };

    // =====================================
    // 8. LÓGICA DE CLIENTES
    // =====================================
    const searchCustomers = async (query) => {
        setCustomerSearch(query);
        if (query.length < 3) {
            setCustomers([]);
            return;
        }
        try {
            const response = await api.post('/api/customers/admin/search/', { query }, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setCustomers(response.data.data.customers || []);
        } catch (err) {
            console.error('Error searching customers:', err);
        }
    };

    const handleCreateCustomer = async (e) => {
        e.preventDefault();
        try {
            const customerData = {
                ...newCustomer,
                cedula: newCustomer.cedula || null
            };

            const response = await api.post('/api/customers/register/', customerData, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            alert('Cliente creado exitosamente');
            setShowCustomerModal(false);
            setSelectedCustomer(response.data.data.customer);
            setCustomerSearch(`${response.data.data.customer.first_name} ${response.data.data.customer.last_name}`);
            setCustomers([]);
            setNewCustomer({
                email: '',
                password: 'Password123!',
                password_confirmation: 'Password123!',
                first_name: '',
                last_name: '',
                phone: '',
                address: '',
                city: '',
                cedula: ''
            });
        } catch (err) {
            console.error('Error creating customer:', err);
            const errorData = err.response?.data;
            let errorMessage = 'Error al crear cliente';

            if (errorData?.errors) {
                errorMessage += ':\n' + Object.entries(errorData.errors)
                    .map(([key, val]) => `- ${key}: ${val}`)
                    .join('\n');
            } else if (errorData?.message) {
                errorMessage += ': ' + errorData.message;
            } else {
                errorMessage += ': ' + err.message;
            }

            alert(errorMessage);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCustomer(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // =====================================
    // 9. LÓGICA DE PROCESAMIENTO PRINCIPAL
    // =====================================

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            const isAvailable = product.is_active && product.is_available;

            return matchesCategory && matchesSearch && isAvailable;
        });
    }, [products, selectedCategory, searchTerm]);

    // 🖨️ FUNCIÓN PRINCIPAL CON IMPRESIÓN
    const finalPlaceOrder = async () => {
        if (cart.length === 0) return;

        setProcessingOrder(true);
        setShowReviewModal(false);

        let orderType = 'dine_in';
        let tableNumber = selectedTable;
        const DEFAULT_TABLE_NAME = 'GENERICA';

        if (selectedTable === 'takeout') {
            orderType = 'takeout';
            tableNumber = '';
        } else if (!selectedTable || selectedTable === 'Seleccionar mesa...') {
            orderType = 'dine_in';
            tableNumber = DEFAULT_TABLE_NAME;
        } else {
            orderType = 'dine_in';
            tableNumber = selectedTable;
        }

        // Preparar notas con información de pago
        let orderNotes = '';
        if (cashGiven) {
            const change = cashGiven - calculateTotal;
            orderNotes = `Pago con: ${formatCurrency(cashGiven)} - Cambio: ${formatCurrency(change)}`;
        }

        // Modificado para incluir notas en los items y porcentajes de descuento
        const orderPayload = {
            order_type: orderType,
            table_number: tableNumber,
            notes: orderNotes, // Nueva nota general
            discount_percentage: parseFloat(orderDiscountPercentage) || 0,
            payment_method: paymentMethod,
            payment_reference: transferReference,
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                notes: item.note || '', // Corregido: 'notes' (plural) para coincidir con el serializer
                discount_percentage: parseFloat(item.discount_percentage) || 0
            })),
            discount_code: appliedDiscount ? appliedDiscount.code : null,
            customer_id: selectedCustomer ? selectedCustomer.id : null,
            skip_print: true // Evitar que el backend imprima doble
        };

        try {
            // 1. CREAR LA ORDEN
            const orderResponse = await api.post('/api/orders/orders/', orderPayload, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });

            const createdOrder = orderResponse.data;

            // 2. PREPARAR DATOS PARA EL TICKET (incluyendo notas)
            const receiptData = {
                order_number: createdOrder.order_number || createdOrder.id,
                customer_name: selectedCustomer
                    ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                    : 'CONSUMIDOR FINAL',
                cashier_name: currentShift?.user_name || 'CAJA',
                table_number: selectedTable === 'takeout' ? 'PARA LLEVAR' : (selectedTable || 'MESA GENÉRICA'),
                items: cart.map(item => ({
                    name: item.name,
                    description: item.description || '',
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                    discount_percentage: parseFloat(item.discount_percentage) || 0,
                    total: parseFloat(item.price * item.quantity * (1 - (parseFloat(item.discount_percentage) || 0) / 100)),
                    note: item.note || '' // Incluir nota en los datos del ticket
                })),
                subtotal: parseFloat(calculateSubtotal),
                discount: parseFloat(calculateDiscountAmount),
                tax: parseFloat(calculateSubtotal * 0.12), // IVA 12%
                total: parseFloat(calculateTotal),
                payment_method: paymentMethod,
                payment_reference: transferReference,
                printed_at: new Date().toISOString() // Hora del cliente para el ticket
            };

            // 3. ENVIAR A IMPRIMIR (esto abre la caja automáticamente)
            try {
                const printResult = await printerService.printReceipt(receiptData);
                console.log('✅ Ticket enviado a impresión:', printResult);

                alert(
                    `✅ ¡Orden creada exitosamente!\n\n` +
                    `Orden: ${createdOrder.order_number || createdOrder.id}\n` +
                    `Ticket: ${printResult.job_number}\n\n` +
                    `🖨️ El ticket se está imprimiendo...\n` +
                    `🔓 La caja se abrirá automáticamente.`
                );
            } catch (printError) {
                console.error('⚠️ Error al imprimir:', printError);

                alert(
                    `⚠️ Orden creada pero no se pudo imprimir\n\n` +
                    `Orden: ${createdOrder.order_number || createdOrder.id}\n\n` +
                    `Error: ${printError.response?.data?.error || 'Error de conexión con la impresora'}\n\n` +
                    `Verifica que el agente de Windows esté ejecutándose.`
                );
            }

            // 4. LIMPIAR EL CARRITO
            setCart([]);
            setAppliedDiscount(null);
            setDiscountCode('');
            setSelectedTable('');
            setSelectedCustomer(null);
            setCustomerSearch('');
            setCashGiven(null); // Resetear calculadora
            setInputCash('');

        } catch (err) {
            console.error('❌ Error al procesar la orden:', err);
            const errorMsg = err.response?.data
                ? JSON.stringify(err.response.data)
                : 'Error al procesar la orden';
            alert(`❌ Error: ${errorMsg}`);
        } finally {
            setProcessingOrder(false);
        }
    };

    // 🔓 FUNCIÓN PARA ABRIR CAJA MANUALMENTE
    const handleOpenCashDrawer = async () => {
        try {
            await printerService.openCashDrawer();
            alert('✅ Caja abierta');
        } catch (error) {
            alert('❌ Error al abrir caja. Verifica que el agente esté ejecutándose.');
        }
    };

    const openOrderConfirmationModal = () => {
        if (cart.length === 0) {
            alert("El carrito está vacío.");
            return;
        }
        setShowReviewModal(true);
    };

    // =====================================
    // 10. COMPONENTES DE RENDERIZADO
    // =====================================

    const renderReviewDetails = () => (
        <div style={{ padding: screenWidth <= 1366 ? '0.5rem' : '0 1rem' }}>
            {/* Sección de configuración de orden */}
            <div style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderRadius: '8px',
                padding: screenWidth <= 1366 ? '0.75rem' : '1rem',
                marginBottom: '1rem'
            }}>
                {/* Cliente */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem'
                    }}>
                        Cliente
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input
                                type="text"
                                placeholder="Buscar por nombre, cédula o teléfono..."
                                style={{
                                    width: '100%',
                                    padding: screenWidth <= 1366 ? '0.5rem' : '0.75rem',
                                    border: '2px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                                    transition: 'all 0.2s',
                                    minHeight: TOUCH_MIN_SIZE
                                }}
                                value={customerSearch}
                                onChange={(e) => searchCustomers(e.target.value)}
                            />
                            {customers.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    zIndex: 10,
                                    width: '100%',
                                    backgroundColor: '#ffffff',
                                    border: '2px solid #d1d5db',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                    marginTop: '0.25rem',
                                    maxHeight: '200px',
                                    overflowY: 'auto'
                                }}>
                                    {customers.map(c => (
                                        <div
                                            key={c.id}
                                            style={{
                                                padding: '0.75rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid var(--sidebar-bg)',
                                                transition: 'background-color 0.15s',
                                                minHeight: TOUCH_MIN_SIZE,
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                            onClick={() => {
                                                setSelectedCustomer(c);
                                                setCustomerSearch(`${c.first_name} ${c.last_name}`);
                                                setCustomers([]);
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-bg)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                        >
                                            <div>
                                                <p style={{
                                                    fontWeight: '600',
                                                    color: 'var(--primary-color)',
                                                    marginBottom: '0.25rem',
                                                    fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem'
                                                }}>
                                                    {c.first_name} {c.last_name}
                                                </p>
                                                <p style={{
                                                    fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8125rem',
                                                    color: '#6b7280',
                                                    margin: 0
                                                }}>
                                                    {c.email} {c.cedula && `(${c.cedula})`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            style={{
                                width: TOUCH_MIN_SIZE,
                                height: TOUCH_MIN_SIZE,
                                backgroundColor: 'var(--primary-color)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1.5rem',
                                fontWeight: '300',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                            onClick={() => setShowCustomerModal(true)}
                            title="Agregar nuevo cliente"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Mesa/Tipo de Orden */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem'
                    }}>
                        Mesa / Tipo de Orden
                    </label>
                    <select
                        style={{
                            width: '100%',
                            padding: screenWidth <= 1366 ? '0.5rem' : '0.75rem',
                            border: '2px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                            color: 'var(--primary-color)',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: TOUCH_MIN_SIZE
                        }}
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                    >
                        <option value="">Seleccionar mesa...</option>
                        <option value="takeout">Para Llevar (Takeout)</option>
                        {tables.map(table => (
                            <option
                                key={table.id}
                                value={table.number}
                                disabled={table.status !== 'available'}
                            >
                                Mesa {table.number} {table.status !== 'available' ? '(Ocupada)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Porcentaje de Descuento (Orden) */}
                <div>
                    <label style={{
                        display: 'block',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem'
                    }}>
                        Descuento a la Orden (%)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        {[25, 50, 100].map(pct => (
                            <button
                                key={pct}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    backgroundColor: orderDiscountPercentage === pct ? 'var(--primary-color)' : '#f3f4f6',
                                    border: `1px solid ${orderDiscountPercentage === pct ? 'var(--primary-color)' : '#d1d5db'}`,
                                    borderRadius: '8px',
                                    color: orderDiscountPercentage === pct ? '#ffffff' : '#374151',
                                    fontWeight: '600',
                                    fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                                    cursor: 'pointer',
                                    minHeight: TOUCH_MIN_SIZE
                                }}
                                onClick={() => setOrderDiscountPercentage(pct)}
                            >
                                {pct}%
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Otro porcentaje"
                            style={{
                                flex: 1,
                                padding: screenWidth <= 1366 ? '0.5rem' : '0.75rem',
                                border: '2px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                                transition: 'all 0.2s',
                                minHeight: TOUCH_MIN_SIZE
                            }}
                            value={orderDiscountPercentage || ''}
                            onChange={(e) => setOrderDiscountPercentage(Math.max(0, Math.min(100, e.target.value)))}
                        />
                        <button
                            style={{
                                padding: screenWidth <= 1366 ? '0 0.75rem' : '0 1.5rem',
                                backgroundColor: '#fee2e2',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#dc2626',
                                fontWeight: '600',
                                fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                minHeight: TOUCH_MIN_SIZE,
                                minWidth: TOUCH_MIN_SIZE
                            }}
                            onClick={() => setOrderDiscountPercentage(0)}
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            {/* Resumen de productos */}
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                <p style={{ fontSize: screenWidth <= 1366 ? '0.875rem' : '1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    Cliente: {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'CONSUMIDOR FINAL'}
                </p>
                <p style={{ fontSize: screenWidth <= 1366 ? '0.75rem' : '0.9rem', color: '#4b5563' }}>
                    Mesa/Tipo: {selectedTable === 'takeout' ? 'Para Llevar' : selectedTable || 'Mesa Genérica (DINE-IN)'}
                </p>
            </div>

            <div style={{
                maxHeight: screenWidth <= 1366 ? '40vh' : '30vh',
                overflowY: 'auto',
                marginBottom: '1rem',
                fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9rem'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'var(--sidebar-bg)' }}>
                        <tr>
                            <th style={{
                                textAlign: 'left',
                                padding: screenWidth <= 1366 ? '0.25rem' : '0.5rem',
                                fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8rem',
                                color: '#4b5563'
                            }}>PRODUCTO</th>
                            <th style={{
                                width: '15%',
                                textAlign: 'right',
                                padding: screenWidth <= 1366 ? '0.25rem' : '0.5rem',
                                fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8rem',
                                color: '#4b5563'
                            }}>CANT.</th>
                            <th style={{
                                width: '25%',
                                textAlign: 'right',
                                padding: screenWidth <= 1366 ? '0.25rem' : '0.5rem',
                                fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8rem',
                                color: '#4b5563'
                            }}>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cart.map((item, index) => (
                            <React.Fragment key={index}>
                                <tr>
                                    <td style={{
                                        padding: screenWidth <= 1366 ? '0.25rem 0' : '0.5rem 0',
                                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9rem'
                                    }}>
                                        <div>
                                            {item.name}
                                            {item.note && (
                                                <div style={{
                                                    fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8rem',
                                                    color: '#6b7280',
                                                    fontStyle: 'italic',
                                                    marginTop: '2px'
                                                }}>
                                                    ({item.note})
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{
                                        textAlign: 'right',
                                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9rem'
                                    }}>{item.quantity}</td>
                                    <td style={{
                                        textAlign: 'right',
                                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9rem',
                                        fontWeight: '600'
                                    }}>
                                        {item.discount_percentage > 0 && (
                                            <div style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 'normal' }}>
                                                {formatCurrency(item.price * item.quantity)}
                                            </div>
                                        )}
                                        <div style={{ color: item.discount_percentage > 0 ? '#10b981' : 'inherit' }}>
                                            {formatCurrency(item.price * item.quantity * (1 - (parseFloat(item.discount_percentage) || 0) / 100))}
                                        </div>
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* SECCIÓN: MÉTODO DE PAGO */}
            <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--sidebar-bg)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
            }}>
                <h4 style={{
                    margin: '0 0 0.5rem 0',
                    color: 'var(--primary-color)',
                    fontSize: screenWidth <= 1366 ? '0.9rem' : '1rem'
                }}>
                    Método de Pago
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { 
                                id: 'efectivo', 
                                icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 256 256">
                                        <path d="M240,88V184a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V88A16,16,0,0,1,32,72H224A16,16,0,0,1,240,88Zm-16,0H32V184H224ZM128,104a24,24,0,1,0,24,24A24,24,0,0,0,128,104Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,128,136Zm88-32a8,8,0,0,0-8-8H192a8,8,0,0,0,0,16h16A8,8,0,0,0,216,104Zm-16,64H192a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16ZM64,104a8,8,0,0,0,8-8H56a8,8,0,0,0,0,16h8A8,8,0,0,0,64,104Zm0,64a8,8,0,0,0-8,8h16a8,8,0,0,0,0-16H56A8,8,0,0,0,64,168Z"></path>
                                    </svg>
                                )
                            },
                            { 
                                id: 'transferencia', 
                                icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 256 256">
                                        <path d="M240,208H224V104a8,8,0,0,0-4-6.93l-88-51a8,8,0,0,0-8,0l-88,51A8,8,0,0,0,32,104V208H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM48,108.62l80-46.4,80,46.4V208H176V120a8,8,0,0,0-16,0v88H96V120a8,8,0,0,0-16,0v88H48ZM128,144a16,16,0,1,0-16-16A16,16,0,0,0,128,144Z"></path>
                                    </svg>
                                )
                            }
                        ].map(method => (
                            <button
                                key={method.id}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '1rem',
                                    backgroundColor: paymentMethod === method.id ? 'var(--primary-color)' : '#ffffff',
                                    border: `2px solid ${paymentMethod === method.id ? 'var(--primary-color)' : '#d1d5db'}`,
                                    borderRadius: '12px',
                                    color: paymentMethod === method.id ? '#ffffff' : '#4b5563',
                                    cursor: 'pointer',
                                    minHeight: '70px',
                                    transition: 'all 0.2s ease-in-out'
                                }}
                                onClick={() => setPaymentMethod(method.id)}
                            >
                                {method.icon}
                            </button>
                        ))}
                    </div>

                    {paymentMethod === 'transferencia' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                                Número de Referencia:
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: 12345678"
                                value={transferReference}
                                onChange={(e) => setTransferReference(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '0.875rem',
                                    outline: 'none',
                                    minHeight: TOUCH_MIN_SIZE
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN: CALCULADORA DE VUELTO */}
            <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--sidebar-bg)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
            }}>
                <h4 style={{
                    margin: '0 0 0.5rem 0',
                    color: 'var(--primary-color)',
                    fontSize: screenWidth <= 1366 ? '0.9rem' : '1rem'
                }}>
                    Calculadora de Vuelto
                </h4>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#374151' }}>
                        Ingreso Manual:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            value={inputCash}
                            onChange={(e) => {
                                const val = e.target.value;
                                setInputCash(val);
                                setCashGiven(val ? parseFloat(val) : null);
                            }}
                            placeholder="0.00"
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '1rem'
                            }}
                        />
                        <button
                            onClick={() => {
                                setCashGiven(null);
                                setInputCash('');
                            }}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #ef4444',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Borrar
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                    {[1, 2, 5, 10, 20, 50, 100].map(bill => (
                        <button
                            key={bill}
                            onClick={() => {
                                const newVal = (cashGiven || 0) + bill;
                                setCashGiven(newVal);
                                setInputCash(newVal.toString());
                            }}
                            style={{
                                padding: '0.5rem',
                                backgroundColor: '#ffffff',
                                color: 'var(--primary-color)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                minHeight: TOUCH_MIN_SIZE
                            }}
                        >
                            + ${bill}
                        </button>
                    ))}
                </div>

                {cashGiven !== null && (
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid var(--sidebar-bg)',
                        textAlign: 'center'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#6b7280' }}>Total a Pagar:</span>
                            <span style={{ fontWeight: 'bold' }}>{formatCurrency(calculateTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#6b7280' }}>Efectivo Recibido:</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{formatCurrency(cashGiven)}</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '0.5rem',
                            paddingTop: '0.5rem',
                            borderTop: '1px dashed var(--border-color)',
                            fontSize: '1.2rem',
                            fontWeight: '800'
                        }}>
                            <span style={{ color: 'var(--primary-color)' }}>VUELTO:</span>
                            <span style={{ color: (cashGiven - calculateTotal) < 0 ? '#ef4444' : 'var(--primary-color)' }}>
                                {formatCurrency(cashGiven - calculateTotal)}
                            </span>
                        </div>
                        {(cashGiven - calculateTotal) < 0 && (
                            <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>
                                ⚠️ Monto insuficiente
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    fontSize: screenWidth <= 1366 ? '0.875rem' : '1rem',
                    color: '#6b7280'
                }}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(calculateSubtotal)}</span>
                </div>

                {appliedDiscount && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                        color: '#dc2626',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '1rem'
                    }}>
                        <span>Descuento</span>
                        <span>- {formatCurrency(calculateDiscountAmount)}</span>
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: screenWidth <= 1366 ? '1.25rem' : '1.5rem',
                    fontWeight: 'bold',
                    borderTop: '1px solid #ccc',
                    paddingTop: '0.75rem'
                }}>
                    <span>Total Final</span>
                    <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(calculateTotal)}</span>
                </div>
            </div>
        </div>
    );

    // Modal para agregar nota
    const renderNoteModal = () => (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: screenWidth <= 1366 ? '0.5rem' : '1rem'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: screenWidth <= 1366 ? '95%' : '500px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                padding: screenWidth <= 1366 ? '1rem' : '1.5rem'
            }}>
                <div style={{
                    marginBottom: '1rem',
                    borderBottom: '2px solid #e5e7eb',
                    paddingBottom: '0.75rem'
                }}>
                    <h3 style={{
                        fontSize: screenWidth <= 1366 ? '1.125rem' : '1.25rem',
                        fontWeight: '700',
                        color: '#111827',
                        margin: 0
                    }}>
                        Agregar Nota Especial
                    </h3>
                    <p style={{
                        fontSize: screenWidth <= 1366 ? '0.75rem' : '0.875rem',
                        color: '#6b7280',
                        marginTop: '0.25rem'
                    }}>
                        Escribe las especificaciones del producto (aparecerá entre paréntesis en el ticket)
                    </p>
                </div>

                <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ej: Sin cebolla, extra queso, bien cocido, etc."
                    style={{
                        width: '100%',
                        height: '120px',
                        padding: '0.75rem',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '1rem',
                        fontFamily: 'inherit',
                        resize: 'none',
                        boxSizing: 'border-box',
                        marginBottom: '1.5rem'
                    }}
                    maxLength={100}
                />

                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        style={{
                            padding: screenWidth <= 1366 ? '0.5rem 1rem' : '0.75rem 1.5rem',
                            backgroundColor: '#ffffff',
                            border: '2px solid #d1d5db',
                            borderRadius: '8px',
                            color: '#374151',
                            fontWeight: '600',
                            fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: TOUCH_MIN_SIZE
                        }}
                        onClick={cancelNote}
                    >
                        Cancelar
                    </button>
                    <button
                        style={{
                            padding: screenWidth <= 1366 ? '0.5rem 1rem' : '0.75rem 1.5rem',
                            backgroundColor: 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: '600',
                            fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: TOUCH_MIN_SIZE
                        }}
                        onClick={saveNote}
                    >
                        Guardar Nota
                    </button>
                </div>
            </div>
        </div>
    );

    // Renderizar vista con botones abajo (para pantallas <= 1366px - menos de 16 pulgadas)
    const renderCompactView = () => (
        <div style={{
            height: '100dvh', // Usar dvh para móviles/tablets
            maxHeight: '-webkit-fill-available', // Fallback iOS
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--sidebar-bg)',
            overflow: 'hidden',
            position: 'fixed', // Fijar viewport
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: '#ffffff',
                borderBottom: '2px solid #e5e7eb',
                padding: '0.75rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                flexShrink: 0,
                zIndex: 10
            }}>
                <h1 style={{
                    fontSize: screenWidth <= 768 ? '1.25rem' : '1.5rem',
                    fontWeight: '700',
                    color: '#111827',
                    margin: 0,
                    textAlign: 'center'
                }}>
                    Punto de Venta
                </h1>
            </div>

            {/* Contenido principal - Alterna entre productos y orden */}
            {!showOrderDetails ? (
                // Vista de productos
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0, // Clave para que el scroll interno funcione en flex
                    overflow: 'hidden'
                }}>
                    {/* Filtros */}
                    <div style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: 'var(--sidebar-bg)',
                        flexShrink: 0
                    }}>
                        <div style={{
                            display: 'flex',
                            overflowX: 'auto',
                            gap: '0.5rem',
                            paddingBottom: '0.25rem'
                        }}>
                            <button
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: selectedCategory === 'all' ? 'none' : '2px solid #d1d5db',
                                    backgroundColor: selectedCategory === 'all' ? 'var(--primary-color)' : '#ffffff',
                                    color: selectedCategory === 'all' ? '#ffffff' : '#374151',
                                    fontWeight: '600',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    minHeight: TOUCH_MIN_SIZE
                                }}
                                onClick={() => setSelectedCategory('all')}
                            >
                                Todos
                            </button>
                            {promotions.length > 0 && (
                                <button
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '6px',
                                        border: selectedCategory === 'promotions' ? 'none' : '2px solid #fbbf24',
                                        backgroundColor: selectedCategory === 'promotions' ? '#f59e0b' : '#fffbeb',
                                        color: selectedCategory === 'promotions' ? '#ffffff' : '#b45309',
                                        fontWeight: '700',
                                        fontSize: '0.875rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={() => setSelectedCategory('promotions')}
                                >
                                    ⭐ Promociones
                                </button>
                            )}
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '6px',
                                        border: selectedCategory === cat.id ? 'none' : '2px solid #d1d5db',
                                        backgroundColor: selectedCategory === cat.id ? 'var(--primary-color)' : '#ffffff',
                                        color: selectedCategory === cat.id ? '#ffffff' : '#374151',
                                        fontWeight: '600',
                                        fontSize: '0.875rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={() => setSelectedCategory(cat.id)}
                                >
                                    {cat.name.length > 12 ? cat.name.substring(0, 10) + '...' : cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid Productos */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '0.75rem',
                        backgroundColor: 'var(--sidebar-bg)'
                    }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: screenWidth <= 768 ?
                                'repeat(auto-fill, minmax(140px, 1fr))' :
                                'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '0.75rem'
                        }}>
                            {(selectedCategory === 'promotions' ? promotions : filteredProducts).map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        border: '1px solid #e5e7eb',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    onClick={() => selectedCategory === 'promotions' ? handleAddPromo(item) : addToCart(item)}
                                    onMouseEnter={screenWidth > 768 ? (e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                                        e.currentTarget.style.borderColor = selectedCategory === 'promotions' ? '#f59e0b' : 'var(--primary-color)';
                                    } : undefined}
                                    onMouseLeave={screenWidth > 768 ? (e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                    } : undefined}
                                >
                                    <div style={{
                                        height: screenWidth <= 768 ? '80px' : '100px',
                                        backgroundColor: 'var(--sidebar-bg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.5rem'
                                    }}>
                                        {item.image ? (
                                            <img
                                                src={item.image.startsWith('http') ? item.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${item.image}`}
                                                alt={item.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        ) : (
                                            <span style={{
                                                color: '#94a3b8',
                                                fontSize: '0.75rem',
                                                textAlign: 'center'
                                            }}>
                                                Sin imagen
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ padding: '0.5rem' }}>
                                        <h3 style={{
                                            fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                            fontWeight: '600',
                                            color: selectedCategory === 'promotions' ? '#b45309' : 'var(--primary-color)',
                                            marginBottom: '0.25rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {item.name}
                                        </h3>
                                        {item.description && (
                                            <p style={{
                                                fontSize: '0.75rem',
                                                color: '#6b7280',
                                                marginBottom: '0.25rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical'
                                            }}>
                                                {item.description}
                                            </p>
                                        )}
                                        <p style={{
                                            fontSize: screenWidth <= 768 ? '1rem' : '1.125rem',
                                            fontWeight: '700',
                                            color: selectedCategory === 'promotions' ? '#b45309' : 'var(--primary-color)',
                                            margin: 0
                                        }}>
                                            ${item.price}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                // Vista de orden
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    {/* Header de orden */}
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: 'var(--sidebar-bg)',
                        flexShrink: 0,
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 style={{
                            fontSize: screenWidth <= 768 ? '1rem' : '1.125rem',
                            fontWeight: '700',
                            color: '#111827',
                            margin: 0
                        }}>
                            Orden Actual ({cart.length})
                        </h3>
                        <button
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: 'var(--primary-color)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                minHeight: TOUCH_MIN_SIZE
                            }}
                            onClick={() => setShowOrderDetails(false)}
                        >
                            ← Productos
                        </button>
                    </div>

                    {/* Contenido del carrito */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {cart.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 1rem',
                                color: '#9ca3af',
                                fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem'
                            }}>
                                <p style={{ margin: 0 }}>No hay productos en el carrito</p>
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                flex: 1
                            }}>
                                {cart.map((item, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '0.75rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        {/* Información del producto */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{
                                                    fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                                    fontWeight: '600',
                                                    color: 'var(--primary-color)',
                                                    marginBottom: '0.25rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {item.name}
                                                </h4>
                                                <p style={{
                                                    fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
                                                    color: '#6b7280',
                                                    margin: 0
                                                }}>
                                                    {item.discount_percentage > 0 ? (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', marginRight: '0.25rem', color: '#9ca3af' }}>
                                                                {formatCurrency(item.price)}
                                                            </span>
                                                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                                                                {formatCurrency(item.price * (1 - (parseFloat(item.discount_percentage) || 0) / 100))} c/u
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>{formatCurrency(item.price)} c/u</>
                                                    )}
                                                </p>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    border: '2px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#ffffff'
                                                }}>
                                                    <button
                                                        style={{
                                                            width: screenWidth <= 768 ? '36px' : '40px',
                                                            height: screenWidth <= 768 ? '36px' : '40px',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: '#6b7280',
                                                            fontSize: screenWidth <= 768 ? '1rem' : '1.25rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={() => updateQuantity(item, -1)}
                                                    >
                                                        −
                                                    </button>
                                                    <span style={{
                                                        width: screenWidth <= 768 ? '30px' : '34px',
                                                        textAlign: 'center',
                                                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                                        fontWeight: '600',
                                                        color: 'var(--primary-color)'
                                                    }}>
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        style={{
                                                            width: screenWidth <= 768 ? '36px' : '40px',
                                                            height: screenWidth <= 768 ? '36px' : '40px',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: '#6b7280',
                                                            fontSize: screenWidth <= 768 ? '1rem' : '1.25rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={() => updateQuantity(item, 1)}
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <button
                                                    style={{
                                                        width: screenWidth <= 768 ? '36px' : '40px',
                                                        height: screenWidth <= 768 ? '36px' : '40px',
                                                        backgroundColor: '#fee2e2',
                                                        border: '2px solid #fecaca',
                                                        borderRadius: '6px',
                                                        color: '#dc2626',
                                                        fontSize: screenWidth <= 768 ? '1rem' : '1.125rem',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onClick={() => removeFromCart(item)}
                                                    title="Eliminar producto"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>

                                        {/* Nota y descuento del producto */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingTop: '0.5rem',
                                            borderTop: '1px dashed #e5e7eb'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                {item.note ? (
                                                    <div style={{
                                                        fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
                                                        color: '#6b7280',
                                                        fontStyle: 'italic',
                                                        backgroundColor: 'var(--sidebar-bg)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        <strong>Nota:</strong> {item.note}
                                                    </div>
                                                ) : (
                                                    <span style={{
                                                        fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
                                                        color: '#9ca3af',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        Sin notas especiales
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#ffffff'
                                                }}>
                                                    <span style={{ padding: '0.25rem', backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem' }}>%</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={item.discount_percentage || ''}
                                                        onChange={(e) => updateItemDiscount(item, e.target.value)}
                                                        placeholder="0"
                                                        style={{
                                                            width: '32px',
                                                            border: 'none',
                                                            padding: '0.25rem',
                                                            textAlign: 'center',
                                                            fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                </div>

                                                <button
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        backgroundColor: item.note ? '#fef3c7' : 'var(--sidebar-bg)',
                                                        border: `1px solid ${item.note ? '#fbbf24' : '#d1d5db'}`,
                                                        borderRadius: '4px',
                                                        color: item.note ? '#92400e' : '#374151',
                                                        fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
                                                        fontWeight: '500',
                                                        cursor: 'pointer',
                                                        marginLeft: '0.25rem',
                                                        whiteSpace: 'nowrap',
                                                        minHeight: TOUCH_MIN_SIZE
                                                    }}
                                                    onClick={() => handleAddNote(item)}
                                                    title={item.note ? "Editar nota" : "Agregar nota"}
                                                >
                                                    {item.note ? '📝 Editar' : '✏️ Nota'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Totales y Botones */}
                        {cart.length > 0 && (
                            <div style={{
                                marginTop: 'auto',
                                paddingTop: '1rem',
                                borderTop: '2px solid #e5e7eb'
                            }}>
                                {/* Totales */}
                                <div style={{
                                    paddingBottom: '1rem',
                                    marginBottom: '0.75rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.5rem',
                                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                        color: '#6b7280'
                                    }}>
                                        <span>Subtotal</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(calculateSubtotal)}</span>
                                    </div>

                                    {appliedDiscount && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.5rem',
                                            fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                            color: '#dc2626',
                                            fontWeight: '600'
                                        }}>
                                            <span>Descuento</span>
                                            <span>- {formatCurrency(calculateDiscountAmount)}</span>
                                        </div>
                                    )}

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        paddingTop: '0.75rem',
                                        borderTop: '2px solid #e5e7eb',
                                        fontSize: screenWidth <= 768 ? '1.25rem' : '1.5rem',
                                        fontWeight: '700',
                                        color: '#111827'
                                    }}>
                                        <span>Total</span>
                                        <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(calculateTotal)}</span>
                                    </div>
                                </div>

                                {/* Botones principales */}
                                <button
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        backgroundColor: processingOrder ? '#d1d5db' : 'var(--primary-color)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: screenWidth <= 768 ? '1rem' : '1.125rem',
                                        fontWeight: '700',
                                        cursor: processingOrder ? 'not-allowed' : 'pointer',
                                        marginBottom: '0.5rem',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={openOrderConfirmationModal}
                                    disabled={processingOrder}
                                >
                                    {processingOrder ? 'Procesando...' : 'Revisar y Pagar'}
                                </button>

                                <button
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        backgroundColor: 'var(--primary-color)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={handleOpenCashDrawer}
                                >
                                    🔓 Abrir Caja
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Barra inferior con botones */}
            <div style={{
                backgroundColor: '#ffffff',
                borderTop: '2px solid #e5e7eb',
                padding: '0.5rem',
                display: 'flex',
                gap: '0.5rem',
                flexShrink: 0
            }}>
                <button
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: showOrderDetails ? '#e5e7eb' : 'var(--primary-color)',
                        border: 'none',
                        borderRadius: '8px',
                        color: showOrderDetails ? '#374151' : '#ffffff',
                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        minHeight: TOUCH_MIN_SIZE
                    }}
                    onClick={() => setShowOrderDetails(false)}
                >
                    Productos
                </button>
                <button
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: !showOrderDetails ? '#e5e7eb' : 'var(--primary-color)',
                        border: 'none',
                        borderRadius: '8px',
                        color: !showOrderDetails ? '#374151' : '#ffffff',
                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        minHeight: TOUCH_MIN_SIZE,
                        position: 'relative'
                    }}
                    onClick={() => setShowOrderDetails(true)}
                >
                    Orden {cart.length > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {cart.length}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );

    // Renderizar vista de escritorio dividida (para pantallas > 1366px - más de 16 pulgadas)
    const renderDesktopView = () => (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--sidebar-bg)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: '#ffffff',
                borderBottom: '2px solid #e5e7eb',
                padding: '1rem 1.5rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}>
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    color: '#111827',
                    margin: 0,
                    letterSpacing: '-0.025em'
                }}>
                    Punto de Venta
                </h1>
            </div>

            <div style={{
                display: 'flex',
                flex: 1,
                overflow: 'hidden',
                flexDirection: 'row'
            }}>
                {/* Panel Izquierdo: Catálogo */}
                <div style={{
                    flex: '1 1 60%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#ffffff',
                    borderRight: '2px solid #e5e7eb',
                    minHeight: 'auto',
                    minWidth: 0,
                    maxWidth: '100%'
                }}>
                    {/* Filtros */}
                    <div style={{
                        padding: '1rem',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: 'var(--sidebar-bg)',
                        flexShrink: 0,
                        maxWidth: '100%',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            overflowX: 'auto',
                            paddingBottom: '0.25rem',
                            width: '100%'
                        }}>
                            <button
                                style={{
                                    padding: '0.625rem 1.25rem',
                                    borderRadius: '6px',
                                    border: selectedCategory === 'all' ? 'none' : '2px solid #d1d5db',
                                    backgroundColor: selectedCategory === 'all' ? 'var(--primary-color)' : '#ffffff',
                                    color: selectedCategory === 'all' ? '#ffffff' : '#374151',
                                    fontWeight: '600',
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    boxShadow: selectedCategory === 'all' ? '0 2px 4px rgba(100, 16, 14, 0.3)' : 'none',
                                    minHeight: TOUCH_MIN_SIZE
                                }}
                                onClick={() => setSelectedCategory('all')}
                            >
                                Todos los productos
                            </button>
                            {promotions.length > 0 && (
                                <button
                                    style={{
                                        padding: '0.625rem 1.25rem',
                                        borderRadius: '6px',
                                        border: selectedCategory === 'promotions' ? 'none' : '2px solid #fbbf24',
                                        backgroundColor: selectedCategory === 'promotions' ? '#f59e0b' : '#fffbeb',
                                        color: selectedCategory === 'promotions' ? '#ffffff' : '#b45309',
                                        fontWeight: '700',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap',
                                        boxShadow: selectedCategory === 'promotions' ? '0 2px 4px rgba(245, 158, 11, 0.3)' : 'none',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={() => setSelectedCategory('promotions')}
                                >
                                    ⭐ Promociones
                                </button>
                            )}
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    style={{
                                        padding: '0.625rem 1.25rem',
                                        borderRadius: '6px',
                                        border: selectedCategory === cat.id ? 'none' : '2px solid #d1d5db',
                                        backgroundColor: selectedCategory === cat.id ? 'var(--primary-color)' : '#ffffff',
                                        color: selectedCategory === cat.id ? '#ffffff' : '#374151',
                                        fontWeight: '600',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap',
                                        boxShadow: selectedCategory === cat.id ? '0 2px 4px rgba(100, 16, 14, 0.3)' : 'none',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={() => setSelectedCategory(cat.id)}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid Productos */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1.5rem',
                        backgroundColor: 'var(--sidebar-bg)'
                    }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '1rem'
                        }}>
                            {(selectedCategory === 'promotions' ? promotions : filteredProducts).map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '10px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        border: '1px solid #e5e7eb',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    onClick={() => selectedCategory === 'promotions' ? handleAddPromo(item) : addToCart(item)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                                        e.currentTarget.style.borderColor = selectedCategory === 'promotions' ? '#f59e0b' : 'var(--primary-color)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                    }}
                                >
                                    <div style={{
                                        height: '140px',
                                        backgroundColor: 'var(--sidebar-bg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.75rem'
                                    }}>
                                        {item.image ? (
                                            <img
                                                src={item.image.startsWith('http') ? item.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${item.image}`}
                                                alt={item.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        ) : (
                                            <span style={{
                                                color: '#94a3b8',
                                                fontSize: '0.75rem',
                                                textAlign: 'center'
                                            }}>
                                                Sin imagen
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ padding: '0.875rem' }}>
                                        <h3 style={{
                                            fontSize: '0.9375rem',
                                            fontWeight: '600',
                                            color: selectedCategory === 'promotions' ? '#b45309' : 'var(--primary-color)',
                                            marginBottom: '0.375rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {item.name}
                                        </h3>
                                        {item.description && (
                                            <p style={{
                                                fontSize: '0.75rem',
                                                color: '#6b7280',
                                                marginBottom: '0.375rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical'
                                            }}>
                                                {item.description}
                                            </p>
                                        )}
                                        <p style={{
                                            fontSize: '1.125rem',
                                            fontWeight: '700',
                                            color: selectedCategory === 'promotions' ? '#b45309' : 'var(--primary-color)',
                                            margin: 0
                                        }}>
                                            ${item.price}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Panel Derecho: Orden Actual */}
                <div style={{
                    flex: screenWidth <= 1024 ? '0 0 320px' : '0 0 400px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.05)',
                    flexShrink: 0
                }}>
                    {/* Header de Orden Actual */}
                    <div style={{
                        padding: '1rem 1.5rem',
                        backgroundColor: 'var(--sidebar-bg)',
                        flexShrink: 0,
                        borderBottom: '1px solid #e5e7eb'
                    }}>
                        <h3 style={{
                            fontSize: '1.125rem',
                            fontWeight: '700',
                            color: '#111827',
                            margin: 0
                        }}>
                            Orden Actual
                        </h3>
                    </div>

                    {/* Contenido del Carrito */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {cart.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 1rem',
                                color: '#9ca3af',
                                fontSize: '0.875rem'
                            }}>
                                <p style={{ margin: 0 }}>No hay productos en el carrito</p>
                                <p style={{
                                    margin: '0.5rem 0 0 0',
                                    fontSize: '0.8125rem'
                                }}>
                                    Selecciona productos para comenzar
                                </p>
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                flex: 1
                            }}>
                                {cart.map((item, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '10px',
                                            padding: '1rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        {/* Información del producto */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{
                                                    fontSize: '0.9375rem',
                                                    fontWeight: '600',
                                                    color: 'var(--primary-color)',
                                                    marginBottom: '0.375rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {item.name}
                                                </h4>
                                                <p style={{
                                                    fontSize: '0.8125rem',
                                                    color: '#6b7280',
                                                    margin: 0
                                                }}>
                                                    {item.discount_percentage > 0 ? (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', marginRight: '0.25rem', color: '#9ca3af' }}>
                                                                {formatCurrency(item.price)}
                                                            </span>
                                                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                                                                {formatCurrency(item.price * (1 - (parseFloat(item.discount_percentage) || 0) / 100))} c/u
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>{formatCurrency(item.price)} c/u</>
                                                    )}
                                                </p>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    border: '2px solid #e5e7eb',
                                                    borderRadius: '8px',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#ffffff'
                                                }}>
                                                    <button
                                                        style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: '#6b7280',
                                                            fontSize: '1.25rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={() => updateQuantity(item, -1)}
                                                    >
                                                        −
                                                    </button>
                                                    <span style={{
                                                        width: '36px',
                                                        textAlign: 'center',
                                                        fontSize: '0.9375rem',
                                                        fontWeight: '600',
                                                        color: 'var(--primary-color)'
                                                    }}>
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: '#6b7280',
                                                            fontSize: '1.25rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={() => updateQuantity(item, 1)}
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <button
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        backgroundColor: '#fee2e2',
                                                        border: '2px solid #fecaca',
                                                        borderRadius: '8px',
                                                        color: '#dc2626',
                                                        fontSize: '1.125rem',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onClick={() => removeFromCart(item)}
                                                    title="Eliminar producto"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>

                                        {/* Nota y descuento del producto */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingTop: '0.75rem',
                                            borderTop: '1px dashed #e5e7eb'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                {item.note ? (
                                                    <div style={{
                                                        fontSize: '0.8125rem',
                                                        color: '#6b7280',
                                                        fontStyle: 'italic',
                                                        backgroundColor: 'var(--sidebar-bg)',
                                                        padding: '0.375rem 0.75rem',
                                                        borderRadius: '4px',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        <strong>Nota:</strong> {item.note}
                                                    </div>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '0.8125rem',
                                                        color: '#9ca3af',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        Sin notas especiales
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#ffffff'
                                                }}>
                                                    <span style={{ padding: '0.375rem', backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '0.8125rem' }}>%</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={item.discount_percentage || ''}
                                                        onChange={(e) => updateItemDiscount(item, e.target.value)}
                                                        placeholder="0"
                                                        style={{
                                                            width: '40px',
                                                            border: 'none',
                                                            padding: '0.375rem',
                                                            textAlign: 'center',
                                                            fontSize: '0.8125rem',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                </div>

                                                <button
                                                    style={{
                                                        padding: '0.375rem 0.75rem',
                                                        backgroundColor: item.note ? '#fef3c7' : 'var(--sidebar-bg)',
                                                        border: `1px solid ${item.note ? '#fbbf24' : '#d1d5db'}`,
                                                        borderRadius: '4px',
                                                        color: item.note ? '#92400e' : '#374151',
                                                        fontSize: '0.8125rem',
                                                        fontWeight: '500',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        minHeight: TOUCH_MIN_SIZE,
                                                        minWidth: '60px'
                                                    }}
                                                    onClick={() => handleAddNote(item)}
                                                    title={item.note ? "Editar nota" : "Agregar nota"}
                                                >
                                                    {item.note ? '📝 Editar' : '✏️ Nota'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Totales y Botones - SOLO se muestra cuando hay productos */}
                        {cart.length > 0 && (
                            <div style={{
                                marginTop: 'auto',
                                paddingTop: '1.5rem',
                                borderTop: '2px solid #e5e7eb'
                            }}>
                                {/* Totales */}
                                <div style={{
                                    paddingBottom: '1rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.5rem',
                                        fontSize: '0.9375rem',
                                        color: '#6b7280'
                                    }}>
                                        <span>Subtotal</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(calculateSubtotal)}</span>
                                    </div>

                                    {appliedDiscount && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.9375rem',
                                            color: '#dc2626',
                                            fontWeight: '600'
                                        }}>
                                            <span>Descuento</span>
                                            <span>- {formatCurrency(calculateDiscountAmount)}</span>
                                        </div>
                                    )}

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        paddingTop: '1rem',
                                        borderTop: '2px solid #e5e7eb',
                                        fontSize: '1.5rem',
                                        fontWeight: '700',
                                        color: '#111827'
                                    }}>
                                        <span>Total</span>
                                        <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(calculateTotal)}</span>
                                    </div>
                                </div>

                                {/* Botón Principal */}
                                <button
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        backgroundColor: processingOrder ? '#d1d5db' : 'var(--primary-color)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: '#ffffff',
                                        fontSize: '1.125rem',
                                        fontWeight: '700',
                                        cursor: processingOrder ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: processingOrder ? 'none' : '0 4px 12px rgba(100, 16, 14, 0.3)',
                                        marginBottom: '0.75rem',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={openOrderConfirmationModal}
                                    disabled={processingOrder}
                                >
                                    {processingOrder ? 'Procesando pedido...' : 'Revisar y Pagar'}
                                </button>

                                {/* 🔓 Botón Abrir Caja */}
                                <button
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        backgroundColor: 'var(--primary-color)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '0.9375rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={handleOpenCashDrawer}
                                >
                                    🔓 Abrir Caja Registradora
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading || checkingShift) return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontSize: '1.125rem',
            color: '#6b7280'
        }}>
            Cargando sistema de punto de venta...
        </div>
    );

    if (!currentShift || !currentShift.id || currentShift.status !== 'open') {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--sidebar-bg)',
                padding: '2rem',
                textAlign: 'center'
            }}>
                <i className="bi bi-lock-fill" style={{ fontSize: '5rem', color: '#dc2626', marginBottom: '1rem' }}></i>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Caja Cerrada</h2>
                <p style={{ fontSize: '1.25rem', color: '#4b5563', marginBottom: '2.5rem', maxWidth: '600px', lineHeight: '1.5' }}>
                    Debes abrir la caja registradora antes de poder acceder al Punto de Venta y realizar ventas.
                </p>
                <button
                    onClick={() => navigate('/fast-food/shift')}
                    style={{
                        padding: '1rem 2.5rem',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        transition: 'transform 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    Ir a Abrir Caja
                </button>
            </div>
        );
    }

    // =====================================
    // 11. ESTRUCTURA PRINCIPAL CON RESPONSIVIDAD
    // =====================================

    // 576px es el breakpoint para móviles, de modo que las tablets usen la vista de escritorio
    const isSmallScreen = screenWidth <= 576;

    return (
        <>
            {/* Vista responsiva basada en el tamaño de pantalla */}
            {isSmallScreen ? renderCompactView() : renderDesktopView()}

            {/* Modal para agregar nota */}
            {editingNoteForItem && renderNoteModal()}

            {/* Modal Confirmación (Compartido) */}
            {showReviewModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: isSmallScreen ? '0.5rem' : '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: isSmallScreen ? '95%' : '550px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{
                            padding: isSmallScreen ? '1rem' : '1.5rem',
                            borderBottom: '2px solid #e5e7eb',
                            backgroundColor: 'var(--primary-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <div>
                                <h3 style={{
                                    fontSize: isSmallScreen ? '1.25rem' : '1.5rem',
                                    fontWeight: '700',
                                    color: '#ffffff',
                                    margin: 0
                                }}>
                                    Confirmación de Orden
                                </h3>
                                <p style={{
                                    color: '#d1d5db',
                                    fontSize: isSmallScreen ? '0.75rem' : '0.9rem',
                                    margin: '0.25rem 0 0 0'
                                }}>
                                    Confirma la orden antes de procesar el pago.
                                </p>
                            </div>
                        </div>

                        {renderReviewDetails()}

                        <div style={{
                            padding: isSmallScreen ? '1rem' : '1.5rem',
                            borderTop: '2px solid #e5e7eb',
                            display: 'flex',
                            gap: '0.75rem',
                            justifyContent: 'space-between'
                        }}>
                            <button
                                style={{
                                    padding: isSmallScreen ? '0.75rem' : '0.75rem 1.5rem',
                                    backgroundColor: 'var(--secondary-color)', color: 'var(--primary-color)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#ffffff',
                                    fontWeight: '600',
                                    fontSize: isSmallScreen ? '0.875rem' : '1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    flex: 1,
                                    minHeight: TOUCH_MIN_SIZE
                                }}
                                onClick={() => setShowReviewModal(false)}
                            >
                                Editar Pedido
                            </button>

                            <button
                                style={{
                                    padding: isSmallScreen ? '0.75rem' : '0.75rem 1.5rem',
                                    backgroundColor: 'var(--primary-color)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#ffffff',
                                    fontWeight: '700',
                                    fontSize: isSmallScreen ? '0.875rem' : '1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    flex: 1,
                                    minHeight: TOUCH_MIN_SIZE
                                }}
                                onClick={finalPlaceOrder}
                                disabled={processingOrder}
                            >
                                Confirmar y Procesar Pago
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear Cliente (Compartido) */}
            {showCustomerModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: isSmallScreen ? '0.5rem' : '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: isSmallScreen ? '95%' : '500px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{
                            padding: isSmallScreen ? '1rem' : '1.5rem',
                            borderBottom: '2px solid #e5e7eb',
                            backgroundColor: 'var(--sidebar-bg)'
                        }}>
                            <h3 style={{
                                fontSize: isSmallScreen ? '1.25rem' : '1.5rem',
                                fontWeight: '700',
                                color: '#111827',
                                margin: 0
                            }}>
                                Nuevo Cliente
                            </h3>
                        </div>

                        <form onSubmit={handleCreateCustomer} style={{ padding: isSmallScreen ? '1rem' : '1.5rem' }}>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '0.5rem'
                                }}>
                                    Cédula / RUC (Identificación)
                                </label>
                                <input
                                    type="text"
                                    name="cedula"
                                    value={newCustomer.cedula}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '0.5rem'
                                }}>
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={newCustomer.email}
                                    onChange={handleInputChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                />
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '0.75rem',
                                marginBottom: '1rem'
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Nombre
                                    </label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={newCustomer.first_name}
                                        onChange={handleInputChange}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                            transition: 'all 0.2s',
                                            boxSizing: 'border-box',
                                            minHeight: TOUCH_MIN_SIZE
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Apellido
                                    </label>
                                    <input
                                        type="text"
                                        name="last_name"
                                        value={newCustomer.last_name}
                                        onChange={handleInputChange}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                            transition: 'all 0.2s',
                                            boxSizing: 'border-box',
                                            minHeight: TOUCH_MIN_SIZE
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '0.5rem'
                                }}>
                                    Teléfono
                                </label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={newCustomer.phone}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '0.5rem'
                                }}>
                                    Ciudad
                                </label>
                                <input
                                    type="text"
                                    name="city"
                                    value={newCustomer.city}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                />
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '0.75rem',
                                justifyContent: 'flex-end',
                                borderTop: '2px solid #e5e7eb',
                                paddingTop: '1rem'
                            }}>
                                <button
                                    type="button"
                                    style={{
                                        padding: isSmallScreen ? '0.5rem 1rem' : '0.75rem 1.5rem',
                                        backgroundColor: '#ffffff',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        color: '#374151',
                                        fontWeight: '600',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={() => setShowCustomerModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: isSmallScreen ? '0.5rem 1rem' : '0.75rem 1.5rem',
                                        backgroundColor: 'var(--primary-color)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontWeight: '600',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                >
                                    Guardar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default PuntosVenta;
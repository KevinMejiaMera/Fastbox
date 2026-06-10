import api from './api';

const INVENTORY_SERVICE_URL = process.env.REACT_APP_FAST_FOOD_SERVICE || '';

const inventoryService = {
    // Insumos
    getSupplies: async () => {
        const response = await api.get('/api/menu/supplies/', { baseURL: INVENTORY_SERVICE_URL });
        return response.data.results || response.data;
    },
    createSupply: async (data) => {
        const response = await api.post('/api/menu/supplies/', data, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    updateSupply: async (id, data) => {
        const response = await api.patch(`/api/menu/supplies/${id}/`, data, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    deleteSupply: async (id) => {
        const response = await api.delete(`/api/menu/supplies/${id}/`, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },

    // Movimientos
    recordMovement: async (supplyId, movementData) => {
        const response = await api.post(`/api/menu/supplies/${supplyId}/record_movement/`, movementData, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    getMovements: async () => {
        const response = await api.get('/api/menu/supply-movements/', { baseURL: INVENTORY_SERVICE_URL });
        return response.data.results || response.data;
    },

    // Recetas (Producto -> Insumo para POS)
    getRecipeIngredients: async (productId) => {
        const params = productId ? { product: productId } : {};
        const response = await api.get('/api/menu/recipe-ingredients/', { baseURL: INVENTORY_SERVICE_URL, params });
        return response.data.results || response.data;
    },
    createRecipeIngredient: async (data) => {
        const response = await api.post('/api/menu/recipe-ingredients/', data, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    deleteRecipeIngredient: async (id) => {
        const response = await api.delete(`/api/menu/recipe-ingredients/${id}/`, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },

    // Recetas de Producción (Mezclas)
    getRecipes: async () => {
        const response = await api.get('/api/menu/recipes/', { baseURL: INVENTORY_SERVICE_URL });
        return response.data.results || response.data;
    },
    getRecipe: async (id) => {
        const response = await api.get(`/api/menu/recipes/${id}/`, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    createRecipe: async (data) => {
        const response = await api.post('/api/menu/recipes/', data, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    updateRecipe: async (id, data) => {
        const response = await api.put(`/api/menu/recipes/${id}/`, data, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    deleteRecipe: async (id) => {
        const response = await api.delete(`/api/menu/recipes/${id}/`, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    produceRecipe: async (id, data) => {
        const response = await api.post(`/api/menu/recipes/${id}/produce/`, data, { baseURL: INVENTORY_SERVICE_URL });
        return response.data;
    },
    getProductions: async () => {
        const response = await api.get('/api/menu/recipe-productions/', { baseURL: INVENTORY_SERVICE_URL });
        return response.data.results || response.data;
    },
};

export default inventoryService;

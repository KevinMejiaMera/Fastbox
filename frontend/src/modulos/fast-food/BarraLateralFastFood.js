import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BarraLateralFastFood = () => {
    const location = useLocation();
    
    // Auth check
    const user = JSON.parse(localStorage.getItem('user'));
    const roleName = user?.role_details?.name;
    const isAdmin = roleName === 'SUPER_ADMIN' || roleName === 'ADMIN_FAST_FOOD' || user?.is_superuser;

    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                Comida Rápida
            </div>
            <ul className="sidebar-nav">
                <li className={isActive('/fast-food')}>
                    <Link to="/fast-food">Panel Principal</Link>
                </li>
                <li className={isActive('/fast-food/pos')}>
                    <Link to="/fast-food/pos">Punto de Venta</Link>
                </li>
                <li className={isActive('/fast-food/orders')}>
                    <Link to="/fast-food/orders">Órdenes</Link>
                </li>
                <li className={isActive('/fast-food/inventory')}>
                    <Link to="/fast-food/inventory">Menú</Link>
                </li>
                {isAdmin && (
                    <li className={isActive('/fast-food/promotions')}>
                        <Link to="/fast-food/promotions">Promociones</Link>
                    </li>
                )}
                <li className={isActive('/fast-food/bodega')}>
                    <Link to="/fast-food/bodega">Bodega (Insumos)</Link>
                </li>
                <li className={isActive('/fast-food/mezclas')}>
                    <Link to="/fast-food/mezclas">Mezclas</Link>
                </li>
                <li className={isActive('/fast-food/customers')}>
                    <Link to="/fast-food/customers">Clientes</Link>
                </li>
                <li className={isActive('/fast-food/shift')}>
                    <Link to="/fast-food/shift">Caja</Link>
                </li>
                <li className={isActive('/fast-food/gastos')}>
                    <Link to="/fast-food/gastos">Gastos</Link>
                </li>
                <li className={isActive('/fast-food/printers')}>
                    <Link to="/fast-food/printers">Impresoras</Link>
                </li>
            </ul>
        </aside>
    );
};

export default BarraLateralFastFood;
import React, { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PrinterStatusIndicator from './PrinterStatusIndicator';

const BarraLateral = () => {
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path) ? 'active' : '';
    };

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const menuItems = [
        { path: '/', icon: 'bi-house-door-fill', label: 'Inicio' },
        { path: '/fast-food/pos', icon: 'bi-cart-fill', label: 'Punto de Venta' },
        { path: '/fast-food/orders', icon: 'bi-receipt', label: 'Órdenes' },
        { path: '/fast-food/inventory', icon: 'bi-box-seam', label: 'Inventario' },
        { path: '/fast-food/customers', icon: 'bi-person-badge', label: 'Clientes' },
        { path: '/fast-food/reports', icon: 'bi-graph-up', label: 'Reportes' },
        { path: '/fast-food/shift', icon: 'bi-clock-history', label: 'Turnos' },
        { path: '/fast-food/printers', icon: 'bi-printer-fill', label: 'Impresoras' },
        { path: '/users', icon: 'bi-people-fill', label: 'Usuarios' },
    ];

    // Estilos inline
    const styles = {
        sidebar: {
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            width: isCollapsed ? '70px' : '250px',
            background: '#f1f5f9', /* Un gris claro azulado para distinguirlo del fondo blanco */
            color: '#475569',
            transition: 'width 0.3s ease',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '4px 0 24px rgba(0, 0, 0, 0.05)',
            overflowX: 'hidden',
            borderRight: '1px solid #e2e8f0'
        },
        sidebarHeader: {
            padding: '1.5rem 1rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        },
        brandContainer: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem'
        },
        brandLogo: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flex: 1,
            minWidth: 0
        },
        brandIcon: {
            fontSize: '1.75rem',
            color: '#60a5fa',
            flexShrink: 0
        },
        brandText: {
            fontSize: '1.25rem',
            fontWeight: '700',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            opacity: isCollapsed ? 0 : 1,
            transition: 'opacity 0.2s',
            color: '#334155'
        },
        btnToggle: {
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#64748b',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            fontSize: '1.1rem',
            flexShrink: 0,
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        },
        userInfo: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            opacity: isCollapsed ? 0 : 1,
            height: isCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
        },
        userAvatar: {
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#e0f2fe',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            fontWeight: '600',
            flexShrink: 0
        },
        userDetails: {
            flex: 1,
            minWidth: 0
        },
        userName: {
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#334155',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        userRole: {
            fontSize: '0.75rem',
            color: '#64748b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        sidebarNav: {
            listStyle: 'none',
            padding: '1rem 0',
            margin: 0,
            flex: 1,
            overflowY: 'auto'
        },
        navItem: {
            margin: '0.25rem 0'
        },
        navLink: {
            display: 'flex',
            alignItems: 'center',
            padding: '0.875rem 1.25rem',
            color: '#64748b',
            textDecoration: 'none',
            transition: 'all 0.3s ease',
            gap: '1rem',
            position: 'relative',
            borderRadius: '8px',
            margin: '0 0.5rem'
        },
        navLinkActive: {
            background: '#eff6ff',
            color: '#2563eb',
            fontWeight: '500'
        },
        navIcon: {
            fontSize: '1.25rem',
            minWidth: '24px',
            transition: 'all 0.2s'
        },
        navText: {
            whiteSpace: 'nowrap',
            opacity: isCollapsed ? 0 : 1,
            width: isCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: 'opacity 0.2s'
        },
        sidebarFooter: {
            padding: '1rem',
            borderTop: '1px solid #f1f5f9'
        },
        logoutButton: {
            width: '100%',
            padding: '0.75rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            color: '#ef4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            transition: 'all 0.3s ease'
        },
        versionText: {
            textAlign: 'center',
            fontSize: '0.7rem',
            color: '#64748b',
            marginTop: '0.5rem',
            opacity: isCollapsed ? 0 : 1,
            height: isCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: 'all 0.2s'
        }
    };

    return (
        <>
            {/* Agregar Bootstrap Icons */}
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
            />

            <aside style={styles.sidebar}>
                {/* Header con Logo y Toggle */}
                <div style={styles.sidebarHeader}>
                    <div style={styles.brandContainer}>
                        <div style={styles.brandLogo}>
                            <i className="bi bi-stars" style={styles.brandIcon}></i>
                            <span style={styles.brandText}>Fastbox</span>
                        </div>
                        <button
                            style={styles.btnToggle}
                            onClick={toggleSidebar}
                            title={isCollapsed ? 'Expandir' : 'Contraer'}
                            onMouseEnter={(e) => {
                                e.target.style.background = '#f1f5f9';
                                e.target.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = '#f8fafc';
                                e.target.style.transform = 'scale(1)';
                            }}
                        >
                            <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
                        </button>
                    </div>

                    {/* Info del Usuario */}
                    <div style={styles.userInfo}>
                        <div style={styles.userAvatar}>
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div style={styles.userDetails}>
                            <div style={styles.userName}>
                                {user?.username || 'Usuario'}
                            </div>
                            <div style={styles.userRole}>
                                {user?.role || 'Administrador'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navegación */}
                <ul style={styles.sidebarNav}>
                    {menuItems.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <li key={item.path} style={styles.navItem}>
                                <Link
                                    to={item.path}
                                    title={isCollapsed ? item.label : ''}
                                    style={{
                                        ...styles.navLink,
                                        ...(active ? styles.navLinkActive : {})
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = '#ffffff';
                                            e.currentTarget.style.color = '#334155';
                                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = '#64748b';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }
                                    }}
                                >
                                    <i
                                        className={`bi ${item.icon}`}
                                        style={{
                                            ...styles.navIcon,
                                            color: active ? '#2563eb' : 'inherit'
                                        }}
                                    ></i>
                                    <span style={styles.navText}>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                {/* Footer con Logout */}
                <div style={styles.sidebarFooter}>
                    {!isCollapsed && <PrinterStatusIndicator />}
                    
                    <button
                        style={{
                            ...styles.logoutButton,
                            marginTop: isCollapsed ? '0.5rem' : '1rem'
                        }}
                        onClick={logout}
                        title="Cerrar Sesión"
                        onMouseEnter={(e) => {
                            e.target.style.background = '#fecaca';
                            e.target.style.borderColor = '#fca5a5';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = '#fef2f2';
                            e.target.style.borderColor = '#fee2e2';
                        }}
                    >
                        <i className="bi bi-box-arrow-right" style={{ fontSize: '1.1rem' }}></i>
                        <span style={styles.navText}>Cerrar Sesión</span>
                    </button>

                    <div style={styles.versionText}>
                        v1.0.0
                    </div>
                </div>
            </aside>

            {/* Estilos globales adicionales */}
            <style>{`
                /* Scrollbar personalizado */
                .sidebar-nav::-webkit-scrollbar {
                    width: 4px;
                }
                .sidebar-nav::-webkit-scrollbar-track {
                    background: transparent;
                }
                .sidebar-nav::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 4px;
                }
                .sidebar-nav::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }

                /* Ajuste para el contenido principal */
                .main-content {
                    margin-left: ${isCollapsed ? '70px' : '250px'};
                    transition: margin-left 0.3s ease;
                    min-height: 100vh;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    aside {
                        transform: ${isCollapsed ? 'translateX(-100%)' : 'translateX(0)'};
                    }
                    .main-content {
                        margin-left: 0 !important;
                    }
                }
            `}</style>
        </>
    );
};

export default BarraLateral;
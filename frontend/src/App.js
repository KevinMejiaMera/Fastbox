import React, { useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './modulos/login/Login';
import Diseno from './comun/Diseno';
import ListaUsuarios from './modulos/usuarios/ListaUsuarios';
import ServicePlaceholder from './components/ServicePlaceholder';
import PanelFastFood from './modulos/fast-food/PanelFastFood';
import Inventario from './modulos/fast-food/Inventario';
import Bodega from './modulos/fast-food/Bodega';
import Mezclas from './modulos/fast-food/Mezclas';
import Ordenes from './modulos/fast-food/Ordenes';
import Clientes from './modulos/fast-food/Clientes';
import Reportes from './modulos/fast-food/Reportes';
import PuntosVenta from './modulos/fast-food/PuntosVenta';
import PanelCaja from './modulos/fast-food/Caja/PanelCaja';
import Impresoras from './modulos/fast-food/Impresoras';
import Promociones from './modulos/fast-food/Promociones';
import DisenoFastFood from './modulos/fast-food/DisenoFastFood';
import Gastos from './modulos/fast-food/Gastos';
import logo from './assets/logo.png';
import './App.css';

// Componente para proteger rutas
const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Diseno>{children}</Diseno>;
};

const FastFoodRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div>Cargando...</div>;
  if (!user) return <Navigate to="/login" />;

  // Usamos el diseño general para todos, la barra lateral filtrará los items
  return <Diseno>{children}</Diseno>;
};

// Dashboard simple
const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const roleName = user?.role_details?.name;
  
  if (roleName !== 'SUPER_ADMIN' && !user?.is_superuser) {
      return <Navigate to="/fast-food/pos" />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      backgroundColor: 'var(--secondary-color)',
      color: 'var(--primary-color)',
      textAlign: 'center',
      borderRadius: '16px',
      padding: '3rem',
      margin: '1rem',
      boxShadow: '0 4px 20px rgba(100, 16, 14, 0.1)'
    }}>
      <img src={logo} alt="Choco Lab" style={{ height: '180px', marginBottom: '2rem', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }} />
      <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Bienvenido a Choco Lab</h2>
      <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>Seleccione una opción del menú lateral para comenzar a administrar su negocio.</p>
    </div>
  );
};

// ===== BANNER DE PWA =====
const PWAInstallBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detectar si la app está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      console.log('📱 App instalada como PWA');
    }

    // Detectar evento de instalación
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      console.log('💡 La app se puede instalar');
      setShowBanner(true);
      // Guardar evento para mostrar botón personalizado
      window.deferredPrompt = e;
    });

    window.addEventListener('appinstalled', () => {
      console.log('🎉 App instalada exitosamente');
      setIsInstalled(true);
      setShowBanner(false);
    });

    // Detectar si ya está instalada desde el inicio
    if (window.navigator.standalone) {
      setIsInstalled(true);
    }
  }, []);

  const handleInstallClick = async () => {
    const deferredPrompt = window.deferredPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('✅ Usuario aceptó la instalación');
        setShowBanner(false);
      } else {
        console.log('❌ Usuario rechazó la instalación');
      }
      window.deferredPrompt = null;
    }
  };

  if (isInstalled) {
    return (
      <div style={{
        background: '#4CAF50',
        color: 'white',
        padding: '4px 10px',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999
      }}>
        ✅ App instalada
      </div>
    );
  }

  if (!showBanner) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #64100E, #8B1A1A)',
      color: 'white',
      padding: '12px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      animation: 'slideUp 0.5s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src={logo} alt="Fre" style={{ height: '40px', borderRadius: '8px' }} />
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Instalar Fre</div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Instala esta app para mejor experiencia</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setShowBanner(false)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Cerrar
        </button>
        <button
          onClick={handleInstallClick}
          style={{
            background: 'white',
            border: 'none',
            color: '#64100E',
            padding: '8px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          Instalar
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <PWAInstallBanner />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />

          <Route path="/users" element={
            <PrivateRoute>
              <ListaUsuarios />
            </PrivateRoute>
          } />

          {/* Rutas de creación/edición eliminadas porque ahora son Modales */}

          <Route path="/fast-food" element={
            <FastFoodRoute>
              <PanelFastFood />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/inventory" element={
            <FastFoodRoute>
              <Inventario />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/promotions" element={
            <FastFoodRoute>
              <Promociones />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/bodega" element={
            <FastFoodRoute>
              <Bodega />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/mezclas" element={
            <FastFoodRoute>
              <Mezclas />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/orders" element={
            <FastFoodRoute>
              <Ordenes />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/customers" element={
            <FastFoodRoute>
              <Clientes />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/reports" element={
            <FastFoodRoute>
              <Reportes />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/pos" element={
            <FastFoodRoute>
              <PuntosVenta />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/shift" element={
            <FastFoodRoute>
              <PanelCaja />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/gastos" element={
            <FastFoodRoute>
              <Gastos />
            </FastFoodRoute>
          } />
          <Route path="/fast-food/printers" element={
            <FastFoodRoute>
              <Impresoras />
            </FastFoodRoute>
          } />

          <Route path="/hotel" element={
            <PrivateRoute>
              <ServicePlaceholder title="Hotel" />
            </PrivateRoute>
          } />

          <Route path="/pool" element={
            <PrivateRoute>
              <ServicePlaceholder title="Piscinas" />
            </PrivateRoute>
          } />

          <Route path="/restaurant" element={
            <PrivateRoute>
              <ServicePlaceholder title="Restaurante" />
            </PrivateRoute>
          } />

          {/* Redirigir cualquier otra ruta al inicio */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
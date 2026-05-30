import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import '../../App.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const result = await login(email, password);

        if (result.success) {
            const roleName = result.user.role_details?.name;
            if (roleName === 'ADMIN_FAST_FOOD') {
                navigate('/fast-food');
            } else {
                navigate('/');
            }
        } else {
            setError(result.error);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', margin: 0, padding: 0 }}>
            <style>
                {`
                @media (max-width: 768px) {
                    .login-image-side { display: none !important; }
                    .login-form-side { width: 100% !important; flex: none !important; }
                }
                .elegant-input {
                    width: 100%;
                    padding: 16px 20px;
                    border-radius: 16px;
                    border: 1.5px solid #eae0e0;
                    font-size: 1rem;
                    background-color: #faf8f8;
                    transition: all 0.3s ease;
                    outline: none;
                    box-sizing: border-box;
                }
                .elegant-input:focus {
                    border-color: var(--primary-color);
                    background-color: #ffffff;
                    box-shadow: 0 0 0 4px rgba(100, 16, 14, 0.1);
                }
                .elegant-btn {
                    width: 100%;
                    padding: 16px;
                    font-size: 1.15rem;
                    font-weight: 700;
                    border-radius: 16px;
                    background-color: var(--primary-color);
                    color: #fff;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 8px 20px rgba(100, 16, 14, 0.2);
                }
                .elegant-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 25px rgba(100, 16, 14, 0.3);
                    background-color: #7a1512;
                }
                `}
            </style>
            
            {/* Lado de la Imagen */}
            <div 
                className="login-image-side"
                style={{ 
                    flex: 1, 
                    backgroundImage: `url(${require('../../assets/fotoparalogin.png')})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                }}
            >
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(135deg, rgba(100, 16, 14, 0.1) 0%, rgba(100, 16, 14, 0.5) 100%)' 
                }}></div>
            </div>

            {/* Lado del Formulario */}
            <div 
                className="login-form-side"
                style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: 'var(--sidebar-bg)', // Fondo crema
                    padding: '2rem'
                }}
            >
                <div style={{ 
                    width: '100%', 
                    maxWidth: '540px', 
                    textAlign: 'center', 
                    backgroundColor: '#ffffff',
                    boxShadow: '0 25px 50px -12px rgba(100, 16, 14, 0.15)', 
                    padding: '4.5rem 4rem', 
                    borderRadius: '24px' 
                }}>
                    <img src={require('../../assets/logo.png')} alt="Choco Lab" style={{ height: '160px', marginBottom: '20px', objectFit: 'contain' }} />
                    <h2 style={{ color: 'var(--primary-color)', fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>Iniciar Sesión</h2>
                    <p style={{ marginBottom: '40px', color: '#666', fontSize: '1.2rem', fontWeight: '500' }}>Bienvenido al portal de Choco Lab</p>

                    {error && <div className="alert alert-error" style={{ marginBottom: '25px', borderRadius: '12px', padding: '15px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' }}>{error}</div>}

                    <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label htmlFor="email" style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '10px', display: 'block', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Correo Electrónico</label>
                            <input
                                type="email"
                                id="email"
                                className="elegant-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="tu@email.com"
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '45px' }}>
                            <label htmlFor="password" style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '10px', display: 'block', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contraseña</label>
                            <input
                                type="password"
                                id="password"
                                className="elegant-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                        </div>

                        <button type="submit" className="elegant-btn">
                            Ingresar
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;

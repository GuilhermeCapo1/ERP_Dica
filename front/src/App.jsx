import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import RotaProtegida from './routes/RotaProtegida'
import AcessoNegado from './pages/AcessoNegado'

// Lazy loading para code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projetos = lazy(() => import('./pages/Projetos'))
const Memorial = lazy(() => import('./pages/Memorial'))
const Orcamentos = lazy(() => import('./pages/Orcamentos'))

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="text-center">
                <div className="w-8 h-8 border-4 border-[#2D3AC2] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Carregando...</p>
            </div>
        </div>
    )
}

function App() {
    return (
        <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
                <Routes>
                    <Route path="/" element={<Navigate to="/login" />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/cadastro" element={<Cadastro />} />
                    <Route path="/dashboard" element={<RotaProtegida><Dashboard /></RotaProtegida>} />
                    <Route path="/projetos" element={<RotaProtegida><Projetos /></RotaProtegida>} />
                    <Route path="/memorial" element={<RotaProtegida><Memorial /></RotaProtegida>} />
                    <Route path="/orcamentos" element={<RotaProtegida><Orcamentos /></RotaProtegida>} />
                    <Route path="/acesso-negado" element={<AcessoNegado />} />
                    <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    )
}

export default App

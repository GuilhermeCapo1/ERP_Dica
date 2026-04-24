import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { temAcesso } from '@/lib/permissoes'
import * as api from '@/services/api'
import AcessoNegado from '@/pages/AcessoNegado'

/**
 * RotaProtegida
 * Envolve qualquer página que precisa de autenticação e/ou permissão de cargo.
 *
 * Uso no App.jsx:
 *   <Route path="/memorial" element={<RotaProtegida><Memorial /></RotaProtegida>} />
 *
 * Fluxo:
 *   1. Verifica se o usuário está logado (chama /me)
 *   2. Se não estiver → redireciona para /login
 *   3. Se estiver mas o cargo não tiver acesso à rota → mostra AcessoNegado
 *   4. Se tiver acesso → renderiza normalmente
 */
export default function RotaProtegida({ children }) {
    const [estado, setEstado] = useState('verificando') // 'verificando' | 'autorizado' | 'negado'
    const localizacao = useLocation()
    const navigate    = useNavigate()

    useEffect(() => {
        async function verificar() {
            const usuario = await api.getMe()

            // Não está logado
            if (!usuario || usuario.message) {
                navigate('/login')
                return
            }

            // Verifica permissão de cargo para a rota atual
            if (temAcesso(usuario.cargo, localizacao.pathname)) {
                setEstado('autorizado')
            } else {
                setEstado('negado')
            }
        }

        verificar()
    }, [localizacao.pathname])

    // Tela de carregamento enquanto verifica (evita flash de conteúdo)
    if (estado === 'verificando') {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-sm text-gray-400">Verificando acesso...</p>
            </div>
        )
    }

    if (estado === 'negado') {
        return <AcessoNegado />
    }

    return children
}
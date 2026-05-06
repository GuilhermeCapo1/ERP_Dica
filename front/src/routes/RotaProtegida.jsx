import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { temAcesso } from '@/lib/permissoes'
import * as api from '@/services/api'
import AcessoNegado from '@/pages/AcessoNegado'

/**
 * Normaliza o pathname para comparar com as rotas cadastradas.
 *
 * Rotas dinâmicas como /projetos/abc123/detalhes precisam ser
 * mapeadas para a rota-pai cadastrada no routes.js (/projetos).
 *
 * Regra: se o pathname tem um segmento que parece um ID (24+ chars
 * hex ou ObjectId do Mongo), remove ele e o que vem depois.
 */
function normalizarRota(pathname) {
    // IDs do MongoDB têm 24 caracteres hexadecimais
    const partes = pathname.split('/').filter(Boolean)

    // Encontra o primeiro segmento que parece um ID e corta a partir daí
    const indiceId = partes.findIndex(s => /^[a-f0-9]{24}$/i.test(s))

    if (indiceId !== -1) {
        // Retorna só até antes do ID — ex: /projetos/abc.../detalhes → /projetos
        return '/' + partes.slice(0, indiceId).join('/')
    }

    return pathname
}

export default function RotaProtegida({ children }) {
    const [estado, setEstado] = useState('verificando')
    const localizacao = useLocation()
    const navigate    = useNavigate()

    useEffect(() => {
        async function verificar() {
            const usuario = await api.getMe()

            if (!usuario || usuario.message) {
                navigate('/login')
                return
            }

            // Normaliza a rota antes de checar permissão
            const rotaParaChecar = normalizarRota(localizacao.pathname)

            if (temAcesso(usuario.cargo, rotaParaChecar)) {
                setEstado('autorizado')
            } else {
                setEstado('negado')
            }
        }

        verificar()
    }, [localizacao.pathname])

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
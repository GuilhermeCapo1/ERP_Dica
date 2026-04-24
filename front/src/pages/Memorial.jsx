import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
    FolderKanban,
    TrendingUp,
    CheckCircle2,
    BarChart3,
    AlertCircle,
    Clock,
    ChevronRight,
    Plus,
} from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'

// ─── Configuração dos status ───────────────────────────────────────────────
const STATUS_CORES = {
    'Recebido':     { bg: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
    'Em criação':   { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Memorial':     { bg: 'bg-red-500',    light: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
    'Precificação': { bg: 'bg-yellow-500', light: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    'Enviado':      { bg: 'bg-cyan-500',   light: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200' },
    'Aprovado':     { bg: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
}

// ─── Helper: iniciais do nome ──────────────────────────────────────────────
function iniciais(nome) {
    if (!nome) return '?'
    return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function Dashboard() {
    const [usuario,    setUsuario]    = useState(null)
    const [projetos,   setProjetos]   = useState([])
    const [carregando, setCarregando] = useState(true)
    const navigate = useNavigate()

    // ─── Carrega dados iniciais ───────────────────────────────────────────
    useEffect(() => {
        async function carregarDados() {
            // Verifica autenticação
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)

            // Carrega projetos
            const lista = await api.getProjetos()
            if (Array.isArray(lista)) setProjetos(lista)

            setCarregando(false)
        }
        carregarDados()
    }, [])

    // ─── Métricas calculadas ──────────────────────────────────────────────
    const totalProjetos   = projetos.length
    const projetosAtivos  = projetos.filter(p => p.status !== 'Aprovado').length
    const projetosAprovados = projetos.filter(p => p.status === 'Aprovado').length
    const metragemTotal   = projetos.reduce((acc, p) => acc + (p.metragem || 0), 0)

    // Contagem por status
    const contagemStatus = Object.keys(STATUS_CORES).reduce((acc, s) => {
        acc[s] = projetos.filter(p => p.status === s).length
        return acc
    }, {})

    // Projetos recentes (últimos 5)
    const projetosRecentes = [...projetos].slice(0, 5)

    // Projetos com prazo próximo (próximos 7 dias)
    const hoje = new Date()
    const projetosUrgentes = projetos
        .filter(p => {
            if (!p.dataLimite || p.status === 'Aprovado') return false
            const prazo = new Date(p.dataLimite)
            const diff  = (prazo - hoje) / (1000 * 60 * 60 * 24)
            return diff >= 0 && diff <= 7
        })
        .sort((a, b) => new Date(a.dataLimite) - new Date(b.dataLimite))

    // ─── Helpers ──────────────────────────────────────────────────────────
    function formatarData(data) {
        if (!data) return '—'
        return new Date(data).toLocaleDateString('pt-BR')
    }

    function diasRestantes(data) {
        const diff = Math.ceil((new Date(data) - hoje) / (1000 * 60 * 60 * 24))
        if (diff === 0) return 'Hoje'
        if (diff === 1) return '1 dia'
        return `${diff} dias`
    }

    function iniciais(nome) {
        if (!nome) return '?'
        return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    }

    // ─── Loading ──────────────────────────────────────────────────────────
    if (carregando) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-gray-400 text-sm">Carregando...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 flex">
            <Sidebar usuario={usuario} />

            <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <header className="bg-[#2D3AC2] text-white px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">Dashboard</h2>
                        <p className="text-blue-200 text-sm mt-0.5">
                            Bem-vindo, {usuario?.name?.split(' ')[0]}!
                        </p>
                    </div>
                    <Link
                        to="/projetos"
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        Novo Projeto
                    </Link>
                </header>

                {/* Área de scroll */}
                <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">

                    {/* ── Cards de métricas ──────────────────────────── */}
                    <div className="grid grid-cols-4 gap-4">

                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500 font-medium">Total de Projetos</span>
                                <div className="w-8 h-8 bg-[#2D3AC2]/10 rounded-lg flex items-center justify-center">
                                    <FolderKanban size={16} className="text-[#2D3AC2]" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{totalProjetos}</p>
                            <p className="text-xs text-gray-400 mt-1">projetos cadastrados</p>
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500 font-medium">Em Andamento</span>
                                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <TrendingUp size={16} className="text-blue-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{projetosAtivos}</p>
                            <p className="text-xs text-gray-400 mt-1">ainda não aprovados</p>
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500 font-medium">Aprovados</span>
                                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                                    <CheckCircle2 size={16} className="text-green-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{projetosAprovados}</p>
                            <p className="text-xs text-gray-400 mt-1">projetos finalizados</p>
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500 font-medium">Metragem Total</span>
                                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                                    <BarChart3 size={16} className="text-purple-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">
                                {metragemTotal.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">m² em projetos</p>
                        </div>
                    </div>

                    {/* ── Funil de status ────────────────────────────── */}
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Projetos por Status</h3>
                        <div className="grid grid-cols-6 gap-3">
                            {Object.entries(STATUS_CORES).map(([status, cores]) => {
                                const qtd   = contagemStatus[status] || 0
                                const pct   = totalProjetos > 0 ? Math.round((qtd / totalProjetos) * 100) : 0
                                return (
                                    <div key={status} className={`rounded-lg p-3 ${cores.light} border ${cores.border}`}>
                                        <div className={`w-2 h-2 rounded-full ${cores.bg} mb-2`} />
                                        <p className={`text-2xl font-bold ${cores.text}`}>{qtd}</p>
                                        <p className="text-xs text-gray-600 font-medium mt-0.5 leading-tight">{status}</p>
                                        <p className="text-xs text-gray-400 mt-1">{pct}%</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* ── Linha inferior: Recentes + Urgentes ────────── */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* Projetos recentes */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                                <h3 className="text-sm font-semibold text-gray-700">Projetos Recentes</h3>
                                <Link
                                    to="/projetos"
                                    className="text-xs text-[#2D3AC2] hover:underline flex items-center gap-1"
                                >
                                    Ver todos <ChevronRight size={12} />
                                </Link>
                            </div>

                            {projetosRecentes.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center py-10">
                                    <p className="text-sm text-gray-400">Nenhum projeto cadastrado</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-50">
                                    {projetosRecentes.map(p => {
                                        const cores = STATUS_CORES[p.status] || STATUS_CORES['Recebido']
                                        return (
                                            <li key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">

                                                {/* Avatar do responsável */}
                                                <div className="w-8 h-8 rounded-full bg-[#2D3AC2]/10 flex items-center justify-center text-[#2D3AC2] text-xs font-bold shrink-0">
                                                    {iniciais(p.responsavel?.name)}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{p.nome}</p>
                                                    <p className="text-xs text-gray-400 truncate">{p.cliente} · {p.local}</p>
                                                </div>

                                                {/* Badge de status */}
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cores.light} ${cores.text} shrink-0`}>
                                                    {p.status}
                                                </span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Prazos urgentes */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                                <h3 className="text-sm font-semibold text-gray-700">Prazos Próximos</h3>
                                <span className="text-xs text-gray-400">próximos 7 dias</span>
                            </div>

                            {projetosUrgentes.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
                                    <CheckCircle2 size={28} className="text-green-400" />
                                    <p className="text-sm text-gray-400">Nenhum prazo urgente</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-50">
                                    {projetosUrgentes.map(p => {
                                        const dias = diasRestantes(p.dataLimite)
                                        const urgente = Math.ceil((new Date(p.dataLimite) - hoje) / (1000 * 60 * 60 * 24)) <= 2
                                        return (
                                            <li key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">

                                                {/* Ícone de alerta */}
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                                                    ${urgente ? 'bg-red-50' : 'bg-yellow-50'}`}>
                                                    {urgente
                                                        ? <AlertCircle size={16} className="text-red-500" />
                                                        : <Clock size={16} className="text-yellow-500" />
                                                    }
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{p.nome}</p>
                                                    <p className="text-xs text-gray-400">
                                                        Prazo: {formatarData(p.dataLimite)}
                                                    </p>
                                                </div>

                                                {/* Dias restantes */}
                                                <span className={`text-xs font-bold shrink-0
                                                    ${urgente ? 'text-red-600' : 'text-yellow-600'}`}>
                                                    {dias}
                                                </span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

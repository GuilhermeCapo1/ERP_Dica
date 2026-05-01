import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Building2, User, ChevronDown, ChevronUp, Phone, Mail, MapPin, FileText } from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'

const STATUS_CORES = {
    'Recebido':     'bg-blue-50 text-blue-700',
    'Em criação':   'bg-purple-50 text-purple-700',
    'Memorial':     'bg-red-50 text-red-700',
    'Precificação': 'bg-yellow-50 text-yellow-700',
    'Enviado':      'bg-cyan-50 text-cyan-700',
    'Aprovado':     'bg-green-50 text-green-700',
    'Reprovado':    'bg-red-50 text-red-800',
}

// ─── Card de cliente próprio (visão completa) ──────────────────────────────
function CardClienteCompleto({ cliente }) {
    const [aberto, setAberto] = useState(false)

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Cabeçalho */}
            <button
                onClick={() => setAberto(a => !a)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
                <div className="w-10 h-10 rounded-full bg-[#2D3AC2]/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-[#2D3AC2]" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                        {cliente.nomeEmpresa}
                    </p>
                    {cliente.nomeFantasia && (
                        <p className="text-xs text-gray-400 truncate">{cliente.nomeFantasia}</p>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                        {cliente.projetos?.length || 0} {cliente.projetos?.length === 1 ? 'projeto' : 'projetos'}
                    </span>
                    {aberto
                        ? <ChevronUp size={16} className="text-gray-400" />
                        : <ChevronDown size={16} className="text-gray-400" />
                    }
                </div>
            </button>

            {/* Detalhes expandidos */}
            {aberto && (
                <div className="border-t border-gray-100 px-5 py-5 flex flex-col gap-5">

                    {/* Dados cadastrais */}
                    <div className="grid grid-cols-2 gap-3">
                        {cliente.cnpj && (
                            <div className="flex flex-col gap-0.5">
                                <p className="text-xs font-medium text-gray-400">CNPJ</p>
                                <p className="text-sm text-gray-700">{cliente.cnpj}</p>
                            </div>
                        )}
                        {cliente.cpf && (
                            <div className="flex flex-col gap-0.5">
                                <p className="text-xs font-medium text-gray-400">CPF</p>
                                <p className="text-sm text-gray-700">{cliente.cpf}</p>
                            </div>
                        )}
                        {cliente.responsavel && (
                            <div className="flex flex-col gap-0.5">
                                <p className="text-xs font-medium text-gray-400">Responsável</p>
                                <p className="text-sm text-gray-700">{cliente.responsavel}</p>
                            </div>
                        )}
                        {cliente.telefone && (
                            <div className="flex items-center gap-1.5">
                                <Phone size={12} className="text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-700">{cliente.telefone}</p>
                            </div>
                        )}
                        {cliente.email && (
                            <div className="flex items-center gap-1.5 col-span-2">
                                <Mail size={12} className="text-gray-400 shrink-0" />
                                <a
                                    href={`mailto:${cliente.email}`}
                                    className="text-sm text-[#2D3AC2] hover:underline truncate"
                                >
                                    {cliente.email}
                                </a>
                            </div>
                        )}
                        {(cliente.endereco || cliente.cidade || cliente.estado) && (
                            <div className="flex items-start gap-1.5 col-span-2">
                                <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-700">
                                    {[cliente.endereco, cliente.cidade, cliente.estado, cliente.cep]
                                        .filter(Boolean).join(', ')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Histórico de projetos */}
                    {cliente.projetos?.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Histórico de projetos
                            </p>
                            <div className="flex flex-col gap-2">
                                {cliente.projetos.map(p => (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={13} className="text-gray-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{p.nome}</p>
                                                {(p.feira || p.local) && (
                                                    <p className="text-xs text-gray-400 truncate">
                                                        {[p.feira, p.local].filter(Boolean).join(' · ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-3 ${STATUS_CORES[p.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {p.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Card de cliente de outro vendedor (visão restrita) ────────────────────
function CardClienteRestrito({ cliente }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3 opacity-70">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Building2 size={15} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{cliente.nomeEmpresa}</p>
                <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                    <User size={10} />
                    {cliente.vendedorNome || 'Vendedor não identificado'}
                </p>
            </div>
            <span className="text-xs text-gray-300 shrink-0">Outro vendedor</span>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default function Clientes() {
    const [usuario, setUsuario]       = useState(null)
    const [clientes, setClientes]     = useState([])
    const [carregando, setCarregando] = useState(true)
    const [busca, setBusca]           = useState('')
    const navigate = useNavigate()

    const isGestor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase())

    useEffect(() => {
        async function iniciar() {
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)

            const lista = await api.getClientes()
            if (Array.isArray(lista)) setClientes(lista)
            setCarregando(false)
        }
        iniciar()
    }, [])

    // Separa clientes próprios dos de outros vendedores
    const clientesProprios = clientes.filter(c => c.proprio !== false)
    const clientesOutros   = clientes.filter(c => c.proprio === false)

    // Aplica busca apenas nos clientes visíveis com dados completos
    const propriosFiltrados = clientesProprios.filter(c =>
        !busca ||
        c.nomeEmpresa?.toLowerCase().includes(busca.toLowerCase()) ||
        c.nomeFantasia?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj?.includes(busca)
    )
    const outrosFiltrados = clientesOutros.filter(c =>
        !busca || c.nomeEmpresa?.toLowerCase().includes(busca.toLowerCase())
    )

    if (carregando) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-sm text-gray-400">Carregando...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 flex">
            <Sidebar usuario={usuario} />

            <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <header className="bg-[#2D3AC2] text-white px-6 py-4">
                    <h2 className="text-xl font-bold">Clientes</h2>
                    <p className="text-blue-200 text-sm mt-0.5">
                        {isGestor
                            ? `${clientes.length} ${clientes.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}`
                            : `${clientesProprios.length} ${clientesProprios.length === 1 ? 'cliente seu' : 'clientes seus'}`
                        }
                    </p>
                </header>

                <main className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">

                    {/* Busca */}
                    <div className="relative max-w-sm">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou CNPJ..."
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                        />
                    </div>

                    {/* Lista vazia */}
                    {clientes.length === 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
                            <Building2 size={32} className="text-gray-300" />
                            <p className="text-sm text-gray-400">Nenhum cliente cadastrado ainda.</p>
                            <p className="text-xs text-gray-300">
                                Clientes são criados automaticamente quando um projeto é aprovado.
                            </p>
                        </div>
                    )}

                    {/* ── Clientes próprios (visão completa) ──────────────── */}
                    {propriosFiltrados.length > 0 && (
                        <div className="flex flex-col gap-3">
                            {!isGestor && (
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                                    Meus clientes ({propriosFiltrados.length})
                                </p>
                            )}
                            {isGestor && busca && (
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                                    Resultados ({propriosFiltrados.length})
                                </p>
                            )}
                            {propriosFiltrados.map(c => (
                                <CardClienteCompleto key={c.id} cliente={c} />
                            ))}
                        </div>
                    )}

                    {/* ── Clientes de outros vendedores (visão restrita) ─── */}
                    {/* Só aparece para vendedores, não para gerente/diretor   */}
                    {!isGestor && outrosFiltrados.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                                Outros clientes ({outrosFiltrados.length})
                            </p>
                            <p className="text-xs text-gray-400 px-1 -mt-1">
                                Estes clientes já são atendidos por outro vendedor.
                            </p>
                            {outrosFiltrados.map(c => (
                                <CardClienteRestrito key={c.id} cliente={c} />
                            ))}
                        </div>
                    )}

                    {/* Sem resultados na busca */}
                    {busca && propriosFiltrados.length === 0 && outrosFiltrados.length === 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-12">
                            <p className="text-sm text-gray-400">Nenhum cliente encontrado para "{busca}".</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
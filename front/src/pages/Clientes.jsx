import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Search, Building2, User, ChevronDown, ChevronUp,
    Phone, Mail, MapPin, FileText, Pencil, Trash2, X, FileSignature, Save,
    Briefcase,
} from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'

const STATUS_CORES = {
    'Recebido': 'bg-blue-50 text-blue-700',
    'Em criação': 'bg-purple-50 text-purple-700',
    'Memorial': 'bg-red-50 text-red-700',
    'Precificação': 'bg-yellow-50 text-yellow-700',
    'Enviado': 'bg-cyan-50 text-cyan-700',
    'Aprovado': 'bg-green-50 text-green-700',
    'Reprovado': 'bg-red-50 text-red-800',
}

// ─── Campos do formulário de cliente ──────────────────────────────────────
const CAMPOS_CLIENTE = [
    { name: 'nomeEmpresa', label: 'Razão Social', required: true, colSpan: 2 },
    { name: 'nomeFantasia', label: 'Nome Fantasia', required: false, colSpan: 1 },
    { name: 'cnpj', label: 'CNPJ', required: false, colSpan: 1, placeholder: '00.000.000/0000-00' },
    { name: 'cpf', label: 'CPF', required: false, colSpan: 1, placeholder: '000.000.000-00' },
    { name: 'responsavel', label: 'Responsável', required: false, colSpan: 1 },
    { name: 'email', label: 'E-mail', required: false, colSpan: 2, type: 'email' },
    { name: 'telefone', label: 'Telefone', required: false, colSpan: 1 },
    { name: 'cep', label: 'CEP', required: false, colSpan: 1 },
    { name: 'endereco', label: 'Endereço', required: false, colSpan: 2 },
    { name: 'cidade', label: 'Cidade', required: false, colSpan: 1 },
    { name: 'estado', label: 'Estado', required: false, colSpan: 1, placeholder: 'SP' },
]

// ─── Campos do formulário de agência ──────────────────────────────────────
const CAMPOS_AGENCIA = [
    { name: 'nomeEmpresa', label: 'Razão Social', required: true, colSpan: 2 },
    { name: 'cnpj', label: 'CNPJ', required: false, colSpan: 1, placeholder: '00.000.000/0000-00' },
    { name: 'cpf', label: 'CPF', required: false, colSpan: 1, placeholder: '000.000.000-00' },
    { name: 'responsavel', label: 'Responsável', required: false, colSpan: 1 },
    { name: 'telefone', label: 'Telefone', required: false, colSpan: 1 },
    { name: 'email', label: 'E-mail', required: false, colSpan: 2, type: 'email' },
    { name: 'endereco', label: 'Endereço', required: false, colSpan: 2 },
    { name: 'cidade', label: 'Cidade', required: false, colSpan: 1 },
    { name: 'estado', label: 'Estado', required: false, colSpan: 1, placeholder: 'SP' },
    { name: 'cep', label: 'CEP', required: false, colSpan: 1 },
]

// ─── Modal genérico de edição (serve para cliente e agência) ───────────────
function ModalEdicao({ titulo, dados, campos, onSalvar, onFechar }) {
    const [form, setForm] = useState({ ...dados })
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState('')

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    async function handleSalvar() {
        if (!form.nomeEmpresa?.trim()) { setErro('Razão Social é obrigatória'); return }
        setSalvando(true)
        setErro('')
        try {
            await onSalvar(form)
        } catch (err) {
            setErro('Erro ao salvar: ' + err.message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{titulo}</h3>
                        <p className="text-sm text-gray-400 mt-0.5">{dados.nomeEmpresa}</p>
                    </div>
                    <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="grid grid-cols-2 gap-3">
                        {campos.map(({ name, label, required, colSpan, type, placeholder }) => (
                            <div key={name} className={`flex flex-col gap-1 ${colSpan === 2 ? 'col-span-2' : ''}`}>
                                <label className="text-xs font-medium text-gray-500">
                                    {label} {required && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                    name={name}
                                    type={type || 'text'}
                                    value={form[name] || ''}
                                    onChange={handleChange}
                                    placeholder={placeholder || ''}
                                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                />
                            </div>
                        ))}
                    </div>
                    {erro && (
                        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{erro}</div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={onFechar}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSalvar} disabled={salvando}
                        className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50">
                        <Save size={14} />
                        {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Card de cliente completo ──────────────────────────────────────────────
function CardClienteCompleto({ cliente, podeEditar, podeExcluir, onEditar, onExcluir }) {
    const [aberto, setAberto] = useState(false)
    const navigate = useNavigate()

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setAberto(a => !a)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-[#2D3AC2]/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-[#2D3AC2]" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{cliente.nomeEmpresa}</p>
                    {cliente.nomeFantasia && (
                        <p className="text-xs text-gray-400 truncate">{cliente.nomeFantasia}</p>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                        {cliente.projetos?.length || 0} {cliente.projetos?.length === 1 ? 'projeto' : 'projetos'}
                    </span>
                    {aberto ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
            </button>

            {aberto && (
                <div className="border-t border-gray-100 px-5 py-5 flex flex-col gap-5">
                    <div className="flex items-center gap-2 justify-end">
                        {podeEditar && (
                            <button onClick={() => onEditar(cliente)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                                <Pencil size={13} /> Editar dados
                            </button>
                        )}
                        {podeExcluir && (
                            <button onClick={() => onExcluir(cliente)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={13} /> Excluir
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {cliente.cnpj && <div className="flex flex-col gap-0.5"><p className="text-xs font-medium text-gray-400">CNPJ</p><p className="text-sm text-gray-700">{cliente.cnpj}</p></div>}
                        {cliente.cpf && <div className="flex flex-col gap-0.5"><p className="text-xs font-medium text-gray-400">CPF</p><p className="text-sm text-gray-700">{cliente.cpf}</p></div>}
                        {cliente.responsavel && <div className="flex flex-col gap-0.5"><p className="text-xs font-medium text-gray-400">Responsável</p><p className="text-sm text-gray-700">{cliente.responsavel}</p></div>}
                        {cliente.telefone && (
                            <div className="flex items-center gap-1.5">
                                <Phone size={12} className="text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-700">{cliente.telefone}</p>
                            </div>
                        )}
                        {cliente.email && (
                            <div className="flex items-center gap-1.5 col-span-2">
                                <Mail size={12} className="text-gray-400 shrink-0" />
                                <a href={`mailto:${cliente.email}`} className="text-sm text-[#2D3AC2] hover:underline truncate">{cliente.email}</a>
                            </div>
                        )}
                        {(cliente.endereco || cliente.cidade || cliente.estado) && (
                            <div className="flex items-start gap-1.5 col-span-2">
                                <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-700">
                                    {[cliente.endereco, cliente.cidade, cliente.estado, cliente.cep].filter(Boolean).join(', ')}
                                </p>
                            </div>
                        )}
                    </div>

                    {cliente.projetos?.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Histórico de projetos</p>
                            <div className="flex flex-col gap-2">
                                {cliente.projetos.map(p => {
                                    const contrato = p.contratos?.[0] || null
                                    return (
                                        <button key={p.id} onClick={() => navigate(`/projetos/${p.id}/detalhes`)}
                                            className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-[#2D3AC2]/30 hover:bg-blue-50/30 transition-all text-left group">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText size={13} className="text-gray-400 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[#2D3AC2]">{p.nome}</p>
                                                    {(p.feira || p.local) && (
                                                        <p className="text-xs text-gray-400 truncate">{[p.feira, p.local].filter(Boolean).join(' · ')}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-3">
                                                {/* Badge de contrato assinado */}
                                                {contrato && (
                                                    <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                        <FileSignature size={10} />
                                                        {contrato.numero ? `#${contrato.numero}` : 'Assinado'}
                                                    </span>
                                                )}
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CORES[p.status] || 'bg-gray-100 text-gray-500'}`}>
                                                    {p.status}
                                                </span>
                                                <span className="text-xs text-[#2D3AC2] opacity-0 group-hover:opacity-100 transition-opacity">Ver →</span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Card de cliente restrito (outro vendedor) ─────────────────────────────
function CardClienteRestrito({ cliente }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3 opacity-70">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Building2 size={15} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{cliente.nomeEmpresa}</p>
                <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                    <User size={10} /> {cliente.vendedorNome || 'Vendedor não identificado'}
                </p>
            </div>
            <span className="text-xs text-gray-300 shrink-0">Outro vendedor</span>
        </div>
    )
}

// ─── Card de agência ───────────────────────────────────────────────────────
function CardAgencia({ agencia, podeEditar, podeExcluir, onEditar, onExcluir }) {
    const [aberto, setAberto] = useState(false)
    const navigate = useNavigate()

    return (
        <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
            <button onClick={() => setAberto(a => !a)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-purple-50/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                    <Briefcase size={18} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{agencia.nomeEmpresa}</p>
                    <p className="text-xs text-purple-500 mt-0.5">Agência intermediadora</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                        {agencia.projetos?.length || 0} {agencia.projetos?.length === 1 ? 'projeto' : 'projetos'}
                    </span>
                    {aberto ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
            </button>

            {aberto && (
                <div className="border-t border-purple-100 px-5 py-5 flex flex-col gap-5">
                    <div className="flex items-center gap-2 justify-end">
                        {podeEditar && (
                            <button onClick={() => onEditar(agencia)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                                <Pencil size={13} /> Editar dados
                            </button>
                        )}
                        {podeExcluir && (
                            <button onClick={() => onExcluir(agencia)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={13} /> Excluir
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {agencia.cnpj && <div className="flex flex-col gap-0.5"><p className="text-xs font-medium text-gray-400">CNPJ</p><p className="text-sm text-gray-700">{agencia.cnpj}</p></div>}
                        {agencia.cpf && <div className="flex flex-col gap-0.5"><p className="text-xs font-medium text-gray-400">CPF</p><p className="text-sm text-gray-700">{agencia.cpf}</p></div>}
                        {agencia.responsavel && <div className="flex flex-col gap-0.5"><p className="text-xs font-medium text-gray-400">Responsável</p><p className="text-sm text-gray-700">{agencia.responsavel}</p></div>}
                        {agencia.telefone && (
                            <div className="flex items-center gap-1.5">
                                <Phone size={12} className="text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-700">{agencia.telefone}</p>
                            </div>
                        )}
                        {agencia.email && (
                            <div className="flex items-center gap-1.5 col-span-2">
                                <Mail size={12} className="text-gray-400 shrink-0" />
                                <a href={`mailto:${agencia.email}`} className="text-sm text-purple-600 hover:underline truncate">{agencia.email}</a>
                            </div>
                        )}
                        {(agencia.endereco || agencia.cidade || agencia.estado) && (
                            <div className="flex items-start gap-1.5 col-span-2">
                                <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-700">
                                    {[agencia.endereco, agencia.cidade, agencia.estado, agencia.cep].filter(Boolean).join(', ')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Projetos vinculados à agência */}
                    {agencia.projetos?.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Projetos intermediados</p>
                            <div className="flex flex-col gap-2">
                                {agencia.projetos.map(p => {
                                    const contrato = p.contratos?.[0] || null
                                    return (
                                        <button key={p.id} onClick={() => navigate(`/projetos/${p.id}/detalhes`)}
                                            className="flex items-center justify-between px-3 py-2 bg-purple-50/40 rounded-lg border border-purple-100 hover:border-purple-300 hover:bg-purple-50 transition-all text-left group">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText size={13} className="text-purple-400 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-purple-700">{p.nome}</p>
                                                    {p.cliente && <p className="text-xs text-gray-400 truncate">Cliente: {p.cliente}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-3">
                                                {/* Badge de contrato assinado */}
                                                {contrato && (
                                                    <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                        <FileSignature size={10} />
                                                        {contrato.numero ? `#${contrato.numero}` : 'Assinado'}
                                                    </span>
                                                )}
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CORES[p.status] || 'bg-gray-100 text-gray-500'}`}>
                                                    {p.status}
                                                </span>
                                                <span className="text-xs text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">Ver →</span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default function Clientes() {
    const [usuario, setUsuario] = useState(null)
    const [clientes, setClientes] = useState([])
    const [agencias, setAgencias] = useState([])
    const [carregando, setCarregando] = useState(true)
    const [busca, setBusca] = useState('')
    const [aba, setAba] = useState('clientes') // 'clientes' | 'agencias'
    const [itemEditando, setItemEditando] = useState(null)       // { tipo: 'cliente'|'agencia', dados }
    const [erro, setErro] = useState('')
    const navigate = useNavigate()

    const isGestor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase())
    const isVendedor = usuario?.cargo?.toLowerCase() === 'vendedor'

    useEffect(() => {
        async function iniciar() {
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)
            await Promise.all([carregarClientes(), carregarAgencias()])
            setCarregando(false)
        }
        iniciar()
    }, [])

    async function carregarClientes() {
        const lista = await api.getClientes()
        if (Array.isArray(lista)) setClientes(lista)
    }

    async function carregarAgencias() {
        try {
            const lista = await api.getAgencias()
            if (Array.isArray(lista)) setAgencias(lista)
        } catch { setAgencias([]) }
    }

    // ── Salva cliente ─────────────────────────────────────────────────────
    async function handleSalvarCliente(dadosAtualizados) {
        await api.atualizarCliente(itemEditando.dados.id, dadosAtualizados)
        await carregarClientes()
        setItemEditando(null)
    }

    // ── Salva agência ─────────────────────────────────────────────────────
    async function handleSalvarAgencia(dadosAtualizados) {
        await api.atualizarAgencia(itemEditando.dados.id, dadosAtualizados)
        await carregarAgencias()
        setItemEditando(null)
    }

    // ── Exclui cliente ────────────────────────────────────────────────────
    async function handleExcluirCliente(cliente) {
        if (!confirm(`Tem certeza que deseja excluir "${cliente.nomeEmpresa}"?`)) return
        try {
            await api.deletarCliente(cliente.id)
            await carregarClientes()
        } catch (err) { setErro('Erro ao excluir: ' + err.message) }
    }

    // ── Exclui agência ────────────────────────────────────────────────────
    async function handleExcluirAgencia(agencia) {
        if (!confirm(`Tem certeza que deseja excluir "${agencia.nomeEmpresa}"?`)) return
        try {
            await api.deletarAgencia(agencia.id)
            await carregarAgencias()
        } catch (err) { setErro('Erro ao excluir: ' + err.message) }
    }

    // ── Filtragem ─────────────────────────────────────────────────────────
    const clientesProprios = clientes.filter(c => c.proprio !== false)
    const clientesOutros = clientes.filter(c => c.proprio === false)

    const propriosFiltrados = clientesProprios.filter(c =>
        !busca ||
        c.nomeEmpresa?.toLowerCase().includes(busca.toLowerCase()) ||
        c.nomeFantasia?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj?.includes(busca)
    )
    const outrosFiltrados = clientesOutros.filter(c =>
        !busca || c.nomeEmpresa?.toLowerCase().includes(busca.toLowerCase())
    )
    const agenciasFiltradas = agencias.filter(a =>
        !busca ||
        a.nomeEmpresa?.toLowerCase().includes(busca.toLowerCase()) ||
        a.cnpj?.includes(busca)
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

                <header className="bg-[#2D3AC2] text-white px-6 py-4">
                    <h2 className="text-xl font-bold">Clientes & Agências</h2>
                    <p className="text-blue-200 text-sm mt-0.5">
                        {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} · {agencias.length} {agencias.length === 1 ? 'agência' : 'agências'}
                    </p>
                </header>

                <main className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">

                    {erro && (
                        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{erro}</div>
                    )}

                    {/* ── Abas ──────────────────────────────────────────── */}
                    <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
                        <button
                            onClick={() => setAba('clientes')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                                ${aba === 'clientes' ? 'bg-[#2D3AC2] text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <Building2 size={15} />
                            Clientes finais
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${aba === 'clientes' ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {clientes.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setAba('agencias')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                                ${aba === 'agencias' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <Briefcase size={15} />
                            Agências
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${aba === 'agencias' ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {agencias.length}
                            </span>
                        </button>
                    </div>

                    {/* ── Busca ─────────────────────────────────────────── */}
                    <div className="relative max-w-sm">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={aba === 'clientes' ? 'Buscar por nome ou CNPJ...' : 'Buscar agência...'}
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                        />
                    </div>

                    {/* ── ABA CLIENTES ──────────────────────────────────── */}
                    {aba === 'clientes' && (
                        <>
                            {clientes.length === 0 && (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
                                    <Building2 size={32} className="text-gray-300" />
                                    <p className="text-sm text-gray-400">Nenhum cliente cadastrado ainda.</p>
                                    <p className="text-xs text-gray-300">Clientes são criados automaticamente quando um projeto é aprovado.</p>
                                </div>
                            )}

                            {propriosFiltrados.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    {!isGestor && (
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                                            Meus clientes ({propriosFiltrados.length})
                                        </p>
                                    )}
                                    {propriosFiltrados.map(c => (
                                        <CardClienteCompleto
                                            key={c.id}
                                            cliente={c}
                                            podeEditar={isGestor || isVendedor}
                                            podeExcluir={isGestor}
                                            onEditar={c => setItemEditando({ tipo: 'cliente', dados: c })}
                                            onExcluir={handleExcluirCliente}
                                        />
                                    ))}
                                </div>
                            )}

                            {!isGestor && outrosFiltrados.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                                        Outros clientes ({outrosFiltrados.length})
                                    </p>
                                    <p className="text-xs text-gray-400 px-1 -mt-1">Estes clientes já são atendidos por outro vendedor.</p>
                                    {outrosFiltrados.map(c => <CardClienteRestrito key={c.id} cliente={c} />)}
                                </div>
                            )}

                            {busca && propriosFiltrados.length === 0 && outrosFiltrados.length === 0 && (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-12">
                                    <p className="text-sm text-gray-400">Nenhum cliente encontrado para "{busca}".</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── ABA AGÊNCIAS ──────────────────────────────────── */}
                    {aba === 'agencias' && (
                        <>
                            {agenciasFiltradas.length === 0 ? (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
                                    <Briefcase size={32} className="text-gray-300" />
                                    <p className="text-sm text-gray-400">
                                        {busca ? `Nenhuma agência encontrada para "${busca}".` : 'Nenhuma agência cadastrada ainda.'}
                                    </p>
                                    {!busca && (
                                        <p className="text-xs text-gray-300">Agências são cadastradas na hora de aprovar um projeto.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {agenciasFiltradas.map(a => (
                                        <CardAgencia
                                            key={a.id}
                                            agencia={a}
                                            podeEditar={isGestor || isVendedor}
                                            podeExcluir={isGestor}
                                            onEditar={a => setItemEditando({ tipo: 'agencia', dados: a })}
                                            onExcluir={handleExcluirAgencia}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* ── Modal de edição ───────────────────────────────────────── */}
            {itemEditando?.tipo === 'cliente' && (
                <ModalEdicao
                    titulo="Editar cliente"
                    dados={itemEditando.dados}
                    campos={CAMPOS_CLIENTE}
                    onSalvar={handleSalvarCliente}
                    onFechar={() => setItemEditando(null)}
                />
            )}
            {itemEditando?.tipo === 'agencia' && (
                <ModalEdicao
                    titulo="Editar agência"
                    dados={itemEditando.dados}
                    campos={CAMPOS_AGENCIA}
                    onSalvar={handleSalvarAgencia}
                    onFechar={() => setItemEditando(null)}
                />
            )}
        </div>
    )
}
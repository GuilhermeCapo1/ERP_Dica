import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, ChevronDown } from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'
import { temPermissao } from '@/lib/permissoes'

// ─── Configuração dos status ───────────────────────────────────────────────
const STATUS_LISTA = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado']

const STATUS_CORES = {
    'Recebido': { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Em criação': { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Memorial': { bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'Precificação': { bg: 'bg-yellow-500', light: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    'Enviado': { bg: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    'Aprovado': { bg: 'bg-green-500', light: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
}

// ─── Estado inicial do formulário ──────────────────────────────────────────
const FORM_INICIAL = {
    nome: '', cliente: '', feira: '', metragem: '', datas: '',
    local: '', briefing: '', dataLimite: '', tipo: 'Estande'
}

// ─── Helper: iniciais do nome ──────────────────────────────────────────────
function iniciais(nome) {
    if (!nome) return '?'
    return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function Projetos() {
    const [usuario, setUsuario] = useState(null)
    const [projetos, setProjetos] = useState([])
    const [modalAberto, setModalAberto] = useState(false)
    const [form, setForm] = useState(FORM_INICIAL)
    const [arquivos, setArquivos] = useState({ manual: null, mapa: null, logos: null, briefing: null })
    const [filtroStatus, setFiltroStatus] = useState('')
    const [filtroBusca, setFiltroBusca] = useState('')
    const [modalProjetista, setModalProjetista] = useState(false)
    const [projetoSelecionado, setProjetoSelecionado] = useState(null)
    const [projetistas, setProjetistas] = useState([])
    const [projetistaSelecionado, setProjetistaSelecionado] = useState('')
    const [loading, setLoading] = useState(false)
    const [erro, setErro] = useState('')
    const navigate = useNavigate()

    // ─── Carrega dados iniciais ────────────────────────────────────────
    useEffect(() => {
        async function iniciar() {
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)
            await carregarProjetos()
        }
        iniciar()
    }, [])

    async function carregarProjetos() {
        const data = await api.getProjetos()
        if (Array.isArray(data)) setProjetos(data)
    }

    async function abrirModalProjetista(projeto) {
        const lista = await api.getProjetistas()

        setProjetistas(lista)
        setProjetoSelecionado(projeto.id)
        setProjetistaSelecionado(projeto.projetistaId || '')
        setModalProjetista(true)
    }

    async function confirmarProjetista() {
        if (!projetistaSelecionado) return

        await api.alocarProjetista(projetoSelecionado, projetistaSelecionado)

        setModalProjetista(false)
        setProjetoSelecionado(null)
        setProjetistaSelecionado('')
        await carregarProjetos()
    }

    // ─── Handlers do formulário ────────────────────────────────────────
    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    async function handleCriar() {
        if (!form.cliente || !form.feira || !form.metragem || !form.datas || !form.local) {
            setErro('Todos os campos obrigatórios devem ser preenchidos')
            return
        }
        if (!arquivos.mapa || !arquivos.logos) {
            setErro('Mapa da feira e logos são obrigatórios')
            return
        }
        setLoading(true)
        setErro('')
        try {
            const res = await api.criarProjeto({
                ...form,
                metragem: form.metragem ? parseFloat(form.metragem) : null
            })
            if (res.id) {
                // Faz upload dos arquivos
                const formData = new FormData()
                if (arquivos.manual) formData.append('manual', arquivos.manual)
                if (arquivos.mapa) formData.append('mapa', arquivos.mapa)
                if (arquivos.logos) formData.append('logos', arquivos.logos)
                if (arquivos.briefing) formData.append('briefing', arquivos.briefing)
                await api.uploadArquivos(res.id, formData)

                fecharModal()
                await carregarProjetos()
            } else {
                setErro(res.message || 'Erro ao criar projeto')
            }
        } catch (err) {
            setErro('Erro ao conectar com o servidor: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    function fecharModal() {
        setModalAberto(false)
        setForm(FORM_INICIAL)
        setArquivos({ manual: null, mapa: null, logos: null, briefing: null })
        setErro('')
    }

    async function handleStatus(id, status) {
        await api.atualizarStatus(id, status)
        await carregarProjetos()
    }

    async function handleDeletar(id) {
        if (!confirm('Tem certeza que deseja deletar este projeto?')) return
        await api.deletarProjeto(id)
        await carregarProjetos()
    }

    // ─── Filtragem dos projetos ────────────────────────────────────────
    const projetosFiltrados = projetos.filter(p => {
        const passaStatus = !filtroStatus || p.status === filtroStatus
        const passaBusca = !filtroBusca ||
            p.nome?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
            p.cliente?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
            p.feira?.toLowerCase().includes(filtroBusca.toLowerCase())
        return passaStatus && passaBusca
    })

    // ─── Contagem por status (para os cards do topo) ───────────────────
    const contagemStatus = STATUS_LISTA.reduce((acc, s) => {
        acc[s] = projetos.filter(p => p.status === s).length
        return acc
    }, {})

    return (
        <div className="min-h-screen bg-gray-100 flex">
            <Sidebar usuario={usuario} />

            <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <header className="bg-[#2D3AC2] text-white px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">Projetos</h2>
                        <p className="text-blue-200 text-sm mt-0.5">
                            {projetos.length} {projetos.length === 1 ? 'projeto cadastrado' : 'projetos cadastrados'}
                        </p>
                    </div>
                    <button
                        onClick={() => setModalAberto(true)}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        Novo Projeto
                    </button>
                </header>

                <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">

                    {/* Cards de status */}
                    <div className="grid grid-cols-6 gap-3">
                        {STATUS_LISTA.map(status => {
                            const cores = STATUS_CORES[status]
                            const qtd = contagemStatus[status] || 0
                            const ativo = filtroStatus === status
                            return (
                                <button
                                    key={status}
                                    onClick={() => setFiltroStatus(ativo ? '' : status)}
                                    className={`rounded-xl p-4 text-left border transition-all
                                        ${ativo
                                            ? `${cores.bg} text-white border-transparent shadow-md scale-105`
                                            : `bg-white ${cores.border} hover:shadow-sm`
                                        }`}
                                >
                                    <div className={`w-2 h-2 rounded-full mb-2 ${ativo ? 'bg-white/60' : cores.bg}`} />
                                    <p className={`text-2xl font-bold ${ativo ? 'text-white' : cores.text}`}>{qtd}</p>
                                    <p className={`text-xs font-medium mt-0.5 leading-tight ${ativo ? 'text-white/90' : 'text-gray-600'}`}>
                                        {status}
                                    </p>
                                </button>
                            )
                        })}
                    </div>

                    {/* Barra de busca + filtro */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nome, cliente ou feira..."
                                value={filtroBusca}
                                onChange={e => setFiltroBusca(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                            />
                        </div>
                        {(filtroStatus || filtroBusca) && (
                            <button
                                onClick={() => { setFiltroStatus(''); setFiltroBusca('') }}
                                className="text-xs text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>

                    {/* Lista de projetos */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-700">
                                {filtroStatus ? `${filtroStatus} (${projetosFiltrados.length})` : `Todos os Projetos (${projetosFiltrados.length})`}
                            </h3>
                        </div>

                        {projetosFiltrados.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Search size={20} className="text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-400">
                                    {projetos.length === 0 ? 'Nenhum projeto cadastrado ainda.' : 'Nenhum projeto encontrado com esses filtros.'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {projetosFiltrados.map(p => {
                                    const cores = STATUS_CORES[p.status] || STATUS_CORES['Recebido']
                                    return (
                                        <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">

                                            {/* Avatar responsável */}
                                            <div className="w-10 h-10 rounded-full bg-[#2D3AC2]/10 flex items-center justify-center text-[#2D3AC2] text-sm font-bold shrink-0">
                                                {iniciais(p.responsavel?.name)}
                                            </div>

                                            {/* Informações do projeto */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{p.nome}</p>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cores.light} ${cores.text}`}>
                                                        {p.tipo || 'Estande'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                    {p.cliente}
                                                    {p.local && ` · ${p.local}`}
                                                    {p.metragem && ` · ${p.metragem} m²`}
                                                    {p.datas && ` · ${p.datas}`}
                                                </p>
                                            </div>

                                            {/* Responsável */}
                                            {p.responsavel && (
                                                <p className="text-xs text-gray-400 shrink-0 hidden lg:block">
                                                    {p.responsavel.name}
                                                </p>
                                            )}

                                            {/* Alocar Projetista */}
                                            {temPermissao(usuario?.cargo, 'alocarProjetista') && (
                                                <button onClick={() => abrirModalProjetista(p)}>
                                                    {p.projetista
                                                        ? `Projetista: ${p.projetista.name}`
                                                        : 'Alocar projetista'}
                                                </button>
                                            )}

                                            {/* Select de status */}
                                            <div className="relative shrink-0">
                                                <select
                                                    value={p.status}
                                                    onChange={e => handleStatus(p.id, e.target.value)}
                                                    className={`appearance-none text-xs font-medium px-3 py-1.5 pr-7 rounded-lg border cursor-pointer outline-none transition-colors
                                                        ${cores.light} ${cores.text} ${cores.border}`}
                                                >
                                                    {STATUS_LISTA.map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${cores.text}`} />
                                            </div>

                                            {/* Botão deletar */}
                                            <button
                                                onClick={() => handleDeletar(p.id)}
                                                className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                                                title="Deletar projeto"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* ── Modal Novo Projeto ──────────────────────────────────── */}
            {modalAberto && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

                        {/* Cabeçalho do modal */}
                        <div className="px-8 py-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Novo Projeto</h3>
                            <p className="text-sm text-gray-400 mt-0.5">Preencha os dados do projeto</p>
                        </div>

                        {/* Corpo com scroll */}
                        <div className="flex-1 overflow-y-auto px-8 py-6">
                            <div className="grid grid-cols-2 gap-4">

                                {/* Cliente — ocupa linha inteira */}
                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Cliente <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="cliente"
                                        value={form.cliente}
                                        onChange={handleChange}
                                        placeholder="Nome do cliente"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Feira <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="feira"
                                        value={form.feira}
                                        onChange={handleChange}
                                        placeholder="Nome da feira"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Metragem (m²) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="metragem"
                                        type="number"
                                        value={form.metragem}
                                        onChange={handleChange}
                                        placeholder="Ex: 36"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Tipo</label>
                                    <select
                                        name="tipo"
                                        value={form.tipo}
                                        onChange={handleChange}
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 bg-white transition"
                                    >
                                        <option value="Estande">Estande</option>
                                        <option value="Cenografia">Cenografia</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Datas <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="datas"
                                        value={form.datas}
                                        onChange={handleChange}
                                        placeholder="Ex: 10 a 14/08/2025"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Data limite</label>
                                    <input
                                        name="dataLimite"
                                        type="date"
                                        value={form.dataLimite}
                                        onChange={handleChange}
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                    />
                                </div>

                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Local <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="local"
                                        value={form.local}
                                        onChange={handleChange}
                                        placeholder="Ex: Expo Center Norte — São Paulo"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                    />
                                </div>

                                {/* Briefing */}
                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Briefing</label>
                                    <textarea
                                        name="briefing"
                                        value={form.briefing}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder="Descreva o briefing aqui... ou anexe um arquivo abaixo"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 resize-none transition"
                                    />
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-400">ou anexe um arquivo:</span>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={e => setArquivos(a => ({ ...a, briefing: e.target.files[0] }))}
                                            className="text-xs text-gray-500"
                                        />
                                    </div>
                                </div>

                                {/* Uploads */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Manual do expositor</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => setArquivos(a => ({ ...a, manual: e.target.files[0] }))}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Mapa da feira <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => setArquivos(a => ({ ...a, mapa: e.target.files[0] }))}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500"
                                    />
                                </div>

                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Logos <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => setArquivos(a => ({ ...a, logos: e.target.files[0] }))}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500"
                                    />
                                </div>
                            </div>

                            {erro && (
                                <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-600">{erro}</p>
                                </div>
                            )}
                        </div>

                        {/* Rodapé do modal */}
                        <div className="px-8 py-5 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={fecharModal}
                                className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCriar}
                                disabled={loading}
                                className="px-5 py-2 text-sm font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Salvando...' : 'Enviar para análise'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Modal Alocar Projetista ─────────────────────────────── */}
            {modalProjetista && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm">

                        <h3 className="text-lg font-semibold mb-4">
                            Alocar projetista
                        </h3>

                        <select
                            value={projetistaSelecionado}
                            onChange={(e) => setProjetistaSelecionado(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4"
                        >
                            <option value="">Selecione um projetista</option>
                            {projetistas.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setModalProjetista(false)}
                                className="px-4 py-2 text-sm text-gray-500"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={confirmarProjetista}
                                className="px-4 py-2 bg-[#2D3AC2] text-white rounded-lg"
                            >
                                Confirmar
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    FileSignature, Download, CheckCircle2, Clock,
    Plus, Pencil, Trash2, X, Check, Search,
} from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'
import { temPermissao } from '@/lib/permissoes'

// ─── Modal: criar/editar número do contrato ────────────────────────────────
function ModalNovoContrato({ projeto, contratoExistente, onSalvar, onFechar }) {
    const [numero, setNumero]     = useState(contratoExistente?.numero || '')
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro]         = useState('')

    // Sugere número automático no formato 001/ANO quando criando novo
    useEffect(() => {
        if (!contratoExistente && !numero) {
            const ano = new Date().getFullYear()
            setNumero(`___/${ano}`)
        }
    }, [])

    async function handleSalvar() {
        setSalvando(true)
        setErro('')
        try {
            await onSalvar(numero.trim())
        } catch (err) {
            setErro('Erro ao salvar: ' + err.message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900">
                        {contratoExistente ? 'Editar número do contrato' : 'Gerar contrato'}
                    </h3>
                    <p className="text-sm text-gray-400 mt-0.5">{projeto.nome}</p>
                </div>

                <div className="px-6 py-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Número do contrato
                        </label>
                        <input
                            value={numero}
                            onChange={e => setNumero(e.target.value)}
                            placeholder={`Ex: 114/${new Date().getFullYear()}`}
                            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                            autoFocus
                        />
                        <p className="text-xs text-gray-400">
                            Você pode deixar em branco — o campo ficará como "___/____" no documento e você preenche manualmente depois.
                        </p>
                    </div>

                    {/* Resumo do projeto */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dados do projeto</p>
                        <p className="text-sm text-gray-700"><span className="text-gray-400">Cliente:</span> {projeto.clienteRef?.nomeEmpresa || projeto.cliente}</p>
                        {projeto.feira && <p className="text-sm text-gray-700"><span className="text-gray-400">Evento:</span> {projeto.feira}</p>}
                        {projeto.datas && <p className="text-sm text-gray-700"><span className="text-gray-400">Datas:</span> {projeto.datas}</p>}
                        {projeto.metragem && <p className="text-sm text-gray-700"><span className="text-gray-400">Metragem:</span> {projeto.metragem}m²</p>}
                    </div>

                    {erro && (
                        <p className="text-sm text-red-500">{erro}</p>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onFechar}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSalvar}
                        disabled={salvando}
                        className="px-4 py-2 text-sm font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        {salvando ? 'Salvando...' : contratoExistente ? 'Atualizar' : 'Criar contrato'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Card de um contrato ───────────────────────────────────────────────────
function CardContrato({ contrato, usuario, onEditar, onAssinar, onBaixar, onDeletar, baixando }) {
    const projeto = contrato.projeto
    const cliente = projeto?.clienteRef?.nomeEmpresa || projeto?.cliente || '—'

    const dataGeracao = new Date(contrato.criadoEm).toLocaleDateString('pt-BR')
    const dataAssinatura = contrato.assinadoEm
        ? new Date(contrato.assinadoEm).toLocaleDateString('pt-BR')
        : null

    const podeAssinar  = temPermissao(usuario?.cargo, 'assinarContrato')
    const podeDeletar  = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase())

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <div className="flex items-start gap-4">

                {/* Ícone de status */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5
                    ${contrato.assinado ? 'bg-green-50' : 'bg-gray-100'}`}>
                    {contrato.assinado
                        ? <CheckCircle2 size={20} className="text-green-600" />
                        : <Clock size={20} className="text-gray-400" />
                    }
                </div>

                {/* Informações */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 truncate">{cliente}</p>
                        {contrato.numero && (
                            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                                #{contrato.numero}
                            </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                            contrato.assinado
                                ? 'bg-green-50 text-green-700'
                                : 'bg-yellow-50 text-yellow-700'
                        }`}>
                            {contrato.assinado ? 'Assinado' : 'Pendente assinatura'}
                        </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {projeto?.nome}
                        {projeto?.feira && ` · ${projeto.feira}`}
                        {projeto?.datas && ` · ${projeto.datas}`}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-gray-400">
                            Gerado em {dataGeracao}
                            {contrato.criadoPor && ` por ${contrato.criadoPor.name}`}
                        </span>
                        {dataAssinatura && (
                            <span className="text-xs text-green-600 font-medium">
                                ✓ Assinado em {dataAssinatura}
                            </span>
                        )}
                    </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Editar número */}
                    <button
                        onClick={() => onEditar(contrato)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar número do contrato"
                    >
                        <Pencil size={13} />
                        Nº
                    </button>

                    {/* Marcar como assinado */}
                    {podeAssinar && !contrato.assinado && (
                        <button
                            onClick={() => onAssinar(contrato.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                            <Check size={13} />
                            Marcar assinado
                        </button>
                    )}

                    {/* Baixar .docx */}
                    <button
                        onClick={() => onBaixar(contrato)}
                        disabled={baixando === contrato.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Download size={13} />
                        {baixando === contrato.id ? 'Gerando...' : 'Baixar .docx'}
                    </button>

                    {/* Deletar */}
                    {podeDeletar && (
                        <button
                            onClick={() => onDeletar(contrato.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            title="Deletar contrato"
                        >
                            <Trash2 size={15} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default function Contratos() {
    const [usuario,    setUsuario]    = useState(null)
    const [contratos,  setContratos]  = useState([])
    const [projetos,   setProjetos]   = useState([])  // projetos aprovados sem contrato ainda
    const [carregando, setCarregando] = useState(true)
    const [busca,      setBusca]      = useState('')
    const [filtro,     setFiltro]     = useState('todos') // 'todos' | 'pendente' | 'assinado'

    // Modais
    const [modalAberto,    setModalAberto]    = useState(false)
    const [projetoModal,   setProjetoModal]   = useState(null)  // projeto para criar novo contrato
    const [contratoEditar, setContratoEditar] = useState(null)  // contrato para editar número

    // Estados de ação
    const [baixando, setBaixando] = useState(null)
    const [erro,     setErro]     = useState('')

    const navigate = useNavigate()

    // ─── Carrega dados iniciais ────────────────────────────────────────────
    useEffect(() => {
        async function iniciar() {
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)
            await carregarDados()
        }
        iniciar()
    }, [])

    async function carregarDados() {
        setCarregando(true)
        try {
            // Carrega contratos já criados
            const listaContratos = await api.getContratos()
            setContratos(Array.isArray(listaContratos) ? listaContratos : [])

            // Carrega projetos aprovados para mostrar quais ainda não têm contrato
            const listaProjetos = await api.getProjetos({ status: 'Aprovado' })
            setContratos(listaContratos => {
                const idsComContrato = new Set(listaContratos.map(c => c.projeto?.id))
                const semContrato = Array.isArray(listaProjetos)
                    ? listaProjetos.filter(p => !idsComContrato.has(p.id))
                    : []
                setProjetos(semContrato)
                return listaContratos
            })
        } finally {
            setCarregando(false)
        }
    }

    // ─── Abre modal para criar contrato de um projeto ──────────────────────
    function handleAbrirCriar(projeto) {
        setProjetoModal(projeto)
        setContratoEditar(null)
        setModalAberto(true)
    }

    // ─── Abre modal para editar número de um contrato existente ───────────
    function handleAbrirEditar(contrato) {
        setProjetoModal(contrato.projeto)
        setContratoEditar(contrato)
        setModalAberto(true)
    }

    // ─── Salva (cria ou atualiza) ──────────────────────────────────────────
    async function handleSalvarModal(numero) {
        if (contratoEditar) {
            // Atualiza número
            await api.atualizarNumeroContrato(contratoEditar.id, numero)
        } else {
            // Cria novo contrato
            await api.criarContrato(projetoModal.id, numero)
        }
        setModalAberto(false)
        setProjetoModal(null)
        setContratoEditar(null)
        await carregarDados()
    }

    // ─── Marcar como assinado ──────────────────────────────────────────────
    async function handleAssinar(contratoId) {
        if (!confirm('Confirmar que este contrato foi assinado pelas partes?')) return
        try {
            await api.assinarContrato(contratoId)
            setContratos(prev => prev.map(c =>
                c.id === contratoId ? { ...c, assinado: true, assinadoEm: new Date().toISOString() } : c
            ))
        } catch (err) {
            setErro('Erro ao marcar como assinado: ' + err.message)
        }
    }

    // ─── Download do .docx ────────────────────────────────────────────────
    async function handleBaixar(contrato) {
        setBaixando(contrato.id)
        setErro('')
        try {
            await api.baixarContrato(contrato.id, contrato.projeto?.cliente)
        } catch (err) {
            setErro('Erro ao gerar contrato: ' + err.message)
        } finally {
            setBaixando(null)
        }
    }

    // ─── Deletar ──────────────────────────────────────────────────────────
    async function handleDeletar(contratoId) {
        if (!confirm('Tem certeza que deseja deletar este contrato?')) return
        try {
            await api.deletarContrato(contratoId)
            setContratos(prev => prev.filter(c => c.id !== contratoId))
            await carregarDados()
        } catch {
            setErro('Erro ao deletar contrato.')
        }
    }

    // ─── Filtragem e busca ────────────────────────────────────────────────
    const contratosFiltrados = contratos.filter(c => {
        const cliente = c.projeto?.clienteRef?.nomeEmpresa || c.projeto?.cliente || ''
        const nome    = c.projeto?.nome || ''

        const passaBusca = !busca ||
            cliente.toLowerCase().includes(busca.toLowerCase()) ||
            nome.toLowerCase().includes(busca.toLowerCase()) ||
            (c.numero || '').includes(busca)

        const passaFiltro =
            filtro === 'todos'    ? true :
            filtro === 'assinado' ? c.assinado :
            filtro === 'pendente' ? !c.assinado : true

        return passaBusca && passaFiltro
    })

    const totalAssinados = contratos.filter(c => c.assinado).length
    const totalPendentes = contratos.filter(c => !c.assinado).length

    // ─── Loading ──────────────────────────────────────────────────────────
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
                    <h2 className="text-xl font-bold">Contratos</h2>
                    <p className="text-blue-200 text-sm mt-0.5">
                        {contratos.length} {contratos.length === 1 ? 'contrato gerado' : 'contratos gerados'}
                    </p>
                </header>

                <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">

                    {erro && (
                        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {erro}
                        </div>
                    )}

                    {/* ── Cards de métricas ─────────────────────────────── */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500 font-medium">Total</span>
                                <div className="w-8 h-8 bg-[#2D3AC2]/10 rounded-lg flex items-center justify-center">
                                    <FileSignature size={16} className="text-[#2D3AC2]" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{contratos.length}</p>
                            <p className="text-xs text-gray-400 mt-1">contratos gerados</p>
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500 font-medium">Assinados</span>
                                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                                    <CheckCircle2 size={16} className="text-green-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{totalAssinados}</p>
                            <p className="text-xs text-gray-400 mt-1">contratos assinados</p>
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500 font-medium">Pendentes</span>
                                <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                                    <Clock size={16} className="text-yellow-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{totalPendentes}</p>
                            <p className="text-xs text-gray-400 mt-1">aguardando assinatura</p>
                        </div>
                    </div>

                    {/* ── Projetos aprovados sem contrato ──────────────── */}
                    {projetos.length > 0 && (
                        <div className="bg-white rounded-xl border border-yellow-200 shadow-sm">
                            <div className="px-5 py-4 border-b border-yellow-100 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                <p className="text-sm font-semibold text-gray-700">
                                    Projetos aprovados sem contrato ({projetos.length})
                                </p>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {projetos.map(projeto => (
                                    <div key={projeto.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {projeto.clienteRef?.nomeEmpresa || projeto.cliente}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">
                                                {projeto.nome}
                                                {projeto.datas && ` · ${projeto.datas}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleAbrirCriar(projeto)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors shrink-0"
                                        >
                                            <Plus size={13} />
                                            Gerar contrato
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Filtros e busca ───────────────────────────────── */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por cliente, projeto ou número..."
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                            />
                        </div>

                        {/* Filtro por status */}
                        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
                            {[
                                { id: 'todos',    label: 'Todos' },
                                { id: 'pendente', label: 'Pendentes' },
                                { id: 'assinado', label: 'Assinados' },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFiltro(f.id)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                                        ${filtro === f.id
                                            ? 'bg-[#2D3AC2] text-white'
                                            : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Lista de contratos ────────────────────────────── */}
                    <div className="flex flex-col gap-3">
                        {contratosFiltrados.length === 0 ? (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
                                <FileSignature size={32} className="text-gray-300" />
                                <p className="text-sm text-gray-400">
                                    {contratos.length === 0
                                        ? 'Nenhum contrato gerado ainda.'
                                        : 'Nenhum contrato encontrado com esse filtro.'
                                    }
                                </p>
                            </div>
                        ) : (
                            contratosFiltrados.map(contrato => (
                                <CardContrato
                                    key={contrato.id}
                                    contrato={contrato}
                                    usuario={usuario}
                                    onEditar={handleAbrirEditar}
                                    onAssinar={handleAssinar}
                                    onBaixar={handleBaixar}
                                    onDeletar={handleDeletar}
                                    baixando={baixando}
                                />
                            ))
                        )}
                    </div>
                </main>
            </div>

            {/* ── Modal criar/editar número ──────────────────────────── */}
            {modalAberto && projetoModal && (
                <ModalNovoContrato
                    projeto={projetoModal}
                    contratoExistente={contratoEditar}
                    onSalvar={handleSalvarModal}
                    onFechar={() => {
                        setModalAberto(false)
                        setProjetoModal(null)
                        setContratoEditar(null)
                    }}
                />
            )}
        </div>
    )
}
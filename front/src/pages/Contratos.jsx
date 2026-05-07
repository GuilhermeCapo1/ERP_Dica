import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    FileSignature, Download, CheckCircle2, Clock,
    Plus, Pencil, Trash2, Check, Search,
} from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'
import { temPermissao } from '@/lib/permissoes'

// ─── Modal: criar/editar contrato (número + testemunhas) ──────────────────
function ModalNovoContrato({ projeto, contratoExistente, onSalvar, onFechar }) {
    const [numero, setNumero]     = useState(contratoExistente?.numero || '')
    const [t1Nome, setT1Nome]     = useState(contratoExistente?.testemunha1Nome || '')
    const [t1Cpf,  setT1Cpf]      = useState(contratoExistente?.testemunha1Cpf  || '')
    const [t2Nome, setT2Nome]     = useState(contratoExistente?.testemunha2Nome || '')
    const [t2Cpf,  setT2Cpf]      = useState(contratoExistente?.testemunha2Cpf  || '')
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro]         = useState('')

    useEffect(() => {
        if (!contratoExistente && !numero) {
            setNumero(`___/${new Date().getFullYear()}`)
        }
    }, [])

    async function handleSalvar() {
        setSalvando(true)
        setErro('')
        try {
            await onSalvar({
                numero:          numero.trim(),
                testemunha1Nome: t1Nome.trim() || null,
                testemunha1Cpf:  t1Cpf.trim()  || null,
                testemunha2Nome: t2Nome.trim() || null,
                testemunha2Cpf:  t2Cpf.trim()  || null,
            })
        } catch (err) {
            setErro('Erro ao salvar: ' + err.message)
        } finally {
            setSalvando(false)
        }
    }

    const inp = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition'

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900">
                        {contratoExistente ? 'Editar contrato' : 'Gerar contrato'}
                    </h3>
                    <p className="text-sm text-gray-400 mt-0.5">{projeto.nome}</p>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

                    {/* Número */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">Número do contrato</label>
                        <input value={numero} onChange={e => setNumero(e.target.value)}
                            placeholder={`Ex: 114/${new Date().getFullYear()}`}
                            className={inp} autoFocus />
                        <p className="text-xs text-gray-400">
                            Deixe em branco para preencher manualmente no documento depois.
                        </p>
                    </div>

                    {/* Resumo do projeto */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dados do projeto</p>
                        <p className="text-sm text-gray-700">
                            <span className="text-gray-400">Cliente:</span> {projeto.clienteRef?.nomeEmpresa || projeto.cliente}
                        </p>
                        {projeto.agenciaRef && (
                            <p className="text-sm text-gray-700">
                                <span className="text-gray-400">Agência:</span> {projeto.agenciaRef.nomeEmpresa}
                            </p>
                        )}
                        {projeto.feira    && <p className="text-sm text-gray-700"><span className="text-gray-400">Evento:</span> {projeto.feira}</p>}
                        {projeto.datas    && <p className="text-sm text-gray-700"><span className="text-gray-400">Datas:</span> {projeto.datas}</p>}
                        {projeto.metragem && <p className="text-sm text-gray-700"><span className="text-gray-400">Metragem:</span> {projeto.metragem}m²</p>}
                    </div>

                    {/* Testemunhas */}
                    <div className="flex flex-col gap-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">Testemunhas</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Estes dados sairão preenchidos no documento Word.
                            </p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Testemunha 1</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-gray-500">Nome</label>
                                    <input value={t1Nome} onChange={e => setT1Nome(e.target.value)}
                                        placeholder="Nome completo" className={inp} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-gray-500">CPF</label>
                                    <input value={t1Cpf} onChange={e => setT1Cpf(e.target.value)}
                                        placeholder="000.000.000-00" className={inp} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Testemunha 2</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-gray-500">Nome</label>
                                    <input value={t2Nome} onChange={e => setT2Nome(e.target.value)}
                                        placeholder="Nome completo" className={inp} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-gray-500">CPF</label>
                                    <input value={t2Cpf} onChange={e => setT2Cpf(e.target.value)}
                                        placeholder="000.000.000-00" className={inp} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {erro && <p className="text-sm text-red-500">{erro}</p>}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={onFechar}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSalvar} disabled={salvando}
                        className="px-4 py-2 text-sm font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50">
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
    const agencia = projeto?.agenciaRef?.nomeEmpresa || null

    const dataGeracao    = new Date(contrato.criadoEm).toLocaleDateString('pt-BR')
    const dataAssinatura = contrato.assinadoEm
        ? new Date(contrato.assinadoEm).toLocaleDateString('pt-BR')
        : null

    const podeAssinar = temPermissao(usuario?.cargo, 'assinarContrato')
    const podeDeletar = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase())

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <div className="flex items-start gap-4">

                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5
                    ${contrato.assinado ? 'bg-green-50' : 'bg-gray-100'}`}>
                    {contrato.assinado
                        ? <CheckCircle2 size={20} className="text-green-600" />
                        : <Clock size={20} className="text-gray-400" />
                    }
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 truncate">{cliente}</p>
                        {agencia && (
                            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full shrink-0">
                                via {agencia}
                            </span>
                        )}
                        {contrato.numero && (
                            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                                #{contrato.numero}
                            </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                            contrato.assinado ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
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
                        {(contrato.testemunha1Nome || contrato.testemunha2Nome) && (
                            <span className="text-xs text-gray-400">
                                · {[contrato.testemunha1Nome, contrato.testemunha2Nome].filter(Boolean).length} testemunha(s)
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => onEditar(contrato)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <Pencil size={13} /> Editar
                    </button>

                    {podeAssinar && !contrato.assinado && (
                        <button onClick={() => onAssinar(contrato.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                            <Check size={13} /> Marcar assinado
                        </button>
                    )}

                    <button onClick={() => onBaixar(contrato)} disabled={baixando === contrato.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50">
                        <Download size={13} />
                        {baixando === contrato.id ? 'Gerando...' : 'Baixar .docx'}
                    </button>

                    {podeDeletar && (
                        <button onClick={() => onDeletar(contrato.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors">
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
    const [projetos,   setProjetos]   = useState([])
    const [carregando, setCarregando] = useState(true)
    const [busca,      setBusca]      = useState('')
    const [filtro,     setFiltro]     = useState('todos')

    const [modalAberto,    setModalAberto]    = useState(false)
    const [projetoModal,   setProjetoModal]   = useState(null)
    const [contratoEditar, setContratoEditar] = useState(null)

    const [baixando, setBaixando] = useState(null)
    const [erro,     setErro]     = useState('')

    const navigate = useNavigate()

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
            const listaContratos = await api.getContratos()
            setContratos(Array.isArray(listaContratos) ? listaContratos : [])

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

    function handleAbrirCriar(projeto) {
        setProjetoModal(projeto)
        setContratoEditar(null)
        setModalAberto(true)
    }

    function handleAbrirEditar(contrato) {
        setProjetoModal(contrato.projeto)
        setContratoEditar(contrato)
        setModalAberto(true)
    }

    async function handleSalvarModal(dados) {
        if (contratoEditar) {
            await api.atualizarContrato(contratoEditar.id, dados)
        } else {
            const criado = await api.criarContrato(projetoModal.id, dados.numero)
            if (dados.testemunha1Nome || dados.testemunha2Nome) {
                await api.atualizarContrato(criado.id, {
                    testemunha1Nome: dados.testemunha1Nome,
                    testemunha1Cpf:  dados.testemunha1Cpf,
                    testemunha2Nome: dados.testemunha2Nome,
                    testemunha2Cpf:  dados.testemunha2Cpf,
                })
            }
        }
        setModalAberto(false)
        setProjetoModal(null)
        setContratoEditar(null)
        await carregarDados()
    }

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

    const contratosFiltrados = contratos.filter(c => {
        const cliente    = c.projeto?.clienteRef?.nomeEmpresa || c.projeto?.cliente || ''
        const nome       = c.projeto?.nome || ''
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
                    <h2 className="text-xl font-bold">Contratos</h2>
                    <p className="text-blue-200 text-sm mt-0.5">
                        {contratos.length} {contratos.length === 1 ? 'contrato gerado' : 'contratos gerados'}
                    </p>
                </header>

                <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">

                    {erro && (
                        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{erro}</div>
                    )}

                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Total', valor: contratos.length, sub: 'contratos gerados', cor: 'bg-[#2D3AC2]/10', icone: <FileSignature size={16} className="text-[#2D3AC2]" /> },
                            { label: 'Assinados', valor: totalAssinados, sub: 'contratos assinados', cor: 'bg-green-50', icone: <CheckCircle2 size={16} className="text-green-600" /> },
                            { label: 'Pendentes', valor: totalPendentes, sub: 'aguardando assinatura', cor: 'bg-yellow-50', icone: <Clock size={16} className="text-yellow-600" /> },
                        ].map(m => (
                            <div key={m.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-gray-500 font-medium">{m.label}</span>
                                    <div className={`w-8 h-8 ${m.cor} rounded-lg flex items-center justify-center`}>{m.icone}</div>
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{m.valor}</p>
                                <p className="text-xs text-gray-400 mt-1">{m.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Projetos sem contrato */}
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
                                                {projeto.nome}{projeto.datas && ` · ${projeto.datas}`}
                                            </p>
                                        </div>
                                        <button onClick={() => handleAbrirCriar(projeto)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors shrink-0">
                                            <Plus size={13} /> Gerar contrato
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Filtros */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Buscar por cliente, projeto ou número..."
                                value={busca} onChange={e => setBusca(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition" />
                        </div>
                        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
                            {[{ id: 'todos', label: 'Todos' }, { id: 'pendente', label: 'Pendentes' }, { id: 'assinado', label: 'Assinados' }].map(f => (
                                <button key={f.id} onClick={() => setFiltro(f.id)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                                        ${filtro === f.id ? 'bg-[#2D3AC2] text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lista */}
                    <div className="flex flex-col gap-3">
                        {contratosFiltrados.length === 0 ? (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
                                <FileSignature size={32} className="text-gray-300" />
                                <p className="text-sm text-gray-400">
                                    {contratos.length === 0 ? 'Nenhum contrato gerado ainda.' : 'Nenhum contrato encontrado com esse filtro.'}
                                </p>
                            </div>
                        ) : (
                            contratosFiltrados.map(contrato => (
                                <CardContrato key={contrato.id} contrato={contrato} usuario={usuario}
                                    onEditar={handleAbrirEditar} onAssinar={handleAssinar}
                                    onBaixar={handleBaixar} onDeletar={handleDeletar} baixando={baixando} />
                            ))
                        )}
                    </div>
                </main>
            </div>

            {modalAberto && projetoModal && (
                <ModalNovoContrato
                    projeto={projetoModal}
                    contratoExistente={contratoEditar}
                    onSalvar={handleSalvarModal}
                    onFechar={() => { setModalAberto(false); setProjetoModal(null); setContratoEditar(null) }}
                />
            )}
        </div>
    )
}
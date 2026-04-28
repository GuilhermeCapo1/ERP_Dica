import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, ChevronDown, RotateCcw, CheckCircle, XCircle } from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'
import { temPermissao } from '@/lib/permissoes'

// ─── Configuração dos status ───────────────────────────────────────────────
const STATUS_LISTA = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado', 'Reprovado']

const STATUS_CORES = {
    'Recebido':     { bg: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
    'Em criação':   { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Memorial':     { bg: 'bg-red-500',    light: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
    'Precificação': { bg: 'bg-yellow-500', light: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    'Enviado':      { bg: 'bg-cyan-500',   light: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200' },
    'Aprovado':     { bg: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
    'Reprovado':    { bg: 'bg-red-700',    light: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-300' },
}

// Status que o gerente pode selecionar para voltar
const STATUS_VOLTAR = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado']

const FORM_INICIAL = {
    nome: '', cliente: '', feira: '', metragem: '', datas: '',
    local: '', briefing: '', dataLimite: '', tipo: 'Estande'
}

function iniciais(nome) {
    if (!nome) return '?'
    return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Modal de Voltar Status ────────────────────────────────────────────────
function ModalVoltarStatus({ projeto, onConfirmar, onFechar }) {
    const ordemStatus = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado']
    const indiceAtual = ordemStatus.indexOf(projeto.status)
    // Só mostra status anteriores ao atual
    const statusDisponiveis = ordemStatus.slice(0, indiceAtual)

    const [statusEscolhido, setStatusEscolhido] = useState('')
    const [justificativa, setJustificativa] = useState('')

    function handleConfirmar() {
        if (!statusEscolhido) return
        onConfirmar(statusEscolhido, justificativa)
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900">Voltar status do projeto</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{projeto.nome}</p>
                </div>
                <div className="px-6 py-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Status atual: <span className="text-[#2D3AC2] font-bold">{projeto.status}</span>
                        </label>
                        <label className="text-sm font-medium text-gray-700 mt-2">
                            Voltar para:
                        </label>
                        <select
                            value={statusEscolhido}
                            onChange={e => setStatusEscolhido(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition bg-white"
                        >
                            <option value="">Selecione o status</option>
                            {statusDisponiveis.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Justificativa <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            value={justificativa}
                            onChange={e => setJustificativa(e.target.value)}
                            rows={3}
                            placeholder="Ex: Cliente solicitou alteração no projeto..."
                            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 resize-none transition"
                        />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onFechar}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmar}
                        disabled={!statusEscolhido}
                        className="px-4 py-2 text-sm font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Modal de Aprovação/Reprovação ─────────────────────────────────────────
function ModalResultado({ projeto, onConfirmar, onFechar }) {
    const [resultado, setResultado] = useState('') // 'aprovado' | 'reprovado'
    const [etapa, setEtapa] = useState(1) // 1 = escolher resultado | 2 = dados do cliente
    const [carregando, setCarregando] = useState(false)
    const [erro, setErro] = useState('')

    // Dados do cliente
    const [dadosCliente, setDadosCliente] = useState({
        nomeEmpresa: projeto.cliente || '',
        nomeFantasia: '',
        cnpj: '',
        cpf: '',
        email: '',
        telefone: '',
        endereco: '',
        cidade: '',
        estado: '',
        cep: '',
        responsavel: '',
    })

    // Condições comerciais
    const [condicoes, setCondicoes] = useState({
        formaPagamento: '',   // 'boleto' | 'pix'
        tipoDocumento: '',    // 'nota_fiscal' | 'recibo_locacao'
        condicoesPagamento: '',
        observacoes: '',
    })

    function handleDadosChange(e) {
        setDadosCliente(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleCondicoesChange(e) {
        setCondicoes(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function avancar() {
        if (!resultado) return
        if (resultado === 'reprovado') {
            handleSalvar()
            return
        }
        setEtapa(2)
    }

    async function handleSalvar() {
        if (resultado === 'aprovado') {
            if (!dadosCliente.nomeEmpresa) {
                setErro('Nome da empresa é obrigatório')
                return
            }
            if (!condicoes.formaPagamento || !condicoes.tipoDocumento) {
                setErro('Forma de pagamento e tipo de documento são obrigatórios')
                return
            }
        }

        setCarregando(true)
        setErro('')
        try {
            await onConfirmar({
                resultado,
                ...(resultado === 'aprovado' ? { ...dadosCliente, ...condicoes } : {})
            })
        } catch (err) {
            setErro('Erro ao salvar: ' + err.message)
        } finally {
            setCarregando(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Cabeçalho */}
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900">Resultado do projeto</h3>
                    <p className="text-sm text-gray-400 mt-0.5">{projeto.nome}</p>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">

                    {/* Etapa 1: Escolher resultado */}
                    {etapa === 1 && (
                        <div className="flex flex-col gap-4">
                            <p className="text-sm text-gray-600">
                                O cliente aprovou ou reprovou a proposta enviada?
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setResultado('aprovado')}
                                    className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left
                                        ${resultado === 'aprovado'
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-green-300'
                                        }`}
                                >
                                    <CheckCircle size={24} className={resultado === 'aprovado' ? 'text-green-600' : 'text-gray-300'} />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Aprovado</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Cliente aceitou a proposta</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setResultado('reprovado')}
                                    className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left
                                        ${resultado === 'reprovado'
                                            ? 'border-red-500 bg-red-50'
                                            : 'border-gray-200 hover:border-red-300'
                                        }`}
                                >
                                    <XCircle size={24} className={resultado === 'reprovado' ? 'text-red-600' : 'text-gray-300'} />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Reprovado</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Cliente recusou a proposta</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Etapa 2: Dados do cliente + condições (só se aprovado) */}
                    {etapa === 2 && resultado === 'aprovado' && (
                        <div className="flex flex-col gap-6">

                            {/* Dados da empresa */}
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-3">Dados da empresa contratante</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">
                                            Razão Social / Nome da Empresa <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="nomeEmpresa"
                                            value={dadosCliente.nomeEmpresa}
                                            onChange={handleDadosChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">Nome Fantasia</label>
                                        <input
                                            name="nomeFantasia"
                                            value={dadosCliente.nomeFantasia}
                                            onChange={handleDadosChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">CNPJ</label>
                                        <input
                                            name="cnpj"
                                            value={dadosCliente.cnpj}
                                            onChange={handleDadosChange}
                                            placeholder="00.000.000/0000-00"
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">CPF (se pessoa física)</label>
                                        <input
                                            name="cpf"
                                            value={dadosCliente.cpf}
                                            onChange={handleDadosChange}
                                            placeholder="000.000.000-00"
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">E-mail</label>
                                        <input
                                            name="email"
                                            type="email"
                                            value={dadosCliente.email}
                                            onChange={handleDadosChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">Telefone</label>
                                        <input
                                            name="telefone"
                                            value={dadosCliente.telefone}
                                            onChange={handleDadosChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">Nome do Responsável</label>
                                        <input
                                            name="responsavel"
                                            value={dadosCliente.responsavel}
                                            onChange={handleDadosChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">CEP</label>
                                        <input
                                            name="cep"
                                            value={dadosCliente.cep}
                                            onChange={handleDadosChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">Endereço</label>
                                        <input
                                            name="endereco"
                                            value={dadosCliente.endereco}
                                            onChange={handleDadosChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">Cidade</label>
                                        <input
                                            name="cidade"
                                            value={dadosCliente.cidade}
                                            onChange={handleDadosChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">Estado</label>
                                        <input
                                            name="estado"
                                            value={dadosCliente.estado}
                                            onChange={handleDadosChange}
                                            placeholder="SP"
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Condições comerciais */}
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-3">Condições acordadas</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">
                                            Forma de pagamento <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="formaPagamento"
                                            value={condicoes.formaPagamento}
                                            onChange={handleCondicoesChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 bg-white transition"
                                        >
                                            <option value="">Selecione</option>
                                            <option value="boleto">Boleto</option>
                                            <option value="pix">PIX</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">
                                            Tipo de documento <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="tipoDocumento"
                                            value={condicoes.tipoDocumento}
                                            onChange={handleCondicoesChange}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 bg-white transition"
                                        >
                                            <option value="">Selecione</option>
                                            <option value="nota_fiscal">Nota Fiscal</option>
                                            <option value="recibo_locacao">Recibo de Locação</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">
                                            Condições de pagamento
                                        </label>
                                        <input
                                            name="condicoesPagamento"
                                            value={condicoes.condicoesPagamento}
                                            onChange={handleCondicoesChange}
                                            placeholder="Ex: 30/60/90 dias, entrada + parcelas..."
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                                        />
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500">Observações</label>
                                        <textarea
                                            name="observacoes"
                                            value={condicoes.observacoes}
                                            onChange={handleCondicoesChange}
                                            rows={2}
                                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 resize-none transition"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {erro && (
                        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {erro}
                        </div>
                    )}
                </div>

                {/* Rodapé */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
                    <button
                        onClick={etapa === 2 ? () => setEtapa(1) : onFechar}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {etapa === 2 ? '← Voltar' : 'Cancelar'}
                    </button>
                    <button
                        onClick={etapa === 1 ? avancar : handleSalvar}
                        disabled={!resultado || carregando}
                        className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50
                            ${resultado === 'reprovado' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        {carregando ? 'Salvando...' :
                            etapa === 1
                                ? resultado === 'reprovado' ? 'Confirmar reprovação' : 'Próximo →'
                                : 'Confirmar aprovação'
                        }
                    </button>
                </div>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
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
    const [modalVoltarStatus, setModalVoltarStatus] = useState(false)
    const [projetoVoltarStatus, setProjetoVoltarStatus] = useState(null)
    const [modalResultado, setModalResultado] = useState(false)
    const [projetoResultado, setProjetoResultado] = useState(null)
    const [loading, setLoading] = useState(false)
    const [erro, setErro] = useState('')
    const navigate = useNavigate()

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
        setProjetoSelecionado(projeto)
        setProjetistaSelecionado(projeto.projetistaId || '')
        setModalProjetista(true)
    }

    async function confirmarProjetista() {
        if (!projetistaSelecionado) return
        await api.alocarProjetista(projetoSelecionado.id, projetistaSelecionado)
        setModalProjetista(false)
        setProjetoSelecionado(null)
        setProjetistaSelecionado('')
        await carregarProjetos()
    }

    async function handleVoltarStatus(status, justificativa) {
        try {
            await api.atualizarStatus(projetoVoltarStatus.id, status, justificativa)
            setModalVoltarStatus(false)
            setProjetoVoltarStatus(null)
            await carregarProjetos()
        } catch (err) {
            setErro('Erro ao voltar status: ' + err.message)
        }
    }

    async function handleResultado(dados) {
        await api.registrarResultado(projetoResultado.id, dados)
        setModalResultado(false)
        setProjetoResultado(null)
        await carregarProjetos()
    }

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

    async function handleDeletar(id) {
        if (!confirm('Tem certeza que deseja deletar este projeto?')) return
        await api.deletarProjeto(id)
        await carregarProjetos()
    }

    const projetosFiltrados = projetos.filter(p => {
        const passaStatus = !filtroStatus || p.status === filtroStatus
        const passaBusca = !filtroBusca ||
            p.nome?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
            p.cliente?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
            p.feira?.toLowerCase().includes(filtroBusca.toLowerCase())
        return passaStatus && passaBusca
    })

    const STATUS_LISTA_CARDS = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado']
    const contagemStatus = STATUS_LISTA_CARDS.reduce((acc, s) => {
        acc[s] = projetos.filter(p => p.status === s).length
        return acc
    }, {})

    const podeVoltarStatus = temPermissao(usuario?.cargo, 'alterarStatus') ||
        ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase())

    return (
        <div className="min-h-screen bg-gray-100 flex">
            <Sidebar usuario={usuario} />

            <div className="flex-1 flex flex-col min-w-0">
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
                        <Plus size={16} /> Novo Projeto
                    </button>
                </header>

                <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">

                    {/* Cards de status */}
                    <div className="grid grid-cols-6 gap-3">
                        {STATUS_LISTA_CARDS.map(status => {
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

                    {/* Busca */}
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
                        <div className="px-5 py-4 border-b border-gray-50">
                            <h3 className="text-sm font-semibold text-gray-700">
                                {filtroStatus ? `${filtroStatus} (${projetosFiltrados.length})` : `Todos os Projetos (${projetosFiltrados.length})`}
                            </h3>
                        </div>

                        {projetosFiltrados.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Search size={20} className="text-gray-400" />
                                <p className="text-sm text-gray-400">
                                    {projetos.length === 0 ? 'Nenhum projeto cadastrado ainda.' : 'Nenhum projeto encontrado com esses filtros.'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {projetosFiltrados.map(p => {
                                    const cores = STATUS_CORES[p.status] || STATUS_CORES['Recebido']
                                    const ehVendedorResponsavel = p.responsavelId === usuario?.id
                                    const podeVerBotaoResultado = ehVendedorResponsavel && p.status === 'Enviado' && !p.resultadoFinal
                                    const statusJaFinalizado = ['Aprovado', 'Reprovado'].includes(p.status)

                                    // Pode voltar status: gerente/diretor, projeto não finalizado
                                    const podeMostrarVoltarStatus = podeVoltarStatus &&
                                        !statusJaFinalizado &&
                                        p.status !== 'Recebido'

                                    return (
                                        <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">

                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full bg-[#2D3AC2]/10 flex items-center justify-center text-[#2D3AC2] text-sm font-bold shrink-0">
                                                {iniciais(p.responsavel?.name)}
                                            </div>

                                            {/* Informações */}
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

                                            {/* Alocar projetista */}
                                            {temPermissao(usuario?.cargo, 'alocarProjetista') && !statusJaFinalizado && (
                                                <button
                                                    onClick={() => abrirModalProjetista(p)}
                                                    className="text-xs text-gray-500 hover:text-[#2D3AC2] px-2 py-1 rounded-lg hover:bg-[#2D3AC2]/10 transition-colors shrink-0"
                                                >
                                                    {p.projetista ? `Projetista: ${p.projetista.name}` : 'Alocar projetista'}
                                                </button>
                                            )}

                                            {/* Botão de resultado (aprovado/reprovado) — só vendedor responsável quando status = Enviado */}
                                            {podeVerBotaoResultado && (
                                                <button
                                                    onClick={() => { setProjetoResultado(p); setModalResultado(true) }}
                                                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors shrink-0"
                                                >
                                                    <CheckCircle size={13} />
                                                    Registrar resultado
                                                </button>
                                            )}

                                            {/* Badge de resultado final */}
                                            {statusJaFinalizado && (
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0
                                                    ${p.status === 'Aprovado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {p.status}
                                                </span>
                                            )}

                                            {/* Botão voltar status — só gerente/diretor */}
                                            {podeMostrarVoltarStatus && (
                                                <button
                                                    onClick={() => { setProjetoVoltarStatus(p); setModalVoltarStatus(true) }}
                                                    className="text-gray-300 hover:text-orange-500 transition-colors shrink-0"
                                                    title="Voltar status do projeto"
                                                >
                                                    <RotateCcw size={15} />
                                                </button>
                                            )}

                                            {/* Status badge (não mostra para finalizados) */}
                                            {!statusJaFinalizado && (
                                                <div className="relative shrink-0">
                                                    <select
                                                        value={p.status}
                                                        onChange={e => api.atualizarStatus(p.id, e.target.value).then(carregarProjetos)}
                                                        disabled={!podeVoltarStatus}
                                                        className={`appearance-none text-xs font-medium px-3 py-1.5 pr-7 rounded-lg border cursor-pointer outline-none transition-colors
                                                            ${cores.light} ${cores.text} ${cores.border}
                                                            disabled:cursor-default`}
                                                    >
                                                        {STATUS_LISTA.filter(s => !['Aprovado', 'Reprovado'].includes(s)).map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${cores.text}`} />
                                                </div>
                                            )}

                                            {/* Deletar */}
                                            {temPermissao(usuario?.cargo, 'deletarProjeto') && (
                                                <button
                                                    onClick={() => handleDeletar(p.id)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                                                    title="Deletar projeto"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
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
                        <div className="px-8 py-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Novo Projeto</h3>
                            <p className="text-sm text-gray-400 mt-0.5">Preencha os dados do projeto</p>
                        </div>
                        <div className="flex-1 overflow-y-auto px-8 py-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Cliente <span className="text-red-500">*</span></label>
                                    <input name="cliente" value={form.cliente} onChange={handleChange} placeholder="Nome do cliente"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Feira <span className="text-red-500">*</span></label>
                                    <input name="feira" value={form.feira} onChange={handleChange} placeholder="Nome da feira"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Metragem (m²) <span className="text-red-500">*</span></label>
                                    <input name="metragem" type="number" value={form.metragem} onChange={handleChange} placeholder="Ex: 36"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Tipo</label>
                                    <select name="tipo" value={form.tipo} onChange={handleChange}
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 bg-white transition">
                                        <option value="Estande">Estande</option>
                                        <option value="Cenografia">Cenografia</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Datas <span className="text-red-500">*</span></label>
                                    <input name="datas" value={form.datas} onChange={handleChange} placeholder="Ex: 10 a 14/08/2025"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Data limite</label>
                                    <input name="dataLimite" type="date" value={form.dataLimite} onChange={handleChange}
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition" />
                                </div>
                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Local <span className="text-red-500">*</span></label>
                                    <input name="local" value={form.local} onChange={handleChange} placeholder="Ex: Expo Center Norte — São Paulo"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition" />
                                </div>
                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Briefing</label>
                                    <textarea name="briefing" value={form.briefing} onChange={handleChange} rows={3}
                                        placeholder="Descreva o briefing aqui... ou anexe um arquivo abaixo"
                                        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 resize-none transition" />
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-400">ou anexe um arquivo:</span>
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={e => setArquivos(a => ({ ...a, briefing: e.target.files[0] }))}
                                            className="text-xs text-gray-500" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Manual do expositor</label>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => setArquivos(a => ({ ...a, manual: e.target.files[0] }))}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Mapa da feira <span className="text-red-500">*</span></label>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => setArquivos(a => ({ ...a, mapa: e.target.files[0] }))}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500" />
                                </div>
                                <div className="col-span-2 flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-gray-700">Logos <span className="text-red-500">*</span></label>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => setArquivos(a => ({ ...a, logos: e.target.files[0] }))}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500" />
                                </div>
                            </div>
                            {erro && (
                                <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-600">{erro}</p>
                                </div>
                            )}
                        </div>
                        <div className="px-8 py-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={fecharModal}
                                className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleCriar} disabled={loading}
                                className="px-5 py-2 text-sm font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50">
                                {loading ? 'Salvando...' : 'Enviar para análise'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Alocar Projetista ─────────────────────────────── */}
            {modalProjetista && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Alocar projetista</h3>
                        <select
                            value={projetistaSelecionado}
                            onChange={e => setProjetistaSelecionado(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-[#2D3AC2] bg-white"
                        >
                            <option value="">Selecione um projetista</option>
                            {projetistas.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setModalProjetista(false)}
                                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                                Cancelar
                            </button>
                            <button onClick={confirmarProjetista}
                                className="px-4 py-2 text-sm font-medium bg-[#2D3AC2] text-white rounded-lg hover:bg-[#232fa8] transition-colors">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Voltar Status ─────────────────────────────────── */}
            {modalVoltarStatus && projetoVoltarStatus && (
                <ModalVoltarStatus
                    projeto={projetoVoltarStatus}
                    onConfirmar={handleVoltarStatus}
                    onFechar={() => { setModalVoltarStatus(false); setProjetoVoltarStatus(null) }}
                />
            )}

            {/* ── Modal Resultado (Aprovado/Reprovado) ────────────────── */}
            {modalResultado && projetoResultado && (
                <ModalResultado
                    projeto={projetoResultado}
                    onConfirmar={handleResultado}
                    onFechar={() => { setModalResultado(false); setProjetoResultado(null) }}
                />
            )}
        </div>
    )
}
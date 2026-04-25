import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    FileText, Plus, ChevronDown, Eye, Trash2,
    GripVertical, ToggleLeft, ToggleRight, Download,
    ArrowLeft, Save, X, Check
} from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ─── Configuração dos 6 campos do memorial ─────────────────────────────────
const CAMPOS_CONFIG = [
    { key: 'piso',              label: '01 - PISO' },
    { key: 'estrutura',         label: '02 - ESTRUTURA' },
    { key: 'areaAtendimento',   label: '03 - Área de Atendimento' },
    { key: 'audioVisual',       label: '04 - Áudio Visual' },
    { key: 'comunicacaoVisual', label: '05 - Comunicação Visual' },
    { key: 'eletrica',          label: '06 - Elétrica' },
]

// ─── Estado inicial dos campos ─────────────────────────────────────────────
const CAMPOS_INICIAIS = {
    piso: '',
    estrutura: '',
    areaAtendimento: '',
    audioVisual: '',
    comunicacaoVisual: '',
    eletrica: '',
}

// ─── Tela de seleção de projeto ────────────────────────────────────────────
function TelaSelecao({ projetos, onSelecionar }) {
    const [busca, setBusca] = useState('')

    const filtrados = projetos.filter(p =>
        p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        p.cliente?.toLowerCase().includes(busca.toLowerCase())
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Selecione um projeto para criar ou editar o memorial
                </h3>
                <input
                    type="text"
                    placeholder="Buscar projeto..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                />
            </div>

            <div className="flex flex-col gap-2">
                {filtrados.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-16">
                        <p className="text-sm text-gray-400">Nenhum projeto encontrado.</p>
                    </div>
                ) : (
                    filtrados.map(p => (
                        <button
                            key={p.id}
                            onClick={() => onSelecionar(p)}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-left hover:border-[#2D3AC2]/30 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{p.nome}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                                        {p.cliente}
                                        {p.local && ` · ${p.local}`}
                                        {p.metragem && ` · ${p.metragem}m²`}
                                        {p.datas && ` · ${p.datas}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                    <span className="text-xs text-gray-400">
                                        {p.imagensProjeto?.length || 0} imagens
                                    </span>
                                    <span className="text-xs font-medium text-[#2D3AC2] opacity-0 group-hover:opacity-100 transition-opacity">
                                        Abrir →
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

// ─── Componente de ordenação de imagens (drag simples com botões) ──────────
function OrdenadorImagens({ imagens, onOrdemChange }) {
    function moverCima(index) {
        if (index === 0) return
        const nova = [...imagens]
        ;[nova[index - 1], nova[index]] = [nova[index], nova[index - 1]]
        onOrdemChange(nova)
    }

    function moverBaixo(index) {
        if (index === imagens.length - 1) return
        const nova = [...imagens]
        ;[nova[index], nova[index + 1]] = [nova[index + 1], nova[index]]
        onOrdemChange(nova)
    }

    if (imagens.length === 0) {
        return (
            <div className="border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center py-10">
                <p className="text-sm text-gray-400">
                    Nenhuma imagem enviada pelo projetista ainda.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {imagens.map((img, index) => (
                <div
                    key={img.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg p-2 border border-gray-100"
                >
                    {/* Número de ordem */}
                    <div className="w-7 h-7 bg-[#2D3AC2] text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                        {index + 1}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                        <img
                            src={`${API_URL}${img.url}`}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Nome do arquivo */}
                    <p className="flex-1 text-xs text-gray-500 truncate">{img.filename}</p>

                    {/* Botões de mover */}
                    <div className="flex flex-col gap-1 shrink-0">
                        <button
                            onClick={() => moverCima(index)}
                            disabled={index === 0}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30 transition-colors text-gray-500 text-xs"
                            title="Mover para cima"
                        >
                            ▲
                        </button>
                        <button
                            onClick={() => moverBaixo(index)}
                            disabled={index === imagens.length - 1}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30 transition-colors text-gray-500 text-xs"
                            title="Mover para baixo"
                        >
                            ▼
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Editor de memorial ────────────────────────────────────────────────────
function EditorMemorial({ projeto, memorialExistente, onSalvar, onCancelar }) {
    const [campos, setCampos] = useState(CAMPOS_INICIAIS)
    const [camposAtivos, setCamposAtivos] = useState(
        CAMPOS_CONFIG.map(c => c.key)
    )
    const [imagens, setImagens] = useState([])
    const [aba, setAba] = useState('conteudo') // 'conteudo' | 'imagens'
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState('')

    // Preenche os campos se estiver editando um memorial existente
    useEffect(() => {
        if (memorialExistente) {
            setCampos({
                piso:               memorialExistente.piso || '',
                estrutura:          memorialExistente.estrutura || '',
                areaAtendimento:    memorialExistente.areaAtendimento || '',
                audioVisual:        memorialExistente.audioVisual || '',
                comunicacaoVisual:  memorialExistente.comunicacaoVisual || '',
                eletrica:           memorialExistente.eletrica || '',
            })
            setCamposAtivos(JSON.parse(memorialExistente.camposAtivos || '[]'))

            // Ordem de imagens salva no memorial
            const ordemSalva = JSON.parse(memorialExistente.ordemImagens || '[]')
            const imagensDisponiveis = projeto.imagensProjeto || []

            if (ordemSalva.length > 0) {
                // Reconstrói a ordem baseado nos IDs salvos
                const ordenadas = ordemSalva
                    .map(id => imagensDisponiveis.find(img => img.id === id))
                    .filter(Boolean)
                // Adiciona imagens que não estavam na ordem salva no final
                const naoOrdenadas = imagensDisponiveis.filter(img => !ordemSalva.includes(img.id))
                setImagens([...ordenadas, ...naoOrdenadas])
            } else {
                setImagens(imagensDisponiveis)
            }
        } else {
            setImagens(projeto.imagensProjeto || [])
        }
    }, [memorialExistente, projeto])

    function toggleCampo(key) {
        setCamposAtivos(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        )
    }

    async function handleSalvar() {
        setSalvando(true)
        setErro('')
        try {
            const dados = {
                ...campos,
                camposAtivos,
                ordemImagens: imagens.map(img => img.id),
            }
            await onSalvar(dados)
        } catch (err) {
            setErro('Erro ao salvar: ' + err.message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <div className="flex flex-col gap-4">

            {/* Cabeçalho do editor */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-400 mb-0.5">
                        {memorialExistente ? `Editando V${memorialExistente.versao}` : 'Nova versão'}
                    </p>
                    <h3 className="text-sm font-bold text-gray-900">{projeto.nome}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {projeto.cliente} · {projeto.local} · {projeto.metragem}m² · {projeto.datas}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onCancelar}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={14} />
                        Cancelar
                    </button>
                    <button
                        onClick={handleSalvar}
                        disabled={salvando}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Save size={14} />
                        {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            {erro && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {erro}
                </div>
            )}

            {/* Abas */}
            <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1">
                {[
                    { id: 'conteudo', label: 'Conteúdo dos campos' },
                    { id: 'imagens', label: `Ordem das imagens (${imagens.length})` },
                ].map(aba_ => (
                    <button
                        key={aba_.id}
                        onClick={() => setAba(aba_.id)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
                            ${aba === aba_.id
                                ? 'bg-[#2D3AC2] text-white'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                    >
                        {aba_.label}
                    </button>
                ))}
            </div>

            {/* Aba: Conteúdo dos campos */}
            {aba === 'conteudo' && (
                <div className="flex flex-col gap-3">
                    {CAMPOS_CONFIG.map(({ key, label }) => {
                        const ativo = camposAtivos.includes(key)
                        return (
                            <div
                                key={key}
                                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all
                                    ${ativo ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}
                            >
                                {/* Cabeçalho do campo */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                                    <p className="text-sm font-semibold text-gray-700">{label}</p>
                                    <button
                                        onClick={() => toggleCampo(key)}
                                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors
                                            ${ativo
                                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                        title={ativo ? 'Ocultar no PDF' : 'Mostrar no PDF'}
                                    >
                                        {ativo ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                                        {ativo ? 'Incluir no PDF' : 'Oculto no PDF'}
                                    </button>
                                </div>

                                {/* Textarea do campo */}
                                <div className="px-5 py-3">
                                    <textarea
                                        value={campos[key]}
                                        onChange={e => setCampos(prev => ({ ...prev, [key]: e.target.value }))}
                                        disabled={!ativo}
                                        rows={4}
                                        placeholder={ativo ? `Descreva ${label.toLowerCase()}...` : 'Campo oculto no PDF'}
                                        className="w-full text-sm text-gray-700 outline-none resize-none disabled:text-gray-300 disabled:cursor-not-allowed placeholder:text-gray-300"
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Aba: Ordem das imagens */}
            {aba === 'imagens' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs text-gray-400 mb-4">
                        Use os botões ▲ ▼ para definir a ordem em que as imagens aparecem no PDF.
                    </p>
                    <OrdenadorImagens
                        imagens={imagens}
                        onOrdemChange={setImagens}
                    />
                </div>
            )}
        </div>
    )
}

// ─── Gerador de PDF ────────────────────────────────────────────────────────
async function gerarPDF(memorial, projeto) {
    // Importa jsPDF dinamicamente para não afetar o bundle principal
    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Constantes de layout
    const LARGURA = 297
    const ALTURA = 210
    const FUNDO = '#0D0D0D'
    const DOURADO = '#C9972E'
    const BRANCO = '#FFFFFF'

    // Fontes e helpers
    const centralizarTexto = (texto, y, tamanho, cor, negrito = false) => {
        doc.setFontSize(tamanho)
        doc.setTextColor(cor)
        doc.setFont('helvetica', negrito ? 'bold' : 'normal')
        doc.text(texto, LARGURA / 2, y, { align: 'center' })
    }

    const rodape = (pagina) => {
        doc.setFillColor(FUNDO)
        doc.rect(0, ALTURA - 12, LARGURA, 12, 'F')
        doc.setFontSize(7)
        doc.setTextColor(DOURADO)
        doc.setFont('helvetica', 'normal')
        const info = `Data do evento: ${projeto.datas || '—'} · Local: ${projeto.local || '—'}`
        doc.text(info, 10, ALTURA - 4)
        doc.text(`${pagina}`, LARGURA - 10, ALTURA - 4, { align: 'right' })
    }

    // ── PÁGINA 1: Capa ───────────────────────────────────────────────────
    doc.setFillColor(FUNDO)
    doc.rect(0, 0, LARGURA, ALTURA, 'F')

    // Logo centralizada
    try {
        const logoRes = await fetch('/logo.png')
        const logoBlob = await logoRes.blob()
        const logoBase64 = await new Promise(resolve => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(logoBlob)
        })
        const logoW = 60
        const logoH = 60
        doc.addImage(logoBase64, 'PNG', (LARGURA - logoW) / 2, (ALTURA - logoH) / 2 - 10, logoW, logoH)
    } catch (e) {
        // Se falhar ao carregar a logo, segue sem ela
        console.warn('Logo não carregada:', e)
    }

    rodape(1)

    // ── PÁGINA 2: Informações do evento ──────────────────────────────────
    doc.addPage()
    doc.setFillColor(FUNDO)
    doc.rect(0, 0, LARGURA, ALTURA, 'F')

    // Linha dourada vertical
    doc.setDrawColor(DOURADO)
    doc.setLineWidth(0.8)
    doc.line(LARGURA / 2, 20, LARGURA / 2, ALTURA - 15)

    // Texto lado esquerdo
    const linhaY = ALTURA - 50
    doc.setFontSize(11)
    doc.setTextColor(BRANCO)
    doc.setFont('helvetica', 'bold')
    doc.text('Evento:', 15, linhaY)
    doc.setFont('helvetica', 'normal')
    doc.text(projeto.feira || projeto.nome, 40, linhaY)

    doc.setFont('helvetica', 'bold')
    doc.text('Data do evento:', 15, linhaY + 9)
    doc.setFont('helvetica', 'normal')
    doc.text(projeto.datas || '—', 57, linhaY + 9)

    doc.setFont('helvetica', 'bold')
    doc.text('Local:', 15, linhaY + 18)
    doc.setFont('helvetica', 'normal')
    doc.text(projeto.local || '—', 33, linhaY + 18)

    doc.setFont('helvetica', 'bold')
    doc.text('Área do Stand:', 15, linhaY + 27)
    doc.setFont('helvetica', 'normal')
    doc.text(projeto.metragem ? `${projeto.metragem}m²` : '—', 53, linhaY + 27)

    // Logo lado direito
    try {
        const logoRes = await fetch('/logo.png')
        const logoBlob = await logoRes.blob()
        const logoBase64 = await new Promise(resolve => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(logoBlob)
        })
        doc.addImage(logoBase64, 'PNG', LARGURA / 2 + 30, 40, 70, 70)
    } catch (e) {}

    rodape(2)

    // ── PÁGINAS DE IMAGENS (uma por página) ──────────────────────────────
    const ordemImagens = JSON.parse(memorial.ordemImagens || '[]')
    const todasImagens = projeto.imagensProjeto || []

    // Reconstrói ordem
    const imagensOrdenadas = ordemImagens.length > 0
        ? ordemImagens.map(id => todasImagens.find(img => img.id === id)).filter(Boolean)
        : todasImagens

    let numeroPagina = 3
    for (const img of imagensOrdenadas) {
        doc.addPage()
        doc.setFillColor(FUNDO)
        doc.rect(0, 0, LARGURA, ALTURA, 'F')

        try {
            const imgRes = await fetch(`${API_URL}${img.url}`)
            const imgBlob = await imgRes.blob()
            const imgBase64 = await new Promise(resolve => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result)
                reader.readAsDataURL(imgBlob)
            })

            // Imagem ocupa quase a página inteira mantendo proporção
            const maxW = LARGURA - 20
            const maxH = ALTURA - 25
            doc.addImage(imgBase64, 'JPEG', 10, 5, maxW, maxH, undefined, 'FAST')
        } catch (e) {
            console.warn('Imagem não carregada:', img.url)
        }

        rodape(numeroPagina)
        numeroPagina++
    }

    // ── PÁGINAS DE MEMORIAL DESCRITIVO ───────────────────────────────────
    const camposAtivos = JSON.parse(memorial.camposAtivos || '[]')
    const camposParaImprimir = CAMPOS_CONFIG.filter(c => camposAtivos.includes(c.key))

    if (camposParaImprimir.length > 0) {
        doc.addPage()
        doc.setFillColor(FUNDO)
        doc.rect(0, 0, LARGURA, ALTURA, 'F')

        // Título
        doc.setFontSize(20)
        doc.setTextColor(DOURADO)
        doc.setFont('helvetica', 'bold')
        doc.text('MEMORIAL DESCRITIVO:', LARGURA - 15, 20, { align: 'right' })

        // Área do stand
        doc.setFontSize(12)
        doc.setTextColor(BRANCO)
        doc.setFont('helvetica', 'bold')
        doc.text(`ÁREA DO STAND: ${projeto.metragem ? projeto.metragem + 'm²' : '—'}`, 15, 20)

        let cursorY = 35
        let paginaDescritivo = numeroPagina

        for (const { key, label } of camposParaImprimir) {
            const conteudo = memorial[key] || ''
            if (!conteudo) continue

            // Verifica se precisa de nova página
            if (cursorY > ALTURA - 30) {
                rodape(paginaDescritivo)
                paginaDescritivo++
                doc.addPage()
                doc.setFillColor(FUNDO)
                doc.rect(0, 0, LARGURA, ALTURA, 'F')
                doc.setFontSize(20)
                doc.setTextColor(DOURADO)
                doc.setFont('helvetica', 'bold')
                doc.text('MEMORIAL DESCRITIVO:', LARGURA - 15, 20, { align: 'right' })
                cursorY = 35
            }

            // Título da seção
            doc.setFontSize(12)
            doc.setTextColor(DOURADO)
            doc.setFont('helvetica', 'bold')
            doc.text(`• ${label}`, 15, cursorY)
            cursorY += 7

            // Conteúdo — divide em linhas automaticamente
            doc.setFontSize(10)
            doc.setTextColor(BRANCO)
            doc.setFont('helvetica', 'normal')

            const linhas = doc.splitTextToSize(conteudo, LARGURA - 30)
            for (const linha of linhas) {
                if (cursorY > ALTURA - 25) {
                    rodape(paginaDescritivo)
                    paginaDescritivo++
                    doc.addPage()
                    doc.setFillColor(FUNDO)
                    doc.rect(0, 0, LARGURA, ALTURA, 'F')
                    doc.setFontSize(20)
                    doc.setTextColor(DOURADO)
                    doc.setFont('helvetica', 'bold')
                    doc.text('MEMORIAL DESCRITIVO:', LARGURA - 15, 20, { align: 'right' })
                    cursorY = 35
                    doc.setFontSize(10)
                    doc.setTextColor(BRANCO)
                    doc.setFont('helvetica', 'normal')
                }
                doc.text(`  ${linha}`, 15, cursorY)
                cursorY += 5
            }

            cursorY += 6
        }

        rodape(paginaDescritivo)
    }

    // Salva o PDF
    const nomeArquivo = `Memorial_${projeto.cliente}_V${memorial.versao}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`
    doc.save(nomeArquivo)
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default function Memorial() {
    const [usuario, setUsuario] = useState(null)
    const [projetos, setProjetos] = useState([])
    const [projetoSelecionado, setProjetoSelecionado] = useState(null)
    const [memoriais, setMemoriais] = useState([])
    const [memorialEditando, setMemorialEditando] = useState(null) // null = lista, objeto = editor
    const [modoEdicao, setModoEdicao] = useState(false)  // true = editor aberto
    const [carregando, setCarregando] = useState(true)
    const [carregandoMemoriais, setCarregandoMemoriais] = useState(false)
    const [gerandoPDF, setGerandoPDF] = useState(false)
    const [erro, setErro] = useState('')
    const navigate = useNavigate()

    // ─── Carrega dados iniciais ──────────────────────────────────────────
    useEffect(() => {
        async function iniciar() {
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)

            const lista = await api.getProjetos()
            if (Array.isArray(lista)) setProjetos(lista)
            setCarregando(false)
        }
        iniciar()
    }, [])

    // ─── Seleciona projeto e carrega os memoriais dele ───────────────────
    async function handleSelecionarProjeto(projeto) {
        setProjetoSelecionado(projeto)
        setCarregandoMemoriais(true)
        setModoEdicao(false)
        setMemorialEditando(null)
        setErro('')

        try {
            const lista = await api.getMemoriais(projeto.id)
            setMemoriais(Array.isArray(lista) ? lista : [])
        } catch {
            setMemoriais([])
        } finally {
            setCarregandoMemoriais(false)
        }
    }

    // ─── Abre editor para novo memorial ──────────────────────────────────
    function handleNovoMemorial() {
        setMemorialEditando(null)
        setModoEdicao(true)
    }

    // ─── Abre editor para editar memorial existente ───────────────────────
    function handleEditarMemorial(memorial) {
        setMemorialEditando(memorial)
        setModoEdicao(true)
    }

    // ─── Salva memorial (cria novo ou atualiza existente) ─────────────────
    async function handleSalvar(dados) {
        if (memorialEditando) {
            await api.atualizarMemorial(memorialEditando.id, dados)
        } else {
            await api.criarMemorial(projetoSelecionado.id, dados)
        }

        // Recarrega a lista de memoriais
        const lista = await api.getMemoriais(projetoSelecionado.id)
        setMemoriais(Array.isArray(lista) ? lista : [])
        setModoEdicao(false)
        setMemorialEditando(null)
    }

    // ─── Deletar memorial ─────────────────────────────────────────────────
    async function handleDeletar(memorialId) {
        if (!confirm('Tem certeza que deseja deletar este memorial?')) return
        try {
            await api.deletarMemorial(memorialId)
            setMemoriais(prev => prev.filter(m => m.id !== memorialId))
        } catch {
            setErro('Erro ao deletar memorial.')
        }
    }

    // ─── Gerar PDF ────────────────────────────────────────────────────────
    async function handleGerarPDF(memorial) {
        setGerandoPDF(true)
        setErro('')
        try {
            // Mescla as informações do projeto atualizadas
            const projetoCompleto = {
                ...projetoSelecionado,
                // Garante que as imagens do projeto vêm com as do memorial
                imagensProjeto: projetoSelecionado.imagensProjeto || [],
                feira: projetoSelecionado.feira || projetoSelecionado.nome,
            }
            await gerarPDF(memorial, projetoCompleto)
        } catch (err) {
            setErro('Erro ao gerar PDF: ' + err.message)
        } finally {
            setGerandoPDF(false)
        }
    }

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
                <header className="bg-[#2D3AC2] text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Breadcrumb */}
                        {projetoSelecionado && (
                            <button
                                onClick={() => {
                                    setProjetoSelecionado(null)
                                    setModoEdicao(false)
                                    setMemorialEditando(null)
                                }}
                                className="text-blue-200 hover:text-white transition-colors"
                                title="Voltar para seleção"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-bold">Memorial</h2>
                            <p className="text-blue-200 text-sm mt-0.5">
                                {!projetoSelecionado && 'Selecione um projeto'}
                                {projetoSelecionado && !modoEdicao && projetoSelecionado.nome}
                                {projetoSelecionado && modoEdicao && (memorialEditando ? `Editando V${memorialEditando.versao}` : 'Novo memorial')}
                            </p>
                        </div>
                    </div>

                    {/* Botão novo memorial */}
                    {projetoSelecionado && !modoEdicao && (
                        <button
                            onClick={handleNovoMemorial}
                            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                            <Plus size={16} />
                            Nova versão
                        </button>
                    )}
                </header>

                <main className="flex-1 p-6 overflow-y-auto">

                    {erro && (
                        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {erro}
                        </div>
                    )}

                    {/* Tela 1: Seleção de projeto */}
                    {!projetoSelecionado && (
                        <TelaSelecao
                            projetos={projetos}
                            onSelecionar={handleSelecionarProjeto}
                        />
                    )}

                    {/* Tela 2: Lista de versões do memorial */}
                    {projetoSelecionado && !modoEdicao && (
                        <div className="flex flex-col gap-4">

                            {carregandoMemoriais ? (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-16">
                                    <p className="text-sm text-gray-400">Carregando memoriais...</p>
                                </div>
                            ) : memoriais.length === 0 ? (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
                                    <FileText size={32} className="text-gray-300" />
                                    <p className="text-sm text-gray-400">Nenhum memorial criado ainda.</p>
                                    <button
                                        onClick={handleNovoMemorial}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#2D3AC2] hover:bg-[#232fa8] text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        <Plus size={14} />
                                        Criar primeiro memorial
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                                        <p className="text-sm font-semibold text-gray-700">
                                            Versões do memorial — {projetoSelecionado.nome}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {memoriais.length} {memoriais.length === 1 ? 'versão' : 'versões'} criadas
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        {memoriais.map(memorial => {
                                            const camposAtivos = JSON.parse(memorial.camposAtivos || '[]')
                                            const ordemImagens = JSON.parse(memorial.ordemImagens || '[]')
                                            const dataFormatada = new Date(memorial.criadoEm).toLocaleDateString('pt-BR')

                                            return (
                                                <div key={memorial.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm font-bold text-[#2D3AC2]">
                                                                    Versão {memorial.versao}
                                                                </span>
                                                                <span className="text-xs text-gray-400">
                                                                    · Criado em {dataFormatada}
                                                                </span>
                                                                {memorial.criadoPor && (
                                                                    <span className="text-xs text-gray-400">
                                                                        por {memorial.criadoPor.name}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Chips dos campos ativos */}
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {CAMPOS_CONFIG.map(({ key, label }) => (
                                                                    <span
                                                                        key={key}
                                                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                                                            camposAtivos.includes(key)
                                                                                ? 'bg-green-50 text-green-700'
                                                                                : 'bg-gray-100 text-gray-400 line-through'
                                                                        }`}
                                                                    >
                                                                        {label.split(' - ')[0]}
                                                                    </span>
                                                                ))}
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                                                    {ordemImagens.length || projetoSelecionado.imagensProjeto?.length || 0} imagens
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Ações */}
                                                        <div className="flex items-center gap-2 shrink-0 ml-4">
                                                            <button
                                                                onClick={() => handleEditarMemorial(memorial)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                                            >
                                                                <Eye size={13} />
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={() => handleGerarPDF(memorial)}
                                                                disabled={gerandoPDF}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                <Download size={13} />
                                                                {gerandoPDF ? 'Gerando...' : 'Gerar PDF'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeletar(memorial.id)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Tela 3: Editor de memorial */}
                    {projetoSelecionado && modoEdicao && (
                        <EditorMemorial
                            projeto={projetoSelecionado}
                            memorialExistente={memorialEditando}
                            onSalvar={handleSalvar}
                            onCancelar={() => {
                                setModoEdicao(false)
                                setMemorialEditando(null)
                            }}
                        />
                    )}
                </main>
            </div>
        </div>
    )
}
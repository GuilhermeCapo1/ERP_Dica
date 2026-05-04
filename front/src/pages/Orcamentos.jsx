import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Trash2, ArrowLeft, Save, Download,
    Send, X, FileText, ChevronDown
} from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ─── Cálculo de impostos ───────────────────────────────────────────────────
// subtotal = x
// total_nf = x / 90 * 100
// imposto  = total_nf - x
function calcularTotais(itens) {
    const subtotal = itens.reduce((acc, item) => {
        return acc + (parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || 0)
    }, 0)
    const totalNF = subtotal / 90 * 100
    const imposto = totalNF - subtotal
    return { subtotal, totalNF, imposto, recibo: subtotal }
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Tela de seleção de projeto ────────────────────────────────────────────
function TelaSelecao({ projetos, onSelecionar }) {
    const [busca, setBusca] = useState('')
    const filtrados = projetos.filter(p =>
        p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        p.cliente?.toLowerCase().includes(busca.toLowerCase())
    )

    const STATUS_CORES = {
        'Precificação': 'bg-yellow-50 text-yellow-700',
        'Enviado':      'bg-cyan-50 text-cyan-700',
        'Aprovado':     'bg-green-50 text-green-700',
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Selecione um projeto para criar ou editar o orçamento
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
                ) : filtrados.map(p => {
                    const cor = STATUS_CORES[p.status] || 'bg-gray-100 text-gray-500'
                    return (
                        <button
                            key={p.id}
                            onClick={() => onSelecionar(p)}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-left hover:border-[#2D3AC2]/30 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{p.nome}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                                        {p.cliente}{p.local && ` · ${p.local}`}{p.metragem && ` · ${p.metragem}m²`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cor}`}>
                                        {p.status}
                                    </span>
                                    <span className="text-xs text-[#2D3AC2] opacity-0 group-hover:opacity-100 transition-opacity">
                                        Abrir →
                                    </span>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Editor de orçamento ───────────────────────────────────────────────────
function EditorOrcamento({ projeto, memorial, orcamentoExistente, onSalvar, onCancelar }) {
    const [itens, setItens] = useState([])
    const [formaPagamento, setFormaPagamento] = useState('')
    const [vencimentos, setVencimentos] = useState('')
    const [cidade, setCidade] = useState('São Paulo')
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState('')

    // Preenche com dados existentes ou cria item padrão de montagem
    useEffect(() => {
        if (orcamentoExistente) {
            setItens(JSON.parse(orcamentoExistente.itens || '[]'))
            setFormaPagamento(orcamentoExistente.formaPagamento || '')
            setVencimentos(orcamentoExistente.vencimentos || '')
            setCidade(orcamentoExistente.cidade || 'São Paulo')
        } else {
            // Item padrão sempre presente: montagem e desmontagem, ART
            setItens([{
                id: Date.now(),
                descricao: 'Incluindo: Montagem e desmontagem, ART',
                quantidade: projeto.metragem || 1,
                valorUnitario: 0,
            }])
        }
    }, [orcamentoExistente, projeto])

    function adicionarItem() {
        setItens(prev => [...prev, {
            id: Date.now(),
            descricao: '',
            quantidade: 1,
            valorUnitario: 0,
        }])
    }

    function atualizarItem(id, campo, valor) {
        setItens(prev => prev.map(item =>
            item.id === id ? { ...item, [campo]: valor } : item
        ))
    }

    function removerItem(id) {
        // Não permite remover o primeiro item (montagem/ART)
        setItens(prev => {
            if (prev.findIndex(i => i.id === id) === 0) return prev
            return prev.filter(item => item.id !== id)
        })
    }

    const { subtotal, totalNF, imposto, recibo } = calcularTotais(itens)

    async function handleSalvar() {
        setSalvando(true)
        setErro('')
        try {
            // Remove o campo id temporário antes de salvar
            const itensSemId = itens.map(({ id, ...resto }) => resto)
            await onSalvar({ itens: itensSemId, formaPagamento, vencimentos, cidade })
        } catch (err) {
            setErro('Erro ao salvar: ' + err.message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <div className="flex flex-col gap-4">

            {/* Cabeçalho */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-400 mb-0.5">
                        {orcamentoExistente ? `Editando V${orcamentoExistente.versao}` : 'Novo orçamento'} · Memorial V{memorial.versao}
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
                        <X size={14} /> Cancelar
                    </button>
                    <button
                        onClick={handleSalvar}
                        disabled={salvando}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            {erro && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{erro}</div>
            )}

            {/* Tabela de itens */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Itens do orçamento</p>
                    <button
                        onClick={adicionarItem}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors"
                    >
                        <Plus size={12} /> Adicionar item
                    </button>
                </div>

                {/* Cabeçalho da tabela */}
                <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <div className="col-span-6">Descrição</div>
                    <div className="col-span-2 text-center">Quant.</div>
                    <div className="col-span-2 text-right">Valor unit.</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1"></div>
                </div>

                <div className="divide-y divide-gray-50">
                    {itens.map((item, index) => {
                        const total = (parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || 0)
                        const isPrimeiro = index === 0
                        return (
                            <div key={item.id} className={`grid grid-cols-12 gap-2 px-5 py-3 items-center ${isPrimeiro ? 'bg-blue-50/30' : ''}`}>
                                <div className="col-span-6">
                                    <input
                                        value={item.descricao}
                                        onChange={e => atualizarItem(item.id, 'descricao', e.target.value)}
                                        placeholder="Descrição do item"
                                        className="w-full text-sm text-gray-700 bg-transparent outline-none border-b border-transparent focus:border-[#2D3AC2] transition-colors py-0.5"
                                    />
                                    {isPrimeiro && (
                                        <p className="text-xs text-blue-500 mt-0.5">Item padrão — sempre incluído</p>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="number"
                                        value={item.quantidade}
                                        onChange={e => atualizarItem(item.id, 'quantidade', e.target.value)}
                                        className="w-full text-sm text-center text-gray-700 bg-transparent outline-none border-b border-transparent focus:border-[#2D3AC2] transition-colors py-0.5"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="number"
                                        value={item.valorUnitario}
                                        onChange={e => atualizarItem(item.id, 'valorUnitario', e.target.value)}
                                        className="w-full text-sm text-right text-gray-700 bg-transparent outline-none border-b border-transparent focus:border-[#2D3AC2] transition-colors py-0.5"
                                    />
                                </div>
                                <div className="col-span-1 text-right text-sm font-medium text-gray-700">
                                    {formatarMoeda(total)}
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    {!isPrimeiro && (
                                        <button
                                            onClick={() => removerItem(item.id)}
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Totais */}
                <div className="border-t border-gray-200 px-5 py-4 bg-gray-50">
                    <div className="flex flex-col gap-1.5 ml-auto w-72">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Sub-total</span>
                            <span className="font-medium">{formatarMoeda(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Impostos sobre nota fiscal</span>
                            <span className="font-medium">{formatarMoeda(imposto)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-300 pt-1.5 mt-1">
                            <span>Total</span>
                            <span>{formatarMoeda(totalNF)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 border-t border-gray-200 pt-1.5 mt-1">
                            <span>Opção com Recibo de Locação</span>
                            <span className="font-medium">{formatarMoeda(recibo)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Condições comerciais */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-4">Condições comerciais</p>
                <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-500">Forma de pagamento</label>
                        <input
                            value={formaPagamento}
                            onChange={e => setFormaPagamento(e.target.value)}
                            placeholder="Ex: a combinar"
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-500">Vencimentos</label>
                        <input
                            value={vencimentos}
                            onChange={e => setVencimentos(e.target.value)}
                            placeholder="Ex: 30/60/90 dias"
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-500">Cidade</label>
                        <input
                            value={cidade}
                            onChange={e => setCidade(e.target.value)}
                            placeholder="São Paulo"
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3AC2] focus:ring-2 focus:ring-[#2D3AC2]/20 transition"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Gerador de PDF do orçamento ───────────────────────────────────────────
async function gerarPDFOrcamento(orcamento, projeto, memorial) {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const LARGURA = 297
    const ALTURA = 210
    const FUNDO = '#0D0D0D'
    const DOURADO = '#C9972E'
    const BRANCO = '#FFFFFF'
    const CINZA = '#888888'

    const rodape = (pagina) => {
        doc.setFillColor(FUNDO)
        doc.rect(0, ALTURA - 12, LARGURA, 12, 'F')
        doc.setFontSize(7)
        doc.setTextColor(DOURADO)
        doc.setFont('helvetica', 'normal')
        doc.text(`Data do evento: ${projeto.datas || '—'} · Local: ${projeto.local || '—'}`, 10, ALTURA - 4)
        doc.text(`${pagina}`, LARGURA - 10, ALTURA - 4, { align: 'right' })
    }

    // Carrega logo
    let logoBase64 = null
    try {
        const logoRes = await fetch('/logo.png')
        const logoBlob = await logoRes.blob()
        logoBase64 = await new Promise(resolve => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(logoBlob)
        })
    } catch {}

    // ── PÁGINA 1: Capa ────────────────────────────────────────────────────
    doc.setFillColor(FUNDO)
    doc.rect(0, 0, LARGURA, ALTURA, 'F')
    if (logoBase64) doc.addImage(logoBase64, 'PNG', (LARGURA - 60) / 2, (ALTURA - 60) / 2 - 10, 60, 60)
    rodape(1)

    // ── PÁGINA 2: Informações do evento ───────────────────────────────────
    doc.addPage()
    doc.setFillColor(FUNDO)
    doc.rect(0, 0, LARGURA, ALTURA, 'F')
    doc.setDrawColor(DOURADO)
    doc.setLineWidth(0.8)
    doc.line(LARGURA / 2, 20, LARGURA / 2, ALTURA - 15)

    const linhaY = ALTURA - 50
    const textos = [
        { label: 'Evento:', valor: projeto.feira || projeto.nome, x: 15 },
        { label: 'Data do evento:', valor: projeto.datas || '—', x: 15 },
        { label: 'Local:', valor: projeto.local || '—', x: 15 },
    ]
    const labelWidths = [22, 38, 18]
    textos.forEach(({ label, valor, x }, i) => {
        doc.setFontSize(11)
        doc.setTextColor(BRANCO)
        doc.setFont('helvetica', 'bold')
        doc.text(label, x, linhaY + i * 9)
        doc.setFont('helvetica', 'normal')
        doc.text(valor, x + labelWidths[i], linhaY + i * 9)
    })

    if (logoBase64) doc.addImage(logoBase64, 'PNG', LARGURA / 2 + 30, 40, 70, 70)
    rodape(2)

    // ── PÁGINA 3: Carta de apresentação ───────────────────────────────────
    doc.addPage()
    doc.setFillColor(FUNDO)
    doc.rect(0, 0, LARGURA, ALTURA, 'F')

    const textoApresentacao = [
        'É com grande satisfação que apresentamos o orçamento para a',
        'realização de seu evento.',
        'DiCa Soluções agradece a oportunidade em participar de sua',
        'cotação.',
        '',
        'Informamos que uma vez acordado entre as partes e assinado, esse',
        'orçamento passa a ter validade de Contrato de Prestações de',
        'Serviços.',
    ]
    doc.setFontSize(13)
    doc.setTextColor(DOURADO)
    doc.setFont('helvetica', 'bold')
    let yApres = 70
    textoApresentacao.forEach(linha => {
        doc.text(linha, 30, yApres)
        yApres += linha === '' ? 8 : 10
    })
    if (logoBase64) doc.addImage(logoBase64, 'PNG', LARGURA - 55, ALTURA - 55, 40, 40)
    rodape(3)

    // ── PÁGINAS DE IMAGENS DO MEMORIAL ────────────────────────────────────
    const ordemImagens = JSON.parse(memorial.ordemImagens || '[]')
    const todasImagens = projeto.imagensProjeto || []
    const imagensOrdenadas = ordemImagens.length > 0
        ? ordemImagens.map(id => todasImagens.find(img => img.id === id)).filter(Boolean)
        : todasImagens

    let numeroPagina = 4
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
            doc.addImage(imgBase64, 'JPEG', 10, 5, LARGURA - 20, ALTURA - 25, undefined, 'FAST')
        } catch {}
        rodape(numeroPagina)
        numeroPagina++
    }

    // ── PÁGINA: MEMORIAL DESCRITIVO ───────────────────────────────────────
    const CAMPOS_CONFIG = [
        { key: 'piso', label: '01 - PISO' },
        { key: 'estrutura', label: '02 - ESTRUTURA' },
        { key: 'areaAtendimento', label: '03 - Área de Atendimento' },
        { key: 'audioVisual', label: '04 - Áudio Visual' },
        { key: 'comunicacaoVisual', label: '05 - Comunicação Visual' },
        { key: 'eletrica', label: '06 - Elétrica' },
    ]
    const camposAtivos = JSON.parse(memorial.camposAtivos || '[]')
    const camposParaImprimir = CAMPOS_CONFIG.filter(c => camposAtivos.includes(c.key))

    if (camposParaImprimir.length > 0) {
        doc.addPage()
        doc.setFillColor(FUNDO)
        doc.rect(0, 0, LARGURA, ALTURA, 'F')
        doc.setFontSize(20)
        doc.setTextColor(DOURADO)
        doc.setFont('helvetica', 'bold')
        doc.text('MEMORIAL DESCRITIVO:', LARGURA - 15, 20, { align: 'right' })
        doc.setFontSize(12)
        doc.setTextColor(BRANCO)
        doc.setFont('helvetica', 'bold')
        doc.text(`ÁREA DO STAND: ${projeto.metragem ? projeto.metragem + 'm²' : '—'}`, 15, 20)

        let cursorY = 35
        let paginaDesc = numeroPagina

        for (const { key, label } of camposParaImprimir) {
            const conteudo = memorial[key] || ''
            if (!conteudo) continue
            if (cursorY > ALTURA - 30) {
                rodape(paginaDesc++)
                doc.addPage()
                doc.setFillColor(FUNDO)
                doc.rect(0, 0, LARGURA, ALTURA, 'F')
                doc.setFontSize(20)
                doc.setTextColor(DOURADO)
                doc.setFont('helvetica', 'bold')
                doc.text('MEMORIAL DESCRITIVO:', LARGURA - 15, 20, { align: 'right' })
                cursorY = 35
            }
            doc.setFontSize(12)
            doc.setTextColor(DOURADO)
            doc.setFont('helvetica', 'bold')
            doc.text(`• ${label}`, 15, cursorY)
            cursorY += 7
            doc.setFontSize(10)
            doc.setTextColor(BRANCO)
            doc.setFont('helvetica', 'normal')
            const linhas = doc.splitTextToSize(conteudo, LARGURA - 30)
            for (const linha of linhas) {
                if (cursorY > ALTURA - 25) {
                    rodape(paginaDesc++)
                    doc.addPage()
                    doc.setFillColor(FUNDO)
                    doc.rect(0, 0, LARGURA, ALTURA, 'F')
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
        rodape(paginaDesc)
        numeroPagina = paginaDesc + 1
    }

    // ── PÁGINA: PROPOSTA COMERCIAL ────────────────────────────────────────
    doc.addPage()
    doc.setFillColor('#FFFFFF')
    doc.rect(0, 0, LARGURA, ALTURA, 'F')

    // Margens e largura útil
    const MARGEM  = 12
    const LARGURA_UTIL = LARGURA - MARGEM * 2  // 297 - 24 = 273mm

    // Cabeçalho branco com logo
    if (logoBase64) doc.addImage(logoBase64, 'PNG', LARGURA - MARGEM - 45, 6, 40, 40)

    doc.setFontSize(10)
    doc.setTextColor('#222222')
    doc.setFont('helvetica', 'bold')
    doc.text(`Evento: ${projeto.feira || projeto.nome}`, MARGEM, 16)
    doc.text(`Datas: ${projeto.datas || '—'}`, MARGEM, 23)
    doc.text(`Local: ${projeto.local || '—'}`, MARGEM, 30)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`Proposta Comercial para ${projeto.cliente}`, MARGEM, 48)

    // ── Definição das colunas ─────────────────────────────────────────────
    // Total da linha = 273mm
    // desc=145 | quant=30 | valor=45 | total=53 → soma=273
    const COL = {
        desc:  { x: MARGEM,       w: 145 },
        quant: { x: MARGEM + 145, w: 30  },
        valor: { x: MARGEM + 175, w: 45  },
        total: { x: MARGEM + 220, w: 53  },
    }

    // Cabeçalho da tabela
    const yHeader = 53
    doc.setFillColor('#222222')
    doc.rect(MARGEM, yHeader, LARGURA_UTIL, 8, 'F')
    doc.setFontSize(7.5)
    doc.setTextColor('#FFFFFF')
    doc.setFont('helvetica', 'bold')
    doc.text('DESCRIÇÃO',   COL.desc.x  + 2,                      yHeader + 5.5)
    doc.text('QUANT.',      COL.quant.x + COL.quant.w / 2,        yHeader + 5.5, { align: 'center' })
    doc.text('VALOR UNIT.', COL.valor.x + COL.valor.w - 2,        yHeader + 5.5, { align: 'right' })
    doc.text('VALOR TOTAL', COL.total.x + COL.total.w - 2,        yHeader + 5.5, { align: 'right' })

    const itens = JSON.parse(orcamento.itens || '[]')
    const { subtotal, totalNF, imposto, recibo } = calcularTotais(
        itens.map(i => ({ ...i, id: 0 }))
    )

    // ── Helper: nova página da proposta ──────────────────────────────────
    let paginaProposta = numeroPagina
    function novaSecao() {
        rodape(paginaProposta++)
        doc.addPage()
        doc.setFillColor('#FFFFFF')
        doc.rect(0, 0, LARGURA, ALTURA, 'F')
        // Recria cabeçalho da tabela na nova página
        doc.setFillColor('#222222')
        doc.rect(MARGEM, 10, LARGURA_UTIL, 8, 'F')
        doc.setFontSize(7.5)
        doc.setTextColor('#FFFFFF')
        doc.setFont('helvetica', 'bold')
        doc.text('DESCRIÇÃO',   COL.desc.x  + 2,               15.5)
        doc.text('QUANT.',      COL.quant.x + COL.quant.w / 2, 15.5, { align: 'center' })
        doc.text('VALOR UNIT.', COL.valor.x + COL.valor.w - 2, 15.5, { align: 'right' })
        doc.text('VALOR TOTAL', COL.total.x + COL.total.w - 2, 15.5, { align: 'right' })
        return 22 // y inicial após o cabeçalho
    }

    // Subtítulo do grupo
    let yTabela = yHeader + 12
    doc.setFillColor('#F5F0E8')
    doc.rect(MARGEM, yTabela - 4, LARGURA_UTIL, 7, 'F')
    doc.setFontSize(8)
    doc.setTextColor('#222222')
    doc.setFont('helvetica', 'bold')
    doc.text(`Stand ${projeto.metragem || ''}m²`, COL.desc.x + 2, yTabela)
    yTabela += 7

    doc.setFont('helvetica', 'bold')
    doc.text('01. Construção', COL.desc.x + 2, yTabela)
    yTabela += 7

    // ── Itens com quebra de página automática ─────────────────────────────
    // Reserva 40mm no final para os totais
    const Y_LIMITE = ALTURA - 45

    itens.forEach((item, i) => {
        // Calcula quantas linhas a descrição vai ocupar
        doc.setFontSize(7.5)
        const linhasDesc = doc.splitTextToSize(item.descricao || '', COL.desc.w - 4)
        const alturaLinha = linhasDesc.length * 5 + 3

        // Quebra de página se não couber
        if (yTabela + alturaLinha > Y_LIMITE) {
            yTabela = novaSecao()
        }

        const totalItem = (parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || 0)
        const bg = i % 2 === 0 ? '#FFFFFF' : '#F9F9F9'
        doc.setFillColor(bg)
        doc.rect(MARGEM, yTabela - 4, LARGURA_UTIL, alturaLinha, 'F')

        doc.setFontSize(7.5)
        doc.setTextColor('#333333')
        doc.setFont('helvetica', 'normal')

        // Descrição pode ter múltiplas linhas
        linhasDesc.forEach((linha, li) => {
            doc.text(linha, COL.desc.x + 2, yTabela + li * 5)
        })

        // Quantidade, valor e total sempre alinhados com a primeira linha
        doc.text(
            String(item.quantidade || ''),
            COL.quant.x + COL.quant.w / 2,
            yTabela,
            { align: 'center' }
        )
        doc.text(
            formatarMoeda(parseFloat(item.valorUnitario) || 0),
            COL.valor.x + COL.valor.w - 2,
            yTabela,
            { align: 'right' }
        )
        doc.text(
            formatarMoeda(totalItem),
            COL.total.x + COL.total.w - 2,
            yTabela,
            { align: 'right' }
        )

        yTabela += alturaLinha
    })

    // ── Totais — quebra de página se não couber ───────────────────────────
    // Os totais precisam de ~40mm (4 linhas de 9mm + recibo + espaços)
    if (yTabela + 40 > ALTURA - 15) {
        yTabela = novaSecao()
    }

    yTabela += 3
    // Bloco de totais — altura fixa de 24mm (3 linhas de 8mm cada)
    doc.setFillColor('#222222')
    doc.rect(MARGEM, yTabela - 4, LARGURA_UTIL, 26, 'F')
    doc.setFontSize(8)
    doc.setTextColor('#FFFFFF')
    doc.setFont('helvetica', 'bold')

    // Alinha labels à esquerda do bloco de total e valores à direita
    const xLabelTotal = COL.total.x - 3
    const xValorTotal = COL.total.x + COL.total.w - 2

    doc.text('SUB-TOTAL',                  xLabelTotal, yTabela,      { align: 'right' })
    doc.text(formatarMoeda(subtotal),      xValorTotal, yTabela,      { align: 'right' })
    yTabela += 8
    doc.text('IMPOSTOS SOBRE NOTA FISCAL', xLabelTotal, yTabela,      { align: 'right' })
    doc.text(formatarMoeda(imposto),       xValorTotal, yTabela,      { align: 'right' })
    yTabela += 8
    doc.text('TOTAL',                      xLabelTotal, yTabela,      { align: 'right' })
    doc.text(formatarMoeda(totalNF),       xValorTotal, yTabela,      { align: 'right' })

    yTabela += 12
    doc.setFillColor('#222222')
    doc.rect(MARGEM, yTabela - 4, LARGURA_UTIL, 9, 'F')
    doc.setFontSize(8)
    doc.setTextColor('#FFFFFF')
    doc.setFont('helvetica', 'bold')
    doc.text('OPÇÃO COM RECIBO DE LOCAÇÃO', xLabelTotal, yTabela, { align: 'right' })
    doc.text(formatarMoeda(recibo),         xValorTotal, yTabela, { align: 'right' })

    yTabela += 14
    doc.setTextColor('#222222')
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text(`Forma de pagamento: ${orcamento.formaPagamento || 'a combinar'}`, MARGEM, yTabela)
    yTabela += 7
    doc.text(`Vencimentos: ${orcamento.vencimentos || 'a combinar'}`, MARGEM, yTabela)
    yTabela += 8
    const dataOrc = new Date(orcamento.dataOrcamento || Date.now()).toLocaleDateString('pt-BR')
    doc.setFont('helvetica', 'normal')
    doc.text(`${orcamento.cidade || 'São Paulo'}, ${dataOrc}`, MARGEM, yTabela)

    if (logoBase64) doc.addImage(logoBase64, 'PNG', LARGURA - MARGEM - 32, ALTURA - 42, 28, 28)

    // Rodapé dourado na proposta
    doc.setFillColor(DOURADO)
    doc.rect(0, ALTURA - 12, LARGURA, 12, 'F')
    doc.setFontSize(7)
    doc.setTextColor('#000000')
    doc.text(`Data do evento: ${projeto.datas || '—'} · Local: ${projeto.local || '—'}`, MARGEM, ALTURA - 4)

    const nomeArquivo = `Proposta_${projeto.cliente}_V${orcamento.versao}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`
    doc.save(nomeArquivo)
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default function Orcamentos() {
    const [usuario, setUsuario] = useState(null)
    const [projetos, setProjetos] = useState([])
    const [projetoSelecionado, setProjetoSelecionado] = useState(null)
    const [memoriais, setMemoriais] = useState([])
    const [memorialSelecionado, setMemorialSelecionado] = useState(null)
    const [orcamentos, setOrcamentos] = useState([])
    const [orcamentoEditando, setOrcamentoEditando] = useState(null)
    const [modoEdicao, setModoEdicao] = useState(false)
    const [carregando, setCarregando] = useState(true)
    const [carregandoDados, setCarregandoDados] = useState(false)
    const [gerandoPDF, setGerandoPDF] = useState(false)
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState('')
    const navigate = useNavigate()

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

    async function handleSelecionarProjeto(projeto) {
        setProjetoSelecionado(projeto)
        setMemorialSelecionado(null)
        setOrcamentos([])
        setModoEdicao(false)
        setOrcamentoEditando(null)
        setErro('')
        setCarregandoDados(true)
        try {
            const lista = await api.getMemoriais(projeto.id)
            setMemoriais(Array.isArray(lista) ? lista : [])
        } finally {
            setCarregandoDados(false)
        }
    }

    async function handleSelecionarMemorial(memorial) {
        setMemorialSelecionado(memorial)
        setModoEdicao(false)
        setOrcamentoEditando(null)
        setErro('')
        setCarregandoDados(true)
        try {
            const lista = await api.getOrcamentos(projetoSelecionado.id)
            // Filtra apenas orçamentos deste memorial
            const doMemorial = Array.isArray(lista) ? lista.filter(o => o.memorialId === memorial.id) : []
            setOrcamentos(doMemorial)
        } finally {
            setCarregandoDados(false)
        }
    }

    async function handleSalvar(dados) {
        if (orcamentoEditando) {
            await api.atualizarOrcamento(orcamentoEditando.id, dados)
        } else {
            await api.criarOrcamento(projetoSelecionado.id, {
                ...dados,
                memorialId: memorialSelecionado.id
            })
        }
        const lista = await api.getOrcamentos(projetoSelecionado.id)
        setOrcamentos(Array.isArray(lista) ? lista.filter(o => o.memorialId === memorialSelecionado.id) : [])
        setModoEdicao(false)
        setOrcamentoEditando(null)
    }

    async function handleEnviar(orcamentoId) {
        if (!confirm('Ao marcar como enviado, o projeto passará para o status "Enviado". Confirmar?')) return
        setEnviando(true)
        try {
            await api.enviarOrcamento(orcamentoId)
            const lista = await api.getOrcamentos(projetoSelecionado.id)
            setOrcamentos(Array.isArray(lista) ? lista.filter(o => o.memorialId === memorialSelecionado.id) : [])
            // Atualiza status local do projeto
            setProjetos(prev => prev.map(p =>
                p.id === projetoSelecionado.id ? { ...p, status: 'Enviado' } : p
            ))
        } catch (err) {
            setErro('Erro ao enviar: ' + err.message)
        } finally {
            setEnviando(false)
        }
    }

    async function handleDeletar(orcamentoId) {
        if (!confirm('Tem certeza que deseja deletar este orçamento?')) return
        try {
            await api.deletarOrcamento(orcamentoId)
            setOrcamentos(prev => prev.filter(o => o.id !== orcamentoId))
        } catch {
            setErro('Erro ao deletar orçamento.')
        }
    }

    async function handleGerarPDF(orcamento) {
        setGerandoPDF(true)
        setErro('')
        try {
            const projetoCompleto = {
                ...projetoSelecionado,
                imagensProjeto: projetoSelecionado.imagensProjeto || [],
                feira: projetoSelecionado.feira || projetoSelecionado.nome,
            }
            await gerarPDFOrcamento(orcamento, projetoCompleto, memorialSelecionado)
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
                        {projetoSelecionado && (
                            <button
                                onClick={() => {
                                    if (modoEdicao) { setModoEdicao(false); return }
                                    if (memorialSelecionado) { setMemorialSelecionado(null); return }
                                    setProjetoSelecionado(null)
                                }}
                                className="text-blue-200 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-bold">Orçamentos</h2>
                            <p className="text-blue-200 text-sm mt-0.5">
                                {!projetoSelecionado && 'Selecione um projeto'}
                                {projetoSelecionado && !memorialSelecionado && projetoSelecionado.nome}
                                {projetoSelecionado && memorialSelecionado && !modoEdicao && `${projetoSelecionado.nome} · Memorial V${memorialSelecionado.versao}`}
                                {modoEdicao && (orcamentoEditando ? `Editando orçamento V${orcamentoEditando.versao}` : 'Novo orçamento')}
                            </p>
                        </div>
                    </div>
                    {projetoSelecionado && memorialSelecionado && !modoEdicao && orcamentos.length === 0 && (
                        <button
                            onClick={() => { setOrcamentoEditando(null); setModoEdicao(true) }}
                            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                            <Plus size={16} /> Novo orçamento
                        </button>
                    )}
                </header>

                <main className="flex-1 p-6 overflow-y-auto">
                    {erro && (
                        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{erro}</div>
                    )}

                    {/* Tela 1: Seleção de projeto */}
                    {!projetoSelecionado && (
                        <TelaSelecao projetos={projetos} onSelecionar={handleSelecionarProjeto} />
                    )}

                    {/* Tela 2: Seleção de memorial */}
                    {projetoSelecionado && !memorialSelecionado && !modoEdicao && (
                        <div className="flex flex-col gap-4">
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                                <p className="text-sm font-semibold text-gray-700">Selecione o memorial para criar o orçamento</p>
                                <p className="text-xs text-gray-400 mt-0.5">Cada versão de memorial gera um orçamento independente</p>
                            </div>
                            {carregandoDados ? (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-12">
                                    <p className="text-sm text-gray-400">Carregando memoriais...</p>
                                </div>
                            ) : memoriais.length === 0 ? (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-12">
                                    <p className="text-sm text-gray-400">Nenhum memorial criado para este projeto.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {memoriais.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => handleSelecionarMemorial(m)}
                                            className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-left hover:border-[#2D3AC2]/30 hover:shadow-md transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-[#2D3AC2]">Memorial V{m.versao}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        Criado em {new Date(m.criadoEm).toLocaleDateString('pt-BR')}
                                                        {m.criadoPor && ` · ${m.criadoPor.name}`}
                                                        {m.orcamento ? ' · ✓ Orçamento criado' : ' · Sem orçamento'}
                                                    </p>
                                                </div>
                                                <span className="text-xs text-[#2D3AC2] opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Selecionar →
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tela 3: Lista de orçamentos do memorial */}
                    {projetoSelecionado && memorialSelecionado && !modoEdicao && (
                        <div className="flex flex-col gap-4">
                            {carregandoDados ? (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-12">
                                    <p className="text-sm text-gray-400">Carregando...</p>
                                </div>
                            ) : orcamentos.length === 0 ? (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
                                    <FileText size={32} className="text-gray-300" />
                                    <p className="text-sm text-gray-400">Nenhum orçamento criado para este memorial.</p>
                                    <button
                                        onClick={() => { setOrcamentoEditando(null); setModoEdicao(true) }}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#2D3AC2] hover:bg-[#232fa8] text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        <Plus size={14} /> Criar orçamento
                                    </button>
                                </div>
                            ) : (
                                orcamentos.map(orc => {
                                    const itens = JSON.parse(orc.itens || '[]')
                                    const { subtotal, totalNF } = calcularTotais(itens.map(i => ({ ...i, id: 0 })))
                                    return (
                                        <div key={orc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-bold text-[#2D3AC2]">
                                                            Orçamento V{orc.versao}
                                                        </span>
                                                        {orc.enviado ? (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                                                                Enviado ao cliente
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium">
                                                                Em aberto
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-400">
                                                        {itens.length} {itens.length === 1 ? 'item' : 'itens'} ·
                                                        Sub-total: {formatarMoeda(subtotal)} ·
                                                        Total com NF: {formatarMoeda(totalNF)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                                    {!orc.enviado && (
                                                        <>
                                                            <button
                                                                onClick={() => { setOrcamentoEditando(orc); setModoEdicao(true) }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={() => handleEnviar(orc.id)}
                                                                disabled={enviando}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                <Send size={12} /> Marcar como enviado
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => handleGerarPDF(orc)}
                                                        disabled={gerandoPDF}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2D3AC2] hover:bg-[#232fa8] text-white rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        <Download size={12} /> {gerandoPDF ? 'Gerando...' : 'Gerar PDF'}
                                                    </button>
                                                    {!orc.enviado && (
                                                        <button
                                                            onClick={() => handleDeletar(orc.id)}
                                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Tela 4: Editor */}
                    {projetoSelecionado && memorialSelecionado && modoEdicao && (
                        <EditorOrcamento
                            projeto={projetoSelecionado}
                            memorial={memorialSelecionado}
                            orcamentoExistente={orcamentoEditando}
                            onSalvar={handleSalvar}
                            onCancelar={() => { setModoEdicao(false); setOrcamentoEditando(null) }}
                        />
                    )}
                </main>
            </div>
        </div>
    )
}
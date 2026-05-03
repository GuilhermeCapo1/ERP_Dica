import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft, Building2, Calendar, MapPin, Ruler,
    FileText, Image, DollarSign, Download, User,
    CheckCircle2, Package
} from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CAMPOS_MEMORIAL = [
    { key: 'piso',              label: '01 - PISO' },
    { key: 'estrutura',         label: '02 - ESTRUTURA' },
    { key: 'areaAtendimento',   label: '03 - Área de Atendimento' },
    { key: 'audioVisual',       label: '04 - Áudio Visual' },
    { key: 'comunicacaoVisual', label: '05 - Comunicação Visual' },
    { key: 'eletrica',          label: '06 - Elétrica' },
]

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function calcularTotais(itens) {
    const subtotal = itens.reduce((acc, item) =>
        acc + (parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || 0), 0)
    const totalNF = subtotal / 90 * 100
    const imposto = totalNF - subtotal
    return { subtotal, totalNF, imposto, recibo: subtotal }
}

function parsearArquivos(raw) {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch { return {} }
}

// ─── Seção com título ──────────────────────────────────────────────────────
function Secao({ icone: Icone, titulo, children }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
                <div className="w-7 h-7 rounded-lg bg-[#2D3AC2]/10 flex items-center justify-center shrink-0">
                    <Icone size={14} className="text-[#2D3AC2]" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    )
}

export default function ProjetoDetalhes() {
    const { projetoId }         = useParams()
    const [usuario, setUsuario] = useState(null)
    const [projeto, setProjeto] = useState(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro]       = useState('')
    const navigate              = useNavigate()

    useEffect(() => {
        async function iniciar() {
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)
            try {
                const data = await api.getProjetoDetalhes(projetoId)
                setProjeto(data)
            } catch (err) {
                setErro('Erro ao carregar projeto: ' + err.message)
            } finally {
                setCarregando(false)
            }
        }
        iniciar()
    }, [projetoId])

    if (carregando) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-sm text-gray-400">Carregando...</p>
            </div>
        )
    }

    if (erro || !projeto) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-sm text-red-400">{erro || 'Projeto não encontrado'}</p>
            </div>
        )
    }

    // ── Dados derivados ────────────────────────────────────────────────────
    const arqs = parsearArquivos(projeto.arquivos)

    // Orçamento aprovado — identifica pelo orcamentoAprovadoId ou pega o maior enviado
    const orcamentoAprovado = projeto.orcamentoAprovadoId
        ? projeto.orcamentos.find(o => o.id === projeto.orcamentoAprovadoId)
        : projeto.orcamentos.filter(o => o.enviado).sort((a, b) => b.versao - a.versao)[0]

    // Memorial aprovado — vem via relacionamento do orçamento aprovado
    const memorialAprovado = orcamentoAprovado
        ? projeto.memoriais.find(m => m.id === orcamentoAprovado.memorialId)
        : projeto.memoriais.sort((a, b) => b.versao - a.versao)[0]

    const itens = orcamentoAprovado ? JSON.parse(orcamentoAprovado.itens || '[]') : []
    const { subtotal, totalNF, imposto, recibo } = calcularTotais(itens)

    const camposAtivos = memorialAprovado
        ? JSON.parse(memorialAprovado.camposAtivos || '[]')
        : []

    const ordemImagens = memorialAprovado
        ? JSON.parse(memorialAprovado.ordemImagens || '[]')
        : []

    const imagensOrdenadas = ordemImagens.length > 0
        ? ordemImagens.map(id => projeto.imagensProjeto.find(img => img.id === id)).filter(Boolean)
        : projeto.imagensProjeto

    return (
        <div className="min-h-screen bg-gray-100 flex">
            <Sidebar usuario={usuario} />

            <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <header className="bg-[#2D3AC2] text-white px-6 py-4 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-200 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold">{projeto.nome}</h2>
                        <p className="text-blue-200 text-sm mt-0.5">
                            Revisão completa do projeto
                        </p>
                    </div>
                </header>

                <main className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">

                    {/* ── 1. Dados do projeto ─────────────────────────── */}
                    <Secao icone={Building2} titulo="Dados do projeto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-0.5">
                                <p className="text-xs font-medium text-gray-400">Cliente</p>
                                <p className="text-sm text-gray-800">{projeto.cliente}</p>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-xs font-medium text-gray-400">Feira / Evento</p>
                                <p className="text-sm text-gray-800">{projeto.feira || '—'}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin size={13} className="text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-800">{projeto.local || '—'}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-800">{projeto.datas || '—'}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Ruler size={13} className="text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-800">{projeto.metragem ? `${projeto.metragem}m²` : '—'}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Package size={13} className="text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-800">{projeto.tipo || 'Estande'}</p>
                            </div>
                            {projeto.responsavel && (
                                <div className="flex items-center gap-1.5">
                                    <User size={13} className="text-gray-400 shrink-0" />
                                    <p className="text-sm text-gray-800">
                                        Vendedor: {projeto.responsavel.name}
                                    </p>
                                </div>
                            )}
                            {projeto.projetista && (
                                <div className="flex items-center gap-1.5">
                                    <User size={13} className="text-gray-400 shrink-0" />
                                    <p className="text-sm text-gray-800">
                                        Projetista: {projeto.projetista.name}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Condições comerciais aprovadas */}
                        {projeto.resultadoFinal === 'aprovado' && (
                            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-xs font-medium text-gray-400">Forma de pagamento</p>
                                    <p className="text-sm text-gray-800 capitalize">{projeto.formaPagamento || '—'}</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-xs font-medium text-gray-400">Tipo de documento</p>
                                    <p className="text-sm text-gray-800">
                                        {projeto.tipoDocumento === 'nota_fiscal' ? 'Nota Fiscal' :
                                         projeto.tipoDocumento === 'recibo_locacao' ? 'Recibo de Locação' : '—'}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-xs font-medium text-gray-400">Condições de pagamento</p>
                                    <p className="text-sm text-gray-800">{projeto.condicoesPagamento || '—'}</p>
                                </div>
                                {projeto.observacoesAprovacao && (
                                    <div className="col-span-3 flex flex-col gap-0.5">
                                        <p className="text-xs font-medium text-gray-400">Observações</p>
                                        <p className="text-sm text-gray-800">{projeto.observacoesAprovacao}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Secao>

                    {/* ── 2. Arquivos do briefing ─────────────────────── */}
                    {(arqs.manual || arqs.mapa || arqs.briefing || arqs.logos?.length > 0) && (
                        <Secao icone={FileText} titulo="Arquivos do briefing">
                            <div className="flex flex-col gap-2">
                                {[
                                    { label: 'Manual do expositor', arq: arqs.manual },
                                    { label: 'Mapa da feira',       arq: arqs.mapa },
                                    { label: 'Briefing',            arq: arqs.briefing },
                                ].filter(({ arq }) => arq).map(({ label, arq }) => (
                                    <a
                                        key={label}
                                        href={arq.url || arq}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                                    >
                                        <FileText size={14} className="text-gray-400 group-hover:text-blue-500 shrink-0" />
                                        <span className="text-sm text-gray-600 group-hover:text-blue-700 flex-1">{label}</span>
                                        <span className="text-xs text-gray-400">{arq.nome || ''}</span>
                                        <Download size={13} className="text-gray-300 group-hover:text-blue-500 shrink-0" />
                                    </a>
                                ))}

                                {arqs.logos?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-2 mt-1">Logos</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {arqs.logos.map((logo, i) => {
                                                const url  = logo.url  || logo
                                                const nome = logo.nome || `Logo ${i + 1}`
                                                const isImg = /\.(jpg|jpeg|png)$/i.test(nome)
                                                return (
                                                    <div key={i} className="flex flex-col gap-1.5">
                                                        {isImg && (
                                                            <div className="h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                                                <img src={url} alt={nome} className="w-full h-full object-contain p-1" />
                                                            </div>
                                                        )}
                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            download={nome}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors group text-xs"
                                                        >
                                                            <span className="flex-1 truncate text-gray-600 group-hover:text-blue-700">{nome}</span>
                                                            <Download size={11} className="text-gray-300 group-hover:text-blue-500 shrink-0" />
                                                        </a>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Secao>
                    )}

                    {/* ── 3. Renders / imagens do projeto ─────────────── */}
                    {imagensOrdenadas.length > 0 && (
                        <Secao icone={Image} titulo={`Renders do projeto (${imagensOrdenadas.length})`}>
                            <div className="grid grid-cols-3 gap-3">
                                {imagensOrdenadas.map((img, i) => (
                                    <a
                                        key={img.id}
                                        href={`${API_URL}${img.url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-video block"
                                    >
                                        <img
                                            src={`${API_URL}${img.url}`}
                                            alt={`Render ${i + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                            <Download size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="absolute bottom-1 left-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                            #{i + 1}
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </Secao>
                    )}

                    {/* ── 4. Memorial descritivo ───────────────────────── */}
                    {memorialAprovado && (
                        <Secao icone={FileText} titulo={`Memorial Descritivo — V${memorialAprovado.versao}`}>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-400">Área do Stand:</span>
                                    <span className="text-sm font-semibold text-gray-800">
                                        {projeto.metragem ? `${projeto.metragem}m²` : '—'}
                                    </span>
                                </div>

                                {CAMPOS_MEMORIAL.map(({ key, label }) => {
                                    if (!camposAtivos.includes(key)) return null
                                    const conteudo = memorialAprovado[key]
                                    if (!conteudo) return null
                                    return (
                                        <div key={key} className="flex flex-col gap-1.5">
                                            <p className="text-xs font-semibold text-[#2D3AC2] uppercase tracking-wide">
                                                {label}
                                            </p>
                                            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                                {conteudo}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </Secao>
                    )}

                    {/* ── 5. Orçamento aprovado ────────────────────────── */}
                    {orcamentoAprovado && (
                        <Secao icone={DollarSign} titulo={`Orçamento — V${orcamentoAprovado.versao}`}>
                            <div className="flex flex-col gap-4">

                                {/* Tabela de itens */}
                                <div className="rounded-lg overflow-hidden border border-gray-200">
                                    {/* Cabeçalho */}
                                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-900 text-xs font-semibold text-white uppercase tracking-wide">
                                        <div className="col-span-6">Descrição</div>
                                        <div className="col-span-2 text-center">Quant.</div>
                                        <div className="col-span-2 text-right">Valor unit.</div>
                                        <div className="col-span-2 text-right">Total</div>
                                    </div>

                                    <div className="divide-y divide-gray-100">
                                        {itens.map((item, i) => {
                                            const totalItem = (parseFloat(item.quantidade) || 0) * (parseFloat(item.valorUnitario) || 0)
                                            return (
                                                <div key={i} className={`grid grid-cols-12 gap-2 px-4 py-3 text-sm ${i === 0 ? 'bg-blue-50/40' : ''}`}>
                                                    <div className="col-span-6 text-gray-700">{item.descricao}</div>
                                                    <div className="col-span-2 text-center text-gray-600">{item.quantidade}</div>
                                                    <div className="col-span-2 text-right text-gray-600">{formatarMoeda(parseFloat(item.valorUnitario) || 0)}</div>
                                                    <div className="col-span-2 text-right font-medium text-gray-800">{formatarMoeda(totalItem)}</div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Totais */}
                                    <div className="bg-gray-900 px-4 py-3 flex flex-col gap-1.5">
                                        <div className="flex justify-between text-sm text-gray-300">
                                            <span>Sub-total</span>
                                            <span className="font-medium">{formatarMoeda(subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-300">
                                            <span>Impostos sobre nota fiscal</span>
                                            <span className="font-medium">{formatarMoeda(imposto)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-white border-t border-gray-700 pt-1.5 mt-0.5">
                                            <span>Total</span>
                                            <span>{formatarMoeda(totalNF)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-400 border-t border-gray-700 pt-1.5 mt-0.5">
                                            <span>Opção com Recibo de Locação</span>
                                            <span>{formatarMoeda(recibo)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Condições do orçamento */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-xs font-medium text-gray-400">Forma de pagamento</p>
                                        <p className="text-sm text-gray-800">{orcamentoAprovado.formaPagamento || 'a combinar'}</p>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-xs font-medium text-gray-400">Vencimentos</p>
                                        <p className="text-sm text-gray-800">{orcamentoAprovado.vencimentos || 'a combinar'}</p>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-xs font-medium text-gray-400">Cidade / Data</p>
                                        <p className="text-sm text-gray-800">
                                            {orcamentoAprovado.cidade}, {new Date(orcamentoAprovado.dataOrcamento).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>

                                {/* Tipo de documento aprovado */}
                                {projeto.tipoDocumento && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                                        <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                                        <p className="text-sm text-green-800">
                                            Documento acordado:{' '}
                                            <span className="font-semibold">
                                                {projeto.tipoDocumento === 'nota_fiscal' ? 'Nota Fiscal' : 'Recibo de Locação'}
                                            </span>
                                            {' · '}
                                            <span className="capitalize">{projeto.formaPagamento}</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Secao>
                    )}

                    {/* Sem dados de orçamento/memorial */}
                    {!orcamentoAprovado && !memorialAprovado && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-12">
                            <p className="text-sm text-gray-400">
                                Nenhum orçamento ou memorial aprovado encontrado para este projeto.
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
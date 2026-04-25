import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Trash2, ImageIcon, ChevronDown, X, CheckCircle2 } from 'lucide-react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const STATUS_CORES = {
    'Recebido':     { light: 'bg-blue-50',   text: 'text-blue-700' },
    'Em criação':   { light: 'bg-purple-50', text: 'text-purple-700' },
    'Memorial':     { light: 'bg-red-50',    text: 'text-red-700' },
    'Precificação': { light: 'bg-yellow-50', text: 'text-yellow-700' },
    'Enviado':      { light: 'bg-cyan-50',   text: 'text-cyan-700' },
    'Aprovado':     { light: 'bg-green-50',  text: 'text-green-700' },
}

export default function MeusBriefings() {
    const [usuario, setUsuario] = useState(null)
    const [projetos, setProjetos] = useState([])
    const [projetoAberto, setProjetoAberto] = useState(null)
    const [imagensPorProjeto, setImagensPorProjeto] = useState({})
    const [carregando, setCarregando] = useState(true)
    const [enviando, setEnviando] = useState(false)
    const [sucesso, setSucesso] = useState('')
    const [erro, setErro] = useState('')
    const inputRef = useRef(null)
    const navigate = useNavigate()

    // ─── Carrega dados iniciais ──────────────────────────────────────────
    useEffect(() => {
        async function iniciar() {
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)

            const lista = await api.getMeusProjetos()
            if (Array.isArray(lista)) setProjetos(lista)
            setCarregando(false)
        }
        iniciar()
    }, [])

    // ─── Abre/fecha accordion de um projeto e carrega as imagens ────────
    async function toggleProjeto(projetoId) {
        if (projetoAberto === projetoId) {
            setProjetoAberto(null)
            return
        }
        setProjetoAberto(projetoId)

        // Carrega imagens se ainda não carregou
        if (!imagensPorProjeto[projetoId]) {
            const imagens = await api.getImagensProjeto(projetoId)
            setImagensPorProjeto(prev => ({ ...prev, [projetoId]: imagens }))
        }
    }

    // ─── Upload de imagens ────────────────────────────────────────────────
    async function handleUpload(projetoId, arquivos) {
        if (!arquivos || arquivos.length === 0) return

        setEnviando(true)
        setErro('')
        setSucesso('')

        try {
            const formData = new FormData()
            Array.from(arquivos).forEach(file => formData.append('imagens', file))

            await api.uploadImagensProjeto(projetoId, formData)

            // Recarrega imagens do projeto
            const imagens = await api.getImagensProjeto(projetoId)
            setImagensPorProjeto(prev => ({ ...prev, [projetoId]: imagens }))
            setSucesso('Imagens enviadas com sucesso!')
            setTimeout(() => setSucesso(''), 3000)
        } catch (err) {
            setErro('Erro ao enviar imagens: ' + err.message)
        } finally {
            setEnviando(false)
        }
    }

    // ─── Deletar imagem ───────────────────────────────────────────────────
    async function handleDeletar(projetoId, imagemId) {
        if (!confirm('Tem certeza que deseja remover esta imagem?')) return

        try {
            await api.deletarImagemProjeto(projetoId, imagemId)
            setImagensPorProjeto(prev => ({
                ...prev,
                [projetoId]: prev[projetoId].filter(img => img.id !== imagemId)
            }))
        } catch (err) {
            setErro('Erro ao deletar imagem: ' + err.message)
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
                <header className="bg-[#2D3AC2] text-white px-6 py-4">
                    <h2 className="text-xl font-bold">Meus Briefings</h2>
                    <p className="text-blue-200 text-sm mt-0.5">
                        {projetos.length} {projetos.length === 1 ? 'projeto alocado' : 'projetos alocados'}
                    </p>
                </header>

                <main className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">

                    {/* Feedback global */}
                    {sucesso && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                            <CheckCircle2 size={16} />
                            {sucesso}
                        </div>
                    )}
                    {erro && (
                        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {erro}
                        </div>
                    )}

                    {/* Lista de projetos */}
                    {projetos.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
                            <ImageIcon size={32} className="text-gray-300" />
                            <p className="text-sm text-gray-400">Nenhum projeto alocado para você ainda.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {projetos.map(projeto => {
                                const aberto = projetoAberto === projeto.id
                                const imagens = imagensPorProjeto[projeto.id] || []
                                const cores = STATUS_CORES[projeto.status] || STATUS_CORES['Recebido']

                                return (
                                    <div key={projeto.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                                        {/* Cabeçalho do projeto — clicável */}
                                        <button
                                            onClick={() => toggleProjeto(projeto.id)}
                                            className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{projeto.nome}</p>
                                                <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                    {projeto.cliente}
                                                    {projeto.local && ` · ${projeto.local}`}
                                                    {projeto.metragem && ` · ${projeto.metragem}m²`}
                                                    {projeto.datas && ` · ${projeto.datas}`}
                                                </p>
                                            </div>

                                            <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${cores.light} ${cores.text}`}>
                                                {projeto.status}
                                            </span>

                                            <span className="text-xs text-gray-400 shrink-0">
                                                {projeto.imagensProjeto?.length || 0} imagens
                                            </span>

                                            <ChevronDown
                                                size={16}
                                                className={`text-gray-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {/* Painel expandido */}
                                        {aberto && (
                                            <div className="border-t border-gray-100 px-5 py-5 flex flex-col gap-4">

                                                {/* Briefing do projeto */}
                                                {projeto.briefing && (
                                                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                                                        <p className="text-xs font-semibold text-blue-700 mb-1">Briefing</p>
                                                        <p className="text-sm text-blue-900 whitespace-pre-line">{projeto.briefing}</p>
                                                    </div>
                                                )}

                                                {/* Upload de imagens */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-sm font-semibold text-gray-700">
                                                            Imagens do projeto ({imagens.length})
                                                        </p>
                                                        <label className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors
                                                            ${enviando
                                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                : 'bg-[#2D3AC2] hover:bg-[#232fa8] text-white'
                                                            }`}
                                                        >
                                                            <Upload size={14} />
                                                            {enviando ? 'Enviando...' : 'Adicionar imagens'}
                                                            <input
                                                                type="file"
                                                                multiple
                                                                accept=".jpg,.jpeg,.png"
                                                                className="hidden"
                                                                disabled={enviando}
                                                                onChange={e => handleUpload(projeto.id, e.target.files)}
                                                            />
                                                        </label>
                                                    </div>

                                                    {imagens.length === 0 ? (
                                                        <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-10 gap-2">
                                                            <ImageIcon size={28} className="text-gray-300" />
                                                            <p className="text-sm text-gray-400">Nenhuma imagem enviada ainda.</p>
                                                            <p className="text-xs text-gray-300">Clique em "Adicionar imagens" para fazer upload.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-3 gap-3">
                                                            {imagens.map(img => (
                                                                <div key={img.id} className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-video">
                                                                    <img
                                                                        src={`${API_URL}${img.url}`}
                                                                        alt="Render do projeto"
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                    {/* Botão deletar aparece no hover */}
                                                                    <button
                                                                        onClick={() => handleDeletar(projeto.id, img.id)}
                                                                        className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                                                        title="Remover imagem"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        #{img.ordem + 1}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
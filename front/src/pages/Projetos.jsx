import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import * as api from '@/services/api'

const STATUS = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado']
const STATUS_CORES = {
    'Recebido': 'bg-blue-500',
    'Em criação': 'bg-purple-500',
    'Memorial': 'bg-red-500',
    'Precificação': 'bg-yellow-500',
    'Enviado': 'bg-cyan-500',
    'Aprovado': 'bg-green-500',
}

const FORM_INICIAL = {
    nome: '', cliente: '', feira: '', metragem: '', datas: '',
    local: '', briefing: '', dataLimite: '', tipo: 'Estande'
}

export default function Projetos() {
    const [projetos, setProjetos] = useState([])
    const [user, setUser] = useState(null)
    const [modalAberto, setModalAberto] = useState(false)
    const [form, setForm] = useState(FORM_INICIAL)
    const [loading, setLoading] = useState(false)
    const [erro, setErro] = useState('')
    const navigate = useNavigate()
    const [arquivos, setArquivos] = useState({ manual: null, mapa: null, logos: null, briefing: null })
    useEffect(() => {
        api.getMe().then(u => {
            if (!u || u.message) return navigate('/login')
            setUser(u)
        })
        carregarProjetos()
    }, [])

    async function carregarProjetos() {
        const data = await api.getProjetos()
        console.log('projetos:', data)
        if (Array.isArray(data)) setProjetos(data)
    }

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    async function handleCriar() {
        if (!form.cliente || !form.feira || !form.metragem || !form.datas || !form.local) {
            setErro('Todos os campos são obrigatórios')
            return
        }
        if (!arquivos.mapa || !arquivos.logos) {
            setErro('Mapa da feira e logos são obrigatórios')
            return
        }
        setLoading(true)
        setErro('')
        try {
            const res = await api.criarProjeto({ ...form, metragem: form.metragem ? parseFloat(form.metragem) : null })
            if (res.id) {
                // Upload dos arquivos
                const formData = new FormData()
                if (arquivos.manual) formData.append('manual', arquivos.manual)
                if (arquivos.mapa) formData.append('mapa', arquivos.mapa)
                if (arquivos.logos) formData.append('logos', arquivos.logos)
                if (arquivos.briefing) formData.append('briefing', arquivos.briefing)
                await api.uploadArquivos(res.id, formData)

                setModalAberto(false)
                setForm(FORM_INICIAL)
                setArquivos({ manual: null, mapa: null, logos: null })
                carregarProjetos()
            } else {
                setErro(res.message || 'Erro ao criar projeto')
            }
        } catch (err) {
            console.error('Erro:', err)
            setErro('Erro ao conectar com o servidor: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleStatus(id, status) {
        await atualizarStatus(id, status)
        carregarProjetos()
    }

    async function handleDeletar(id) {
        if (!confirm('Tem certeza que deseja deletar este projeto?')) return
        await api.deletarProjeto(id)
        carregarProjetos()
    }

    const contarPorStatus = (s) => projetos.filter(p => p.status === s).length

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r flex flex-col p-6 gap-6">
                <h1 className="text-2xl font-bold">Dica Soluções</h1>
                <nav className="flex flex-col gap-4">
                    {['Dashboard', 'Projetos', 'Produção', 'Memorial', 'Orçamentos', 'Clientes', 'Relatórios'].map(item => (
                        <span key={item} className={`cursor-pointer text-gray-700 hover:text-blue-600 font-medium ${item === 'Projetos' ? 'text-blue-600' : ''}`}>
                            {item}
                        </span>
                    ))}
                </nav>
            </aside>

            {/* Conteúdo */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Projetos</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-sm">{user?.name}</span>
                        <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-sm">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <main className="p-6 flex flex-col gap-6">
                    {/* Botão + Filtros */}
                    <div className="flex items-center gap-3">
                        <Button onClick={() => setModalAberto(true)} className="bg-green-500 hover:bg-green-600 text-white">
                            + Novo Projeto
                        </Button>
                    </div>

                    {/* Cards de status */}
                    <div className="grid grid-cols-6 gap-3">
                        {STATUS.map(s => (
                            <div key={s} className={`${STATUS_CORES[s]} text-white rounded-lg p-4 text-center`}>
                                <p className="text-sm font-medium">{s}</p>
                                <p className="text-3xl font-bold mt-1">{contarPorStatus(s)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Lista de projetos */}
                    <div className="bg-white rounded-xl p-4">
                        <h3 className="text-lg font-semibold mb-4">Projetos</h3>
                        {projetos.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">Nenhum projeto cadastrado ainda.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-4">
                                {projetos.map(p => (
                                    <div key={p.id} className="border rounded-xl p-4 flex flex-col gap-2">
                                        <h4 className="font-bold text-lg">{p.nome}</h4>
                                        <p className="text-gray-500 text-sm">{p.cliente}</p>
                                        <div className="flex gap-2 flex-wrap">
                                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">{p.tipo}</span>
                                            {p.metragem && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{p.metragem} m²</span>}
                                        </div>
                                        <p className="text-gray-400 text-xs">{p.status}</p>
                                        {p.responsavel && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs font-bold">
                                                    {p.responsavel.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-gray-600">{p.responsavel.name}</span>
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            <select
                                                value={p.status}
                                                onChange={e => handleStatus(p.id, e.target.value)}
                                                className="text-xs border rounded px-2 py-1 flex-1"
                                            >
                                                {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <button onClick={() => handleDeletar(p.id)} className="text-red-400 hover:text-red-600 text-xs">
                                                Deletar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Modal Novo Projeto */}
            {modalAberto && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-xl flex flex-col gap-4">
                        <h3 className="text-xl font-bold">Novo Projeto</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 flex flex-col gap-1">
                                <label className="text-sm font-medium">Cliente:</label>
                                <input name="cliente" value={form.cliente} onChange={handleChange}
                                    className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Feira:</label>
                                <input name="feira" value={form.feira} onChange={handleChange}
                                    className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Metragem (m²):</label>
                                <input name="metragem" type="number" value={form.metragem} onChange={handleChange}
                                    className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Tipo:</label>
                                <select name="tipo" value={form.tipo} onChange={handleChange}
                                    className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                    <option value="Estande">Estande</option>
                                    <option value="Cenografia">Cenografia</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Datas:</label>
                                <input name="datas" value={form.datas} onChange={handleChange}
                                    className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Data limite:</label>
                                <input name="dataLimite" type="date" value={form.dataLimite} onChange={handleChange}
                                    className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Local:</label>
                                <input name="local" value={form.local} onChange={handleChange}
                                    className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="col-span-2 flex flex-col gap-1">
                                <label className="text-sm font-medium">Briefing:</label>
                                <textarea name="briefing" value={form.briefing} onChange={handleChange} rows={3}
                                    placeholder="Descreva o briefing aqui..."
                                    className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400">ou anexe um arquivo:</span>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => setArquivos(a => ({ ...a, briefing: e.target.files[0] }))}
                                        className="text-sm" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Manual do expositor:</label>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => setArquivos(a => ({ ...a, manual: e.target.files[0] }))}
                                    className="border rounded-lg px-3 py-2 text-sm" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Mapa da feira: <span className="text-red-500">*</span></label>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => setArquivos(a => ({ ...a, mapa: e.target.files[0] }))}
                                    className="border rounded-lg px-3 py-2 text-sm" />
                            </div>

                            <div className="col-span-2 flex flex-col gap-1">
                                <label className="text-sm font-medium">Logos: <span className="text-red-500">*</span></label>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => setArquivos(a => ({ ...a, logos: e.target.files[0] }))}
                                    className="border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>

                        {erro && <p className="text-red-500 text-sm">{erro}</p>}

                        <div className="flex justify-end gap-3 mt-2">
                            <Button onClick={() => { setModalAberto(false); setForm(FORM_INICIAL); setErro('') }}
                                className="bg-red-500 hover:bg-red-600 text-white">
                                Cancelar
                            </Button>
                            <Button onClick={handleCriar} disabled={loading}
                                className="bg-green-500 hover:bg-green-600 text-white">
                                {loading ? 'Salvando...' : 'Enviar para análise'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
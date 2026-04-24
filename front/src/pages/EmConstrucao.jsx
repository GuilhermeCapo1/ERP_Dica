import { useNavigate } from 'react-router-dom'
import { Hammer, ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import * as api from '@/services/api'
import Sidebar from '@/components/Sidebar'

/**
 * EmConstrucao
 * Página genérica para rotas ainda não implementadas.
 * Exibe sidebar normalmente, mas o conteúdo indica que está em desenvolvimento.
 */
export default function EmConstrucao() {
    const [usuario, setUsuario] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        async function carregar() {
            const u = await api.getMe()
            if (!u || u.message) return navigate('/login')
            setUsuario(u)
        }
        carregar()
    }, [])

    return (
        <div className="min-h-screen bg-gray-100 flex">
            <Sidebar usuario={usuario} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="bg-[#2D3AC2] text-white px-6 py-4">
                    <h2 className="text-xl font-bold">Em Construção</h2>
                    <p className="text-blue-200 text-sm mt-0.5">Esta página está sendo desenvolvida</p>
                </header>

                {/* Conteúdo */}
                <main className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl p-12 max-w-md w-full shadow-sm border border-gray-100 text-center flex flex-col items-center gap-5">

                        {/* Ícone */}
                        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center">
                            <Hammer size={28} className="text-yellow-500" />
                        </div>

                        {/* Texto */}
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Página em desenvolvimento</h1>
                            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                                Esta funcionalidade ainda está sendo construída.
                                Em breve estará disponível para você.
                            </p>
                        </div>

                        {/* Botão voltar */}
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#2D3AC2] hover:bg-[#232fa8] text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <ArrowLeft size={15} />
                            Voltar ao Dashboard
                        </button>
                    </div>
                </main>
            </div>
        </div>
    )
}
import { useNavigate } from 'react-router-dom'
import { ShieldOff, ArrowLeft } from 'lucide-react'

/**
 * AcessoNegado
 * Exibida quando o usuário tenta acessar uma rota sem permissão.
 */
export default function AcessoNegado() {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-10 max-w-md w-full shadow-sm border border-gray-100 text-center flex flex-col items-center gap-5">

                {/* Ícone */}
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                    <ShieldOff size={28} className="text-red-500" />
                </div>

                {/* Texto */}
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Acesso negado</h1>
                    <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                        Você não tem permissão para acessar esta página.
                        Entre em contato com seu gerente ou diretor caso acredite que isso seja um erro.
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
        </div>
    )
}
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    FolderKanban,
    Hammer,
    FileText,
    DollarSign,
    Users,
    BarChart3,
    LogOut,
} from 'lucide-react'
import * as api from '@/services/api'

// ─── Itens do menu ────────────────────────────────────────────────────────────
const MENU_ITENS = [
    { label: 'Dashboard',  icone: LayoutDashboard, rota: '/dashboard' },
    { label: 'Projetos',   icone: FolderKanban,    rota: '/projetos'  },
    { label: 'Produção',   icone: Hammer,          rota: '/producao'  },
    { label: 'Memorial',   icone: FileText,        rota: '/memorial'  },
    { label: 'Orçamentos', icone: DollarSign,      rota: '/orcamentos'},
    { label: 'Clientes',   icone: Users,           rota: '/clientes'  },
    { label: 'Relatórios', icone: BarChart3,       rota: '/relatorios'},
]

// ─── Helper: pega as iniciais do nome ────────────────────────────────────────
function iniciais(nome) {
    if (!nome) return '?'
    return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

/**
 * Sidebar reutilizável
 * Props:
 *   usuario  → objeto { name, cargo } do usuário logado
 */
export default function Sidebar({ usuario }) {
    const localizacao = useLocation()
    const navigate    = useNavigate()

    async function handleLogout() {
        await api.logout()
        navigate('/login')
    }

    return (
        <aside className="w-64 bg-white border-r flex flex-col shrink-0">

            {/* Logo */}
            <div className="px-6 py-5 border-b">
                <h1 className="text-xl font-bold text-gray-900">Dica Soluções</h1>
                <p className="text-xs text-gray-400 mt-0.5">Gestão de Projetos</p>
            </div>

            {/* Navegação */}
            <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
                {MENU_ITENS.map(({ label, icone: Icone, rota }) => {
                    const ativo = localizacao.pathname === rota
                    return (
                        <Link
                            key={rota}
                            to={rota}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                ${ativo
                                    ? 'bg-[#2D3AC2] text-white'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                        >
                            <Icone size={17} />
                            {label}
                        </Link>
                    )
                })}
            </nav>

            {/* Perfil + Logout */}
            <div className="px-4 py-4 border-t">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2D3AC2] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {iniciais(usuario?.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{usuario?.name}</p>
                        <p className="text-xs text-gray-400 truncate capitalize">{usuario?.cargo || 'Usuário'}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Sair"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    )
}

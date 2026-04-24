import {
    LayoutDashboard,
    FolderKanban,
    Hammer,
    FileText,
    DollarSign,
    Users,
    BarChart3,
    ClipboardList,
} from 'lucide-react'

/**
 * Configuração centralizada de rotas do sistema.
 * Esta é a fonte única de verdade para rotas, permissões e menu.
 */

export const ROTAS = [
    {
        path: '/dashboard',
        label: 'Dashboard',
        icone: LayoutDashboard,
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor'],
    },
    {
        path: '/projetos',
        label: 'Projetos',
        icone: FolderKanban,
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor'],
    },
    {
        path: '/meus-briefings',
        label: 'Meus Briefings',
        icone: ClipboardList,
        cargos: ['projetista', 'gerente', 'diretor'],
    },
    {
        path: '/producao',
        label: 'Produção',
        icone: Hammer,
        cargos: ['gerente', 'diretor'],
    },
    {
        path: '/memorial',
        label: 'Memorial',
        icone: FileText,
        cargos: ['gerente', 'diretor'],
    },
    {
        path: '/orcamentos',
        label: 'Orçamentos',
        icone: DollarSign,
        cargos: ['gerente', 'diretor'],
    },
    {
        path: '/clientes',
        label: 'Clientes',
        icone: Users,
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor'],
    },
    {
        path: '/relatorios',
        label: 'Relatórios',
        icone: BarChart3,
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor'],
    },
]

/**
 * Retorna as rotas que um cargo pode acessar.
 * @param {string} cargo - Cargo do usuário
 * @returns {string[]} Array de paths de rotas permitidas
 */
export function getRotasPorCargo(cargo) {
    if (!cargo) return []
    const cargoNormalizado = cargo.toLowerCase()
    return ROTAS
        .filter(r => r.cargos.map(c => c.toLowerCase()).includes(cargoNormalizado))
        .map(r => r.path)
}

/**
 * Verifica se um cargo tem acesso a uma rota.
 * @param {string} cargo - Cargo do usuário
 * @param {string} rota - Rota que está tentando acessar
 * @returns {boolean}
 */
export function temAcesso(cargo, rota) {
    if (!cargo || !rota) return false
    const rotasPermitidas = getRotasPorCargo(cargo)
    return rotasPermitidas.includes(rota.toLowerCase())
}

/**
 * Retorna os cargos que podem acessar uma rota.
 * @param {string} path - Path da rota
 * @returns {string[]} Array de cargos permitidos
 */
export function getCargosPorRota(path) {
    const rota = ROTAS.find(r => r.path === path)
    return rota?.cargos || []
}

/**
 * Funcionalidades específicas por cargo (usadas nos componentes para mostrar/esconder botões)
 */
export const FUNCIONALIDADES = {
    // Pode alocar ou trocar o projetista de um projeto
    alocarProjetista: ['gerente', 'diretor'],

    // Pode criar novos projetos
    criarProjeto: ['vendedor', 'gerente', 'diretor'],

    // Pode deletar projetos
    deletarProjeto: ['gerente', 'diretor'],

    // Pode alterar o status de um projeto
    alterarStatus: ['gerente', 'diretor', 'projetista'],

    // Pode ver os briefings alocados para si (tela Meus Briefings)
    verBriefingAlocado: ['projetista', 'gerente', 'diretor'],
}

/**
 * Verifica se um cargo pode usar uma funcionalidade específica.
 * @param {string} cargo - cargo do usuário
 * @param {string} funcionalidade - chave de FUNCIONALIDADES (ex: 'alocarProjetista')
 * @returns {boolean}
 */
export function temPermissao(cargo, funcionalidade) {
    if (!cargo || !funcionalidade) return false
    const cargoNormalizado = cargo.toLowerCase()
    const cargosPermitidos = FUNCIONALIDADES[funcionalidade] || []
    return cargosPermitidos.map(c => c.toLowerCase()).includes(cargoNormalizado)
}

/**
 * Lista de todos os cargos válidos no sistema.
 * Útil para validações e selects no frontend.
 */
export const CARGOS_VALIDOS = ['vendedor', 'gerente', 'projetista', 'diretor']

/**
 * Labels formatadas para exibição dos cargos.
 */
export const LABEL_CARGO = {
    vendedor: 'Vendedor',
    gerente: 'Gerente',
    projetista: 'Projetista',
    diretor: 'Diretor',
}

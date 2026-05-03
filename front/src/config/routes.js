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
        // Rota de detalhes do projeto — acessada via clientes, não aparece no menu
        path: '/projetos/:projetoId/detalhes',
        label: '',
        icone: LayoutDashboard,
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor'],
        menuOculto: true,
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
 */
export function getRotasPorCargo(cargo) {
    if (!cargo) return []
    const cargoNormalizado = cargo.toLowerCase()
    return ROTAS
        .filter(r => r.cargos.map(c => c.toLowerCase()).includes(cargoNormalizado))
        .map(r => r.path)
}

/**
 * Converte um path com parâmetros (:param) em regex para comparação.
 * Ex: '/projetos/:id/detalhes' → /^\/projetos\/[^/]+\/detalhes$/
 */
function pathParaRegex(path) {
    const escaped = path.replace(/:[^/]+/g, '[^/]+').replace(/\//g, '\\/')
    return new RegExp(`^${escaped}$`)
}

/**
 * Verifica se um cargo tem acesso a uma rota.
 * Suporta rotas dinâmicas com parâmetros (ex: /projetos/:id/detalhes).
 */
export function temAcesso(cargo, rota) {
    if (!cargo || !rota) return false
    const cargoNormalizado = cargo.toLowerCase()
    return ROTAS.some(r =>
        pathParaRegex(r.path).test(rota) &&
        r.cargos.map(c => c.toLowerCase()).includes(cargoNormalizado)
    )
}

/**
 * Retorna os cargos que podem acessar uma rota.
 */
export function getCargosPorRota(path) {
    const rota = ROTAS.find(r => r.path === path)
    return rota?.cargos || []
}

/**
 * Funcionalidades específicas por cargo.
 * Usadas nos componentes para mostrar/esconder botões e ações.
 */
export const FUNCIONALIDADES = {
    // Alocar ou trocar projetista de um projeto
    alocarProjetista: ['gerente', 'diretor'],

    // Criar novos projetos
    criarProjeto: ['vendedor', 'gerente', 'diretor'],

    // Deletar projetos
    deletarProjeto: ['gerente', 'diretor'],

    // Alterar status manualmente (select de status)
    // Vendedor NÃO pode alterar status — o fluxo é automático
    alterarStatus: ['gerente', 'diretor'],

    // Voltar status para etapa anterior (com justificativa)
    voltarStatus: ['gerente', 'diretor'],

    // Registrar resultado do projeto (aprovado/reprovado)
    // Apenas o vendedor responsável pelo projeto pode fazer isso
    // (validação adicional feita no componente: p.responsavelId === usuario.id)
    registrarResultado: ['vendedor'],

    // Ver briefings alocados (tela Meus Briefings)
    verBriefingAlocado: ['projetista', 'gerente', 'diretor'],

    // Criar e editar memorial
    gerenciarMemorial: ['gerente', 'diretor'],

    // Criar e editar orçamento
    gerenciarOrcamento: ['gerente', 'diretor'],

    // Ver todos os clientes (vendedor só vê os seus)
    verTodosClientes: ['gerente', 'diretor'],
}

/**
 * Verifica se um cargo pode usar uma funcionalidade específica.
 */
export function temPermissao(cargo, funcionalidade) {
    if (!cargo || !funcionalidade) return false
    const cargoNormalizado = cargo.toLowerCase()
    const cargosPermitidos = FUNCIONALIDADES[funcionalidade] || []
    return cargosPermitidos.map(c => c.toLowerCase()).includes(cargoNormalizado)
}

/**
 * Lista de todos os cargos válidos no sistema.
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
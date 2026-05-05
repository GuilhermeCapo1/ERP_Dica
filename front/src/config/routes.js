import {
    LayoutDashboard,
    FolderKanban,
    Hammer,
    FileText,
    DollarSign,
    Users,
    BarChart3,
    ClipboardList,
    FileSignature,
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
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor', 'financeiro'],
    },
    {
        path: '/projetos',
        label: 'Projetos',
        icone: FolderKanban,
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor', 'financeiro'],
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
        path: '/contratos',
        label: 'Contratos',
        icone: FileSignature,
        cargos: ['vendedor', 'gerente', 'diretor', 'financeiro'],
    },
    {
        path: '/clientes',
        label: 'Clientes',
        icone: Users,
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor', 'financeiro'],
    },
    {
        path: '/relatorios',
        label: 'Relatórios',
        icone: BarChart3,
        cargos: ['vendedor', 'gerente', 'projetista', 'diretor', 'financeiro'],
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
 * Verifica se um cargo tem acesso a uma rota.
 */
export function temAcesso(cargo, rota) {
    if (!cargo || !rota) return false
    return getRotasPorCargo(cargo).includes(rota.toLowerCase())
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
    alterarStatus: ['gerente', 'diretor'],

    // Voltar status para etapa anterior (com justificativa)
    voltarStatus: ['gerente', 'diretor'],

    // Registrar resultado do projeto (aprovado/reprovado)
    // Validação adicional feita no componente: p.responsavelId === usuario.id
    registrarResultado: ['vendedor'],

    // Ver briefings alocados (tela Meus Briefings)
    verBriefingAlocado: ['projetista', 'gerente', 'diretor'],

    // Criar e editar memorial
    gerenciarMemorial: ['gerente', 'diretor'],

    // Criar e editar orçamento
    gerenciarOrcamento: ['gerente', 'diretor'],

    // Ver todos os contratos (vendedor só vê os seus)
    verTodosContratos: ['gerente', 'diretor', 'financeiro'],

    // Marcar contrato como assinado
    assinarContrato: ['gerente', 'diretor', 'financeiro'],

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
export const CARGOS_VALIDOS = ['vendedor', 'gerente', 'projetista', 'diretor', 'financeiro']

/**
 * Labels formatadas para exibição dos cargos.
 */
export const LABEL_CARGO = {
    vendedor:   'Vendedor',
    gerente:    'Gerente',
    projetista: 'Projetista',
    diretor:    'Diretor',
    financeiro: 'Financeiro',
}
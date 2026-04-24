// ─────────────────────────────────────────────────────────────────────────────
// permissoes.js
// Re-exporta as funções de permissão do arquivo centralizado config/routes.js
// Qualquer mudança de acesso deve ser feita em config/routes.js
// ─────────────────────────────────────────────────────────────────────────────

export {
    ROTAS,
    FUNCIONALIDADES,
    temAcesso,
    temPermissao,
    getRotasPorCargo,
    getCargosPorRota,
    CARGOS_VALIDOS,
    LABEL_CARGO,
} from '@/config/routes'

// Legacy exports para retro-compatibilidade
export { ROTAS as ROTAS_POR_CARGO } from '@/config/routes'

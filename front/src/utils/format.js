/**
 * Gera as iniciais de um nome (primeiras 2 letras)
 * @param {string} nome - Nome completo
 * @returns {string} Iniciais em maiúsculo
 */
export function iniciais(nome) {
    if (!nome) return '?'
    return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

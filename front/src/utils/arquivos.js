/**
 * parsearArquivos
 * Faz parse seguro do campo `arquivos` de um projeto.
 *
 * O campo pode vir em 3 formatos dependendo da versão do dado no banco:
 *   - null / undefined       → retorna {}
 *   - objeto Json nativo     → retorna direto (novo formato)
 *   - string JSON (legado)   → faz parse e retorna
 *
 * Estrutura esperada do retorno:
 * {
 *   manual?:  { url: string, nome: string }
 *   mapa?:    { url: string, nome: string }
 *   briefing?: { url: string, nome: string }
 *   logos?:   Array<{ url: string, nome: string }>
 * }
 */
export function parsearArquivos(raw) {
    if (!raw) return {}
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) } catch { return {} }
    }
    return {}
}

/**
 * temArquivos
 * Verifica se um projeto tem pelo menos um arquivo de briefing salvo.
 */
export function temArquivos(raw) {
    const arqs = parsearArquivos(raw)
    return !!(arqs.manual || arqs.mapa || arqs.briefing || arqs.logos?.length)
}

/**
 * urlArquivo
 * Extrai a URL de um campo de arquivo, suportando formato novo { url, nome }
 * e formato legado (string pura).
 */
export function urlArquivo(arquivo) {
    if (!arquivo) return null
    if (typeof arquivo === 'string') return arquivo
    return arquivo.url || null
}

/**
 * nomeArquivo
 * Extrai o nome legível de um campo de arquivo.
 */
export function nomeArquivo(arquivo, fallback = 'Arquivo') {
    if (!arquivo) return fallback
    if (typeof arquivo === 'string') return arquivo.split('/').pop()
    return arquivo.nome || arquivo.url?.split('/').pop() || fallback
}
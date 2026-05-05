const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Faz uma requisição HTTP com tratamento de erro padrão
 */
async function request(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    })

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
        throw new Error(error.message || `HTTP ${res.status}`)
    }

    if (res.status === 204) return null
    return res.json()
}

// ── Autenticação ────────────────────────────────────────────────────────────

export async function login(email, password) {
    return request(`${API_URL}/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
}

export async function cadastro(name, email, password, cargo) {
    return request(`${API_URL}/cadastro`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password, cargo }),
    })
}

export async function logout() {
    return request(`${API_URL}/logout`, { method: 'POST' })
}

export async function getMe() {
    return request(`${API_URL}/me`)
}

// ── Projetos ────────────────────────────────────────────────────────────────

export async function getProjetos(filtros = {}) {
    const params = new URLSearchParams(filtros).toString()
    return request(`${API_URL}/projetos?${params}`)
}

export async function getProjetoDetalhes(projetoId) {
    return request(`${API_URL}/projetos/${projetoId}/detalhes`)
}

export async function getMeusProjetos() {
    return request(`${API_URL}/meus-projetos`)
}

export async function getProjetistas() {
    return request(`${API_URL}/projetistas`)
}

export async function criarProjeto(data) {
    return request(`${API_URL}/projetos`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function atualizarStatus(id, status, justificativa) {
    return request(`${API_URL}/projetos/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, justificativa }),
    })
}

export async function alocarProjetista(projetoId, projetistaId) {
    return request(`${API_URL}/projetos/${projetoId}/projetista`, {
        method: 'PATCH',
        body: JSON.stringify({ projetistaId }),
    })
}

export async function registrarResultado(projetoId, dados) {
    return request(`${API_URL}/projetos/${projetoId}/resultado`, {
        method: 'PATCH',
        body: JSON.stringify(dados),
    })
}

export async function deletarProjeto(id) {
    return request(`${API_URL}/projetos/${id}`, { method: 'DELETE' })
}

export async function uploadArquivos(id, formData) {
    const res = await fetch(`${API_URL}/projetos/${id}/arquivos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    })
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
        throw new Error(error.message || `HTTP ${res.status}`)
    }
    return res.json()
}

// ── Imagens do projeto ──────────────────────────────────────────────────────

export async function uploadImagensProjeto(projetoId, formData) {
    const res = await fetch(`${API_URL}/projetos/${projetoId}/imagens`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    })
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
        throw new Error(error.message || `HTTP ${res.status}`)
    }
    return res.json()
}

export async function getImagensProjeto(projetoId) {
    return request(`${API_URL}/projetos/${projetoId}/imagens`)
}

export async function atualizarOrdemImagens(projetoId, ordens) {
    return request(`${API_URL}/projetos/${projetoId}/imagens/ordem`, {
        method: 'PATCH',
        body: JSON.stringify({ ordens }),
    })
}

export async function deletarImagemProjeto(projetoId, imagemId) {
    return request(`${API_URL}/projetos/${projetoId}/imagens/${imagemId}`, {
        method: 'DELETE',
    })
}

// ── Memorial ────────────────────────────────────────────────────────────────

export async function getMemoriais(projetoId) {
    return request(`${API_URL}/projetos/${projetoId}/memoriais`)
}

export async function getMemorial(memorialId) {
    return request(`${API_URL}/memoriais/${memorialId}`)
}

export async function criarMemorial(projetoId, dados) {
    return request(`${API_URL}/projetos/${projetoId}/memoriais`, {
        method: 'POST',
        body: JSON.stringify(dados),
    })
}

export async function atualizarMemorial(memorialId, dados) {
    return request(`${API_URL}/memoriais/${memorialId}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
    })
}

export async function deletarMemorial(memorialId) {
    return request(`${API_URL}/memoriais/${memorialId}`, { method: 'DELETE' })
}

// ── Orçamentos ───────────────────────────────────────────────────────────────

export async function getOrcamentos(projetoId) {
    return request(`${API_URL}/projetos/${projetoId}/orcamentos`)
}

export async function getOrcamento(orcamentoId) {
    return request(`${API_URL}/orcamentos/${orcamentoId}`)
}

export async function criarOrcamento(projetoId, dados) {
    return request(`${API_URL}/projetos/${projetoId}/orcamentos`, {
        method: 'POST',
        body: JSON.stringify(dados),
    })
}

export async function atualizarOrcamento(orcamentoId, dados) {
    return request(`${API_URL}/orcamentos/${orcamentoId}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
    })
}

export async function enviarOrcamento(orcamentoId) {
    return request(`${API_URL}/orcamentos/${orcamentoId}/enviar`, {
        method: 'PATCH',
    })
}

export async function deletarOrcamento(orcamentoId) {
    return request(`${API_URL}/orcamentos/${orcamentoId}`, {
        method: 'DELETE',
    })
}

// ── Clientes ────────────────────────────────────────────────────────────────

export async function getClientes() {
    return request(`${API_URL}/clientes`)
}

export async function getCliente(clienteId) {
    return request(`${API_URL}/clientes/${clienteId}`)
}

export async function atualizarCliente(clienteId, dados) {
    return request(`${API_URL}/clientes/${clienteId}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
    })
}

export async function deletarCliente(clienteId) {
    return request(`${API_URL}/clientes/${clienteId}`, {
        method: 'DELETE',
    })
}

// ── Adicionar em api.js ────────────────────────────────────────────────────

// Faz download do contrato .docx do projeto aprovado
export async function baixarContrato(projetoId) {
    const res = await fetch(`${API_URL}/projetos/${projetoId}/contrato`, {
        credentials: 'include',
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(error.message || `HTTP ${res.status}`);
    }

    // Extrai o nome do arquivo do header Content-Disposition
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const nomeArquivo = match ? match[1] : 'contrato.docx';

    // Força o download no navegador
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
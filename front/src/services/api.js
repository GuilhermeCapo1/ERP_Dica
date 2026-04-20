const API_URL = 'http://localhost:3001'

export async function login(email, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  })
  return res.json()
}

export async function cadastro(name, email, password, cargo) {
  const res = await fetch(`${API_URL}/cadastro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, cargo })
  })
  return res.json()
}

export async function logout() {
  const res = await fetch(`${API_URL}/logout`, {
    method: 'POST',
    credentials: 'include'
  })
  return res.json()
}

export async function getMe() {
  const res = await fetch(`${API_URL}/me`, {
    credentials: 'include'
  })
  return res.json()
}

export async function getProjetos(filtros = {}) {
  const params = new URLSearchParams(filtros).toString()
  const res = await fetch(`${API_URL}/projetos?${params}`, {
    credentials: 'include'
  })
  return res.json()
}

export async function criarProjeto(data) {
  const res = await fetch(`${API_URL}/projetos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function atualizarStatus(id, status) {
  const res = await fetch(`${API_URL}/projetos/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status })
  })
  return res.json()
}

export async function deletarProjeto(id) {
  const res = await fetch(`${API_URL}/projetos/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  return res.json()
}

export async function uploadArquivos(id, formData) {
  const res = await fetch(`${API_URL}/projetos/${id}/arquivos`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  })
  return res.json()
}
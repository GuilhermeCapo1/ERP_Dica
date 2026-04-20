import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { login } from '@/services/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin() {
    if (!email || !password) {
      setError('Preencha todos os campos')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await login(email, password)
      if (res.message === 'Login bem-sucedido') {
        navigate('/projetos')
      } else {
        setError(res.message || 'Erro ao fazer login')
      }
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#2D3AC2] flex items-center justify-center">
      <div className="bg-white rounded-2xl p-10 w-full max-w-md shadow-lg">
        <h1 className="text-3xl font-semibold mb-8">Acesse sua conta</h1>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Email:</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border border-[#2D3AC2] rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#2D3AC2]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Senha:</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border border-[#2D3AC2] rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#2D3AC2]"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            onClick={handleLogin}
            disabled={loading}
            className="bg-[#2D3AC2] hover:bg-[#232fa8] text-white py-3 rounded-lg mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-[#2D3AC2] font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cadastro } from '@/services/api'

export default function Cadastro() {
    const [form, setForm] = useState({ name: '', email: '', password: '', cargo: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    async function handleCadastro() {
        if (!form.name || !form.email || !form.password) {
            setError('Preencha todos os campos obrigatórios')
            return
        }
        if (form.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres')
            return
        }
        if (/^\d+$/.test(form.password)) {
            setError('A senha não pode conter apenas números')
            return
        }

        setLoading(true)
        setError('')
        try {
            const res = await cadastro(form.name, form.email, form.password, form.cargo)
            if (res.user) {
                navigate('/login')
            } else {
                setError(res.message || 'Erro ao cadastrar')
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
                <h1 className="text-3xl font-semibold mb-8">Crie sua conta</h1>

                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Nome:</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            className="border border-[#2D3AC2] rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#2D3AC2]"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Email:</label>
                        <input
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={handleChange}
                            className="border border-[#2D3AC2] rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#2D3AC2]"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Cargo:</label>
                        <select
                            name="cargo"
                            value={form.cargo}
                            onChange={handleChange}
                            className="border border-[#2D3AC2] rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#2D3AC2] bg-white"
                        >
                            <option value="">Selecione um cargo</option>
                            <option value="vendedor">Vendedor</option>
                            <option value="projetista">Projetista</option>
                            <option value="gerente">Gerente</option>
                            <option value="diretor">Diretor</option>
                            <option value="financeiro">Financeiro</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Senha:</label>
                        <input
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={handleChange}
                            className="border border-[#2D3AC2] rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-[#2D3AC2]"
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <Button
                        onClick={handleCadastro}
                        disabled={loading}
                        className="bg-[#2D3AC2] hover:bg-[#232fa8] text-white py-3 rounded-lg mt-2"
                    >
                        {loading ? 'Cadastrando...' : 'Cadastrar'}
                    </Button>

                    <p className="text-center text-sm text-gray-500">
                        Já tem conta?{' '}
                        <Link to="/login" className="text-[#2D3AC2] font-medium hover:underline">
                            Fazer login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
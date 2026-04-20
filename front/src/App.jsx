import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import Projetos from './pages/Projetos'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/projetos" element={<Projetos />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
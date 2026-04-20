import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

const prisma = new PrismaClient();
const app = express();

// Permite requisições do frontend (ajustar a origin quando o frontend subir)
app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true // necessário para envio de cookies entre origens
}));
app.use(express.json());     // interpreta o body das requisições como JSON
app.use(cookieParser());     // permite ler cookies nas requisições


/**
 * POST /cadastro
 * Cria um novo usuário no banco de dados.
 * Valida os campos obrigatórios e armazena a senha com hash bcrypt.
 */
app.post('/cadastro', async (req, res) => {
    const { email, name, cargo, password } = req.body;

    // Validação dos campos obrigatórios
    if (!email || !name || !password) {
        return res.status(400).json({ message: 'Email, nome e senha são obrigatórios' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // 10 = custo do hash
        const user = await prisma.user.create({
            data: { email, name, cargo, password: hashedPassword }
        });
        res.status(201).json({ message: 'Cadastro recebido', user });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(400).json({ message: 'Erro ao cadastrar usuário' });
    }
});


/**
 * POST /login
 * Autentica o usuário com email e senha.
 * Em caso de sucesso, gera um JWT e o armazena em cookie httpOnly.
 */
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        // Gera o token JWT com o ID do usuário e validade de 1 hora
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Armazena o token em cookie seguro (httpOnly impede acesso via JavaScript)
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,        // HTTPS only (desative em desenvolvimento se necessário)
            sameSite: 'strict',  // proteção contra CSRF
            maxAge: 60 * 60 * 1000 // 1 hora em milissegundos
        });

        res.status(200).json({ message: 'Login bem-sucedido' });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
});


/**
 * POST /logout
 * Remove o cookie de autenticação, encerrando a sessão do usuário.
 */
app.post('/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
    res.status(200).json({ message: 'Logout realizado' });
});


/**
 * Middleware de autenticação.
 * Verifica se o token JWT está presente (via cookie ou header Authorization)
 * e injeta o userId no objeto req para uso nas rotas protegidas.
 */
function authMiddleware(req, res, next) {
    // Aceita token via cookie ou via header: Authorization: Bearer <token>
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acesso não autorizado' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId; // disponibiliza o ID nas rotas seguintes
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido ou expirado' });
    }
}


/**
 * GET /me
 * Retorna os dados do usuário autenticado.
 * Requer autenticação via authMiddleware.
 */
app.get('/me', authMiddleware, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true, cargo: true } // nunca retorna a senha
    });
    res.json(user);
});


/**
 * GET /usuarios
 * Lista todos os usuários ou filtra por name/email via query string.
 * Exemplo: GET /usuarios?name=João
 * Requer autenticação via authMiddleware.
 */
app.get('/usuarios', authMiddleware, async (req, res) => {
    let users = [];

    if (req.query.name || req.query.email) {
        // Busca por nome ou email usando OR
        users = await prisma.user.findMany({
            where: { OR: [{ name: req.query.name }, { email: req.query.email }] },
            select: { id: true, email: true, name: true, cargo: true }
        });
    } else {
        // Retorna todos os usuários
        users = await prisma.user.findMany({
            select: { id: true, email: true, name: true, cargo: true }
        });
    }

    res.status(200).json(users);
});


/**
 * PUT /usuarios/:id
 * Atualiza os dados do usuário autenticado.
 * Apenas o próprio usuário pode alterar seus dados.
 */
app.put('/usuarios/:id', authMiddleware, async (req, res) => {
    // Impede que um usuário edite dados de outro
    if (req.userId !== req.params.id) {
        return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
        await prisma.user.update({
            where: { id: req.params.id },
            data: { email: req.body.email, name: req.body.name, cargo: req.body.cargo }
        });
        res.status(200).json(req.body);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar usuário' });
    }
});


/**
 * DELETE /usuarios/:id
 * Remove o usuário autenticado do banco de dados.
 * Apenas o próprio usuário pode se deletar.
 */
app.delete('/usuarios/:id', authMiddleware, async (req, res) => {
    // Impede que um usuário delete outro
    if (req.userId !== req.params.id) {
        return res.status(403).json({ message: 'Acesso negado' });
    }

    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.status(200).json({ message: 'Usuário deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao deletar usuário' });
    }
});


app.listen(3001, () => console.log('Servidor rodando na porta 3001'));
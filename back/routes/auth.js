import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const isDev  = process.env.NODE_ENV !== 'production';


const limitadorLogin = rateLimit({
    windowMs:       60 * 1000,
    max:            10,
    standardHeaders: true,
    legacyHeaders:  false,
    message:        { message: 'Muitas tentativas de login. Aguarde 1 minuto.' },
});

router.post('/cadastro', async (req, res, next) => {
    const { email, name, cargo, password } = req.body;
    if (!email || !name || !password)
        return res.status(400).json({ message: 'Email, nome e senha são obrigatórios' });
    if (typeof email !== 'string' || !email.includes('@'))
        return res.status(400).json({ message: 'Email inválido' });
    if (typeof password !== 'string' || password.length < 6)
        return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres' });

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                name: name.trim(),
                cargo: cargo?.toLowerCase(),
                password: hashedPassword
            },
            select: { id: true, email: true, name: true, cargo: true }
        });
        res.status(201).json({ message: 'Cadastro realizado com sucesso', user });
    } catch (err) {
        if (err.code === 'P2002')
            return res.status(409).json({ message: 'Email já cadastrado' });
        next(err);
    }
});

router.post('/login', limitadorLogin, async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });

    try {
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
            select: { id: true, password: true }
        });

        if (!user) {
            await bcrypt.compare(password, '$2b$12$invalido.hash.para.evitar.timing.attack.xxxx');
            return res.status(401).json({ message: 'Email ou senha incorretos' });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: 'Email ou senha incorretos' });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: !isDev,
            sameSite: process.env.COOKIE_SAMESITE || (isDev ? 'lax' : 'strict'),
            maxAge: 8 * 60 * 60 * 1000
        });

        res.status(200).json({ message: 'Login bem-sucedido' });
    } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAMESITE || (isDev ? 'lax' : 'strict'),
    });
    res.status(200).json({ message: 'Logout realizado' });
});

router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { id: true, email: true, name: true, cargo: true }
        });
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
        res.json(user);
    } catch (err) { next(err); }
});

export default router;
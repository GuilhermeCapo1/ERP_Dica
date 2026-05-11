import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/usuarios', authMiddleware, async (req, res, next) => {
    try {
        const where = req.query.name || req.query.email
            ? { OR: [{ name: req.query.name }, { email: req.query.email }] }
            : {};
        const users = await prisma.user.findMany({
            where,
            select: { id: true, email: true, name: true, cargo: true }
        });
        res.status(200).json(users);
    } catch (err) { next(err); }
});

router.put('/usuarios/:id', authMiddleware, async (req, res, next) => {
    if (req.userId !== req.params.id)
        return res.status(403).json({ message: 'Acesso negado' });
    try {
        const { email, name, cargo } = req.body;
        await prisma.user.update({
            where: { id: req.params.id },
            data: { email, name, cargo }
        });
        res.status(200).json({ email, name, cargo });
    } catch (err) { next(err); }
});

router.delete('/usuarios/:id', authMiddleware, async (req, res, next) => {
    if (req.userId !== req.params.id)
        return res.status(403).json({ message: 'Acesso negado' });
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.status(200).json({ message: 'Usuário deletado com sucesso' });
    } catch (err) { next(err); }
});

export default router;
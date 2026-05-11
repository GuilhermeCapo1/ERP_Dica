import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/agencias', authMiddleware, async (req, res, next) => {
    try {
        const agencias = await prisma.agencia.findMany({
            include: {
                projetos: {
                    select: {
                        id: true, nome: true, cliente: true,
                        status: true, feira: true, local: true, criadoEm: true,
                        contratos: {
                            where:  { assinado: true },
                            select: { id: true, numero: true, assinadoEm: true },
                            take:   1,
                        }
                    },
                    orderBy: { criadoEm: 'desc' },
                }
            },
            orderBy: { nomeEmpresa: 'asc' },
        });
        res.json(agencias);
    } catch (err) { next(err); }
});

router.post('/agencias', authMiddleware, async (req, res, next) => {
    const { nomeEmpresa, cnpj, cpf, responsavel, telefone, email, endereco, cidade, estado, cep } = req.body;
    if (!nomeEmpresa?.trim()) return res.status(400).json({ message: 'Nome da agência é obrigatório' });
    try {
        const agencia = await prisma.agencia.create({
            data: { nomeEmpresa, cnpj, cpf, responsavel, telefone, email, endereco, cidade, estado, cep }
        });
        res.status(201).json(agencia);
    } catch (err) { next(err); }
});

router.put('/agencias/:id', authMiddleware, async (req, res, next) => {
    const { nomeEmpresa, cnpj, cpf, responsavel, telefone, email, endereco, cidade, estado, cep } = req.body;
    try {
        const agencia = await prisma.agencia.update({
            where: { id: req.params.id },
            data:  { nomeEmpresa, cnpj, cpf, responsavel, telefone, email, endereco, cidade, estado, cep }
        });
        res.json(agencia);
    } catch (err) { next(err); }
});

router.delete('/agencias/:id', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({
            where:  { id: req.userId },
            select: { cargo: true }
        });
        const isGestor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        if (!isGestor)
            return res.status(403).json({ message: 'Apenas gerente ou diretor pode excluir agências' });

        await prisma.$transaction([
            prisma.projeto.updateMany({ where: { agenciaId: req.params.id }, data: { agenciaId: null } }),
            prisma.agencia.delete({ where: { id: req.params.id } })
        ]);

        res.json({ message: 'Agência excluída com sucesso' });
    } catch (err) { next(err); }
});

export default router;
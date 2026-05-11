import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/projetos/:id/orcamentos', authMiddleware, async (req, res, next) => {
    try {
        const orcamentos = await prisma.orcamento.findMany({
            where:   { projetoId: req.params.id },
            include: {
                memorial: { select: { versao: true } },
                criadoPor: { select: { name: true } }
            },
            orderBy: { versao: 'desc' }
        });
        res.json(orcamentos);
    } catch (err) { next(err); }
});

router.get('/orcamentos/:id', authMiddleware, async (req, res, next) => {
    try {
        const orcamento = await prisma.orcamento.findUnique({
            where: { id: req.params.id },
            include: {
                projeto:  { select: { nome: true, cliente: true, feira: true, metragem: true, datas: true, local: true } },
                memorial: { select: { versao: true } },
                criadoPor: { select: { name: true } }
            }
        });
        if (!orcamento) return res.status(404).json({ message: 'Orçamento não encontrado' });
        res.json(orcamento);
    } catch (err) { next(err); }
});

router.post('/projetos/:id/orcamentos', authMiddleware, async (req, res, next) => {
    const { memorialId, itens, formaPagamento, vencimentos, cidade } = req.body;
    if (!memorialId) return res.status(400).json({ message: 'Memorial obrigatório' });

    try {
        const existe = await prisma.orcamento.findUnique({ where: { memorialId } });
        if (existe) return res.status(400).json({ message: 'Já existe orçamento para este memorial. Use PUT para editar.' });

        const ultimaVersao = await prisma.orcamento.findFirst({
            where:   { projetoId: req.params.id },
            orderBy: { versao: 'desc' },
            select:  { versao: true }
        });
        const proximaVersao = ultimaVersao ? ultimaVersao.versao + 1 : 1;

        const orcamento = await prisma.orcamento.create({
            data: {
                projetoId:     req.params.id,
                memorialId,
                versao:        proximaVersao,
                itens:         itens ? JSON.stringify(itens) : '[]',
                formaPagamento: formaPagamento || null,
                vencimentos:   vencimentos || null,
                cidade:        cidade || 'São Paulo',
                criadoPorId:   req.userId
            }
        });

        res.status(201).json(orcamento);
    } catch (err) { next(err); }
});

router.put('/orcamentos/:id', authMiddleware, async (req, res, next) => {
    const { itens, formaPagamento, vencimentos, cidade } = req.body;
    try {
        const orcamento = await prisma.orcamento.update({
            where: { id: req.params.id },
            data: {
                ...(itens          !== undefined && { itens: JSON.stringify(itens) }),
                ...(formaPagamento !== undefined && { formaPagamento }),
                ...(vencimentos    !== undefined && { vencimentos }),
                ...(cidade         !== undefined && { cidade }),
            }
        });
        res.json(orcamento);
    } catch (err) { next(err); }
});

router.patch('/orcamentos/:id/enviar', authMiddleware, async (req, res, next) => {
    try {
        const orcamento = await prisma.orcamento.update({
            where: { id: req.params.id },
            data:  { enviado: true, enviadoEm: new Date() }
        });
        await prisma.projeto.update({
            where: { id: orcamento.projetoId },
            data:  { status: 'Enviado' }
        });
        res.json(orcamento);
    } catch (err) { next(err); }
});

router.delete('/orcamentos/:id', authMiddleware, async (req, res, next) => {
    try {
        await prisma.orcamento.delete({ where: { id: req.params.id } });
        res.json({ message: 'Orçamento deletado com sucesso' });
    } catch (err) { next(err); }
});

export default router;
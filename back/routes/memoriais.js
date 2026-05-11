import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/projetos/:id/memoriais', authMiddleware, async (req, res, next) => {
    try {
        const memoriais = await prisma.memorial.findMany({
            where: { projetoId: req.params.id },
            include: {
                projeto: {
                    select: {
                        nome: true, cliente: true, feira: true,
                        metragem: true, datas: true, local: true,
                        imagensProjeto: { orderBy: { ordem: 'asc' } }
                    }
                },
                criadoPor: { select: { name: true } },
                orcamento: true
            },
            orderBy: { versao: 'desc' }
        });
        res.json(memoriais);
    } catch (err) { next(err); }
});

router.get('/memoriais/:id', authMiddleware, async (req, res, next) => {
    try {
        const memorial = await prisma.memorial.findUnique({
            where: { id: req.params.id },
            include: {
                projeto: {
                    select: {
                        nome: true, cliente: true, feira: true,
                        metragem: true, datas: true, local: true,
                        imagensProjeto: { orderBy: { ordem: 'asc' } }
                    }
                },
                criadoPor: { select: { name: true } },
                orcamento: true
            }
        });
        if (!memorial) return res.status(404).json({ message: 'Memorial não encontrado' });
        res.json(memorial);
    } catch (err) { next(err); }
});

router.post('/projetos/:id/memoriais', authMiddleware, async (req, res, next) => {
    const { piso, estrutura, areaAtendimento, audioVisual, comunicacaoVisual, eletrica, camposAtivos, ordemImagens } = req.body;
    try {
        const ultimaVersao = await prisma.memorial.findFirst({
            where:   { projetoId: req.params.id },
            orderBy: { versao: 'desc' },
            select:  { versao: true }
        });
        const proximaVersao = ultimaVersao ? ultimaVersao.versao + 1 : 1;

        const memorial = await prisma.memorial.create({
            data: {
                projetoId: req.params.id,
                versao:    proximaVersao,
                piso:              piso              || null,
                estrutura:         estrutura         || null,
                areaAtendimento:   areaAtendimento   || null,
                audioVisual:       audioVisual       || null,
                comunicacaoVisual: comunicacaoVisual || null,
                eletrica:          eletrica          || null,
                camposAtivos:  camposAtivos  ? JSON.stringify(camposAtivos)  : '["piso","estrutura","areaAtendimento","audioVisual","comunicacaoVisual","eletrica"]',
                ordemImagens:  ordemImagens  ? JSON.stringify(ordemImagens)  : '[]',
                criadoPorId: req.userId
            }
        });

        await prisma.projeto.update({
            where: { id: req.params.id },
            data:  { status: 'Precificação' }
        });

        res.status(201).json(memorial);
    } catch (err) { next(err); }
});

router.put('/memoriais/:id', authMiddleware, async (req, res, next) => {
    const { piso, estrutura, areaAtendimento, audioVisual, comunicacaoVisual, eletrica, camposAtivos, ordemImagens } = req.body;
    try {
        const memorial = await prisma.memorial.update({
            where: { id: req.params.id },
            data: {
                ...(piso              !== undefined && { piso }),
                ...(estrutura         !== undefined && { estrutura }),
                ...(areaAtendimento   !== undefined && { areaAtendimento }),
                ...(audioVisual       !== undefined && { audioVisual }),
                ...(comunicacaoVisual !== undefined && { comunicacaoVisual }),
                ...(eletrica          !== undefined && { eletrica }),
                ...(camposAtivos  && { camposAtivos:  JSON.stringify(camposAtivos) }),
                ...(ordemImagens  && { ordemImagens:  JSON.stringify(ordemImagens) }),
            }
        });
        res.json(memorial);
    } catch (err) { next(err); }
});

router.delete('/memoriais/:id', authMiddleware, async (req, res, next) => {
    try {
        await prisma.memorial.delete({ where: { id: req.params.id } });
        res.json({ message: 'Memorial deletado com sucesso' });
    } catch (err) { next(err); }
});

export default router;
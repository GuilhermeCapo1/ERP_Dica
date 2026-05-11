import { Router } from 'express';
import prisma from '../lib/prisma.js';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { upload, uploadImagens } from '../middleware/upload.js';

const router = Router();

// ── Projetistas ────────────────────────────────────────────────────────────
router.get('/projetistas', authMiddleware, async (req, res, next) => {
    try {
        const projetistas = await prisma.user.findMany({
            where: { cargo: { contains: 'projet', mode: 'insensitive' } },
            select: { id: true, name: true }
        });
        res.json(projetistas);
    } catch (err) { next(err); }
});

// ── Projetos ───────────────────────────────────────────────────────────────
router.get('/projetos/:id/detalhes', authMiddleware, async (req, res, next) => {
    try {
        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            include: {
                responsavel: { select: { id: true, name: true, cargo: true } },
                projetista:  { select: { id: true, name: true } },
                clienteRef:  true,
                imagensProjeto: { orderBy: { ordem: 'asc' } },
                memoriais: {
                    include: {
                        criadoPor: { select: { name: true } },
                        orcamento: { include: { criadoPor: { select: { name: true } } } }
                    },
                    orderBy: { versao: 'desc' }
                },
                orcamentos: {
                    include: {
                        memorial: { select: { versao: true } },
                        criadoPor: { select: { name: true } }
                    },
                    orderBy: { versao: 'desc' }
                }
            }
        });
        if (!projeto) return res.status(404).json({ message: 'Projeto não encontrado' });
        res.json(projeto);
    } catch (err) { next(err); }
});

router.get('/projetos', authMiddleware, async (req, res, next) => {
    try {
        const { status, responsavelId, cliente } = req.query;
        const where = {};
        if (status)        where.status = status;
        if (responsavelId) where.responsavelId = responsavelId;
        if (cliente)       where.cliente = { contains: cliente, mode: 'insensitive' };

        const projetos = await prisma.projeto.findMany({
            where,
            include: {
                responsavel:    { select: { id: true, name: true, cargo: true } },
                projetista:     { select: { id: true, name: true } },
                imagensProjeto: { orderBy: { ordem: 'asc' } },
                clienteRef:     true,
                agenciaRef:     true,
            },
            orderBy: { criadoEm: 'desc' }
        });
        res.json(projetos);
    } catch (err) { next(err); }
});

router.get('/meus-projetos', authMiddleware, async (req, res, next) => {
    try {
        const projetos = await prisma.projeto.findMany({
            where: { projetistaId: req.userId },
            include: {
                responsavel:    { select: { id: true, name: true } },
                imagensProjeto: { orderBy: { ordem: 'asc' } }
            },
            orderBy: { criadoEm: 'desc' }
        });
        res.json(projetos);
    } catch (err) { next(err); }
});

router.post('/projetos', authMiddleware, async (req, res, next) => {
    const { cliente, feira, metragem, datas, local, briefing, dataLimite, tipo } = req.body;
    if (!cliente || !feira || !metragem || !datas || !local)
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    try {
        const projeto = await prisma.projeto.create({
            data: {
                nome: `${cliente} - ${feira}`,
                cliente, feira, metragem, datas, local, briefing, tipo,
                dataLimite:    dataLimite ? new Date(dataLimite) : null,
                responsavelId: req.userId,
                status:        'Recebido'
            }
        });
        res.status(201).json(projeto);
    } catch (err) { next(err); }
});

router.put('/projetos/:id', authMiddleware, async (req, res, next) => {
    try {
        const { cliente, feira, metragem, datas, local, briefing, dataLimite, tipo } = req.body;
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data:  { cliente, feira, metragem, datas, local, briefing, dataLimite, tipo }
        });
        res.json(projeto);
    } catch (err) { next(err); }
});

router.patch('/projetos/:id/status', authMiddleware, async (req, res, next) => {
    const { status } = req.body;
    const statusValidos = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado', 'Reprovado'];
    if (!statusValidos.includes(status))
        return res.status(400).json({ message: 'Status inválido' });

    try {
        const [usuario, projetoAtual] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.userId }, select: { cargo: true } }),
            prisma.projeto.findUnique({ where: { id: req.params.id }, select: { status: true } })
        ]);

        const podeVoltarStatus = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        const ordemStatus = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado', 'Reprovado'];
        const ordemAtual  = ordemStatus.indexOf(projetoAtual?.status);
        const ordemNova   = ordemStatus.indexOf(status);

        if (ordemNova < ordemAtual && !podeVoltarStatus)
            return res.status(403).json({ message: 'Apenas gerente ou diretor pode voltar o status' });

        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data:  { status }
        });
        res.json(projeto);
    } catch (err) { next(err); }
});

router.patch('/projetos/:id/projetista', authMiddleware, async (req, res, next) => {
    const { projetistaId } = req.body;
    if (!projetistaId) return res.status(400).json({ message: 'ProjetistaId obrigatório' });
    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data:  { projetistaId, status: 'Em criação' }
        });
        res.json(projeto);
    } catch (err) { next(err); }
});

router.patch('/projetos/:id/agencia', authMiddleware, async (req, res, next) => {
    const { agenciaId } = req.body;
    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data:  { agenciaId: agenciaId || null }
        });
        res.json(projeto);
    } catch (err) { next(err); }
});

// ── Resultado / Aprovação ──────────────────────────────────────────────────
router.patch('/projetos/:id/resultado', authMiddleware, async (req, res, next) => {
    const {
        resultado,
        nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone,
        endereco, cidade, estado, cep, responsavel,
        formaPagamento, tipoDocumento, condicoesPagamento, observacoes,
        temAgencia, agenciaId, agenciaNova
    } = req.body;

    if (!['aprovado', 'reprovado'].includes(resultado))
        return res.status(400).json({ message: 'Resultado inválido' });

    try {
        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            select: { responsavelId: true, cliente: true }
        });
        if (!projeto) return res.status(404).json({ message: 'Projeto não encontrado' });
        if (projeto.responsavelId !== req.userId)
            return res.status(403).json({ message: 'Apenas o vendedor responsável pode marcar o resultado' });

        const projetoAtualizado = await prisma.$transaction(async (tx) => {
            let clienteId    = undefined;
            let agenciaFinal = undefined;

            if (resultado === 'aprovado' && nomeEmpresa) {
                const clienteExistente = cnpj ? await tx.cliente.findFirst({ where: { cnpj } }) : null;
                if (clienteExistente) {
                    await tx.cliente.update({
                        where: { id: clienteExistente.id },
                        data: { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel }
                    });
                    clienteId = clienteExistente.id;
                } else {
                    const novoCliente = await tx.cliente.create({
                        data: { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel }
                    });
                    clienteId = novoCliente.id;
                }

                if (temAgencia) {
                    if (agenciaId) {
                        agenciaFinal = agenciaId;
                    } else if (agenciaNova?.nomeEmpresa) {
                        const nova = await tx.agencia.create({
                            data: {
                                nomeEmpresa: agenciaNova.nomeEmpresa,
                                cnpj:        agenciaNova.cnpj        || null,
                                cpf:         agenciaNova.cpf         || null,
                                responsavel: agenciaNova.responsavel || null,
                                telefone:    agenciaNova.telefone    || null,
                                email:       agenciaNova.email       || null,
                                endereco:    agenciaNova.endereco    || null,
                                cidade:      agenciaNova.cidade      || null,
                                estado:      agenciaNova.estado      || null,
                                cep:         agenciaNova.cep         || null,
                            }
                        });
                        agenciaFinal = nova.id;
                    }
                }
            }

            let orcamentoAprovadoId = undefined;
            if (resultado === 'aprovado') {
                const orcAprovado = await tx.orcamento.findFirst({
                    where:   { projetoId: req.params.id, enviado: true },
                    orderBy: { versao: 'desc' },
                    select:  { id: true }
                });
                orcamentoAprovadoId = orcAprovado?.id;
            }

            return tx.projeto.update({
                where: { id: req.params.id },
                data: {
                    resultadoFinal: resultado,
                    status: resultado === 'aprovado' ? 'Aprovado' : 'Reprovado',
                    ...(clienteId    && { clienteId }),
                    ...(agenciaFinal && { agenciaId: agenciaFinal }),
                    ...(resultado === 'aprovado' && {
                        formaPagamento,
                        tipoDocumento,
                        condicoesPagamento,
                        observacoesAprovacao: observacoes,
                        ...(orcamentoAprovadoId && { orcamentoAprovadoId })
                    })
                }
            });
        });

        res.json(projetoAtualizado);
    } catch (err) { next(err); }
});

router.delete('/projetos/:id', authMiddleware, async (req, res, next) => {
    try {
        await prisma.projeto.delete({ where: { id: req.params.id } });
        res.json({ message: 'Projeto deletado com sucesso' });
    } catch (err) { next(err); }
});

// ── Arquivos do briefing ───────────────────────────────────────────────────
router.post('/projetos/:id/arquivos', authMiddleware, upload.fields([
    { name: 'manual',   maxCount: 1 },
    { name: 'mapa',     maxCount: 1 },
    { name: 'logos',    maxCount: 5 },
    { name: 'briefing', maxCount: 1 },
]), async (req, res, next) => {
    try {
        const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
        const projetoAtual = await prisma.projeto.findUnique({
            where:  { id: req.params.id },
            select: { arquivos: true }
        });
        const arquivosAtuais = (projetoAtual?.arquivos && typeof projetoAtual.arquivos === 'object')
            ? projetoAtual.arquivos : {};
        const arquivos = { ...arquivosAtuais };

        if (req.files?.manual?.[0])  { const f = req.files.manual[0];  arquivos.manual  = { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` }; }
        if (req.files?.mapa?.[0])    { const f = req.files.mapa[0];    arquivos.mapa    = { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` }; }
        if (req.files?.briefing?.[0]){ const f = req.files.briefing[0];arquivos.briefing= { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` }; }
        if (req.files?.logos?.length) {
            arquivos.logos = req.files.logos.map(f => ({ nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` }));
        }

        await prisma.projeto.update({ where: { id: req.params.id }, data: { arquivos } });
        res.json({ message: 'Arquivos enviados com sucesso', arquivos });
    } catch (err) { next(err); }
});

// ── Imagens do projeto ────────────────────────────────────────────────────
router.post('/projetos/:id/imagens', authMiddleware, uploadImagens.array('imagens', 20), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0)
            return res.status(400).json({ message: 'Nenhuma imagem enviada' });

        const ultimaOrdem = await prisma.imagemProjeto.findFirst({
            where:   { projetoId: req.params.id },
            orderBy: { ordem: 'desc' },
            select:  { ordem: true }
        });
        let ordemBase = ultimaOrdem ? ultimaOrdem.ordem + 1 : 0;

        const imagens = await Promise.all(
            req.files.map((file, index) =>
                prisma.imagemProjeto.create({
                    data: {
                        projetoId: req.params.id,
                        filename:  file.filename,
                        url:       `/uploads/projeto/${file.filename}`,
                        ordem:     ordemBase + index
                    }
                })
            )
        );

        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id }, select: { status: true }
        });
        if (projeto?.status === 'Em criação') {
            await prisma.projeto.update({ where: { id: req.params.id }, data: { status: 'Memorial' } });
        }

        res.status(201).json({ message: 'Imagens enviadas com sucesso', imagens });
    } catch (err) { next(err); }
});

router.get('/projetos/:id/imagens', authMiddleware, async (req, res, next) => {
    try {
        const imagens = await prisma.imagemProjeto.findMany({
            where:   { projetoId: req.params.id },
            orderBy: { ordem: 'asc' }
        });
        res.json(imagens);
    } catch (err) { next(err); }
});

router.patch('/projetos/:id/imagens/ordem', authMiddleware, async (req, res, next) => {
    const { ordens } = req.body;
    if (!Array.isArray(ordens)) return res.status(400).json({ message: 'Ordens deve ser um array' });
    try {
        await Promise.all(ordens.map(({ id, ordem }) =>
            prisma.imagemProjeto.update({ where: { id }, data: { ordem } })
        ));
        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch (err) { next(err); }
});

router.delete('/projetos/:projetoId/imagens/:imagemId', authMiddleware, async (req, res, next) => {
    try {
        const imagem = await prisma.imagemProjeto.findUnique({
            where: { id: req.params.imagemId }, select: { filename: true }
        });
        if (!imagem) return res.status(404).json({ message: 'Imagem não encontrada' });

        const caminho = path.join('./uploads/projeto', path.basename(imagem.filename));
        if (fs.existsSync(caminho)) fs.unlinkSync(caminho);

        await prisma.imagemProjeto.delete({ where: { id: req.params.imagemId } });
        res.json({ message: 'Imagem deletada com sucesso' });
    } catch (err) { next(err); }
});

export default router;
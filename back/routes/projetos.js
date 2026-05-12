import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma.js';
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

// ── Detalhes de um projeto ────────────────────────────────────────────────
router.get('/projetos/:id/detalhes', authMiddleware, async (req, res, next) => {
    try {
        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            include: {
                responsavel:    { select: { id: true, name: true, cargo: true } },
                projetista:     { select: { id: true, name: true } },
                clienteRef:     true,
                agenciaRef:     true,
                imagensProjeto: { orderBy: { ordem: 'asc' } },
                revisoes:       { orderBy: { versao: 'asc' } },
                memoriais: {
                    include: {
                        criadoPor:      { select: { name: true } },
                        imagensProjeto: { orderBy: { ordem: 'asc' } },
                        orcamento:      { include: { criadoPor: { select: { name: true } } } }
                    },
                    orderBy: { versao: 'desc' }
                },
                orcamentos: {
                    include: {
                        memorial:  { select: { versao: true } },
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

// ── Lista projetos ─────────────────────────────────────────────────────────
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

// ── Meus projetos (projetista) — com memoriais e revisões ─────────────────
router.get('/meus-projetos', authMiddleware, async (req, res, next) => {
    try {
        const projetos = await prisma.projeto.findMany({
            where: { projetistaId: req.userId },
            include: {
                responsavel:    { select: { id: true, name: true } },
                imagensProjeto: { orderBy: { ordem: 'asc' } },
                // Memoriais para o projetista saber para qual versão subir imagens
                memoriais: {
                    select: { id: true, versao: true, criadoEm: true },
                    orderBy: { versao: 'desc' }
                },
                // Histórico de revisões solicitadas pelo cliente
                revisoes: {
                    orderBy: { versao: 'asc' }
                }
            },
            orderBy: { criadoEm: 'desc' }
        });
        res.json(projetos);
    } catch (err) { next(err); }
});

// ── Criar projeto ──────────────────────────────────────────────────────────
router.post('/projetos', authMiddleware, async (req, res, next) => {
    const { cliente, feira, metragem, datas, local, briefing, dataLimite, tipo } = req.body;
    if (!cliente || !feira || !metragem || !datas || !local)
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    try {
        const projeto = await prisma.projeto.create({
            data: {
                nome:          `${cliente} - ${feira}`,
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

// ── Atualizar status ───────────────────────────────────────────────────────
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
        const ordemStatus      = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado', 'Reprovado'];
        const ordemAtual       = ordemStatus.indexOf(projetoAtual?.status);
        const ordemNova        = ordemStatus.indexOf(status);

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

// ── Registrar resultado ────────────────────────────────────────────────────
// resultado: 'aprovado' | 'reprovado' | 'nova_versao'
router.patch('/projetos/:id/resultado', authMiddleware, async (req, res, next) => {
    const {
        resultado,
        // Dados do cliente (só em aprovado)
        nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone,
        endereco, cidade, estado, cep, responsavel,
        // Condições (só em aprovado)
        formaPagamento, tipoDocumento, condicoesPagamento, observacoes,
        // Agência (só em aprovado)
        temAgencia, agenciaId, agenciaNova,
        // Instruções de revisão (só em nova_versao)
        instrucoes,
    } = req.body;

    if (!['aprovado', 'reprovado', 'nova_versao'].includes(resultado))
        return res.status(400).json({ message: 'Resultado inválido' });

    try {
        const projeto = await prisma.projeto.findUnique({
            where:  { id: req.params.id },
            select: { responsavelId: true, cliente: true }
        });
        if (!projeto) return res.status(404).json({ message: 'Projeto não encontrado' });

        // Vendedor responsável, gerente ou diretor podem registrar resultado
        const usuario = await prisma.user.findUnique({
            where:  { id: req.userId },
            select: { cargo: true }
        });
        const podeRegistrar = projeto.responsavelId === req.userId ||
            ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        if (!podeRegistrar)
            return res.status(403).json({ message: 'Sem permissão para registrar o resultado' });

        // ── Nova versão ────────────────────────────────────────────────────
        if (resultado === 'nova_versao') {
            if (!instrucoes?.trim())
                return res.status(400).json({ message: 'Instruções de revisão são obrigatórias' });

            const projetoAtualizado = await prisma.$transaction(async (tx) => {
                // Conta quantas revisões já existem para gerar o número da versão
                const totalRevisoes = await tx.revisaoProjeto.count({
                    where: { projetoId: req.params.id }
                });

                // Cria registro de revisão
                await tx.revisaoProjeto.create({
                    data: {
                        projetoId:   req.params.id,
                        versao:      totalRevisoes + 1,
                        instrucoes:  instrucoes.trim(),
                        criadoPorId: req.userId,
                    }
                });

                // Encontra a próxima versão do memorial
                const ultimaVersaoMemorial = await tx.memorial.findFirst({
                    where:   { projetoId: req.params.id },
                    orderBy: { versao: 'desc' },
                    select:  { versao: true }
                });
                const proximaVersaoMemorial = ultimaVersaoMemorial ? ultimaVersaoMemorial.versao + 1 : 1;

                // Cria novo memorial vazio para a próxima versão
                await tx.memorial.create({
                    data: {
                        projetoId:    req.params.id,
                        versao:       proximaVersaoMemorial,
                        piso:         null,
                        estrutura:    null,
                        areaAtendimento:   null,
                        audioVisual:       null,
                        comunicacaoVisual: null,
                        eletrica:     null,
                        camposAtivos: '["piso","estrutura","areaAtendimento","audioVisual","comunicacaoVisual","eletrica"]',
                        ordemImagens: '[]',
                        criadoPorId:  req.userId
                    }
                });

                // Volta o projeto para "Em criação" — projetista já está alocado
                return tx.projeto.update({
                    where: { id: req.params.id },
                    data:  { status: 'Em criação', resultadoFinal: null }
                });
            });

            return res.json(projetoAtualizado);
        }

        // ── Reprovado ──────────────────────────────────────────────────────
        if (resultado === 'reprovado') {
            const projetoAtualizado = await prisma.projeto.update({
                where: { id: req.params.id },
                data:  { resultadoFinal: 'reprovado', status: 'Reprovado' }
            });
            return res.json(projetoAtualizado);
        }

        // ── Aprovado ───────────────────────────────────────────────────────
        const projetoAtualizado = await prisma.$transaction(async (tx) => {
            let clienteId    = undefined;
            let agenciaFinal = undefined;

            if (nomeEmpresa) {
                const clienteExistente = cnpj
                    ? await tx.cliente.findFirst({ where: { cnpj } })
                    : null;

                if (clienteExistente) {
                    await tx.cliente.update({
                        where: { id: clienteExistente.id },
                        data:  { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel }
                    });
                    clienteId = clienteExistente.id;
                } else {
                    const novo = await tx.cliente.create({
                        data: { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel }
                    });
                    clienteId = novo.id;
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

            // Identifica o orçamento aprovado (o mais recente enviado)
            const orcAprovado = await tx.orcamento.findFirst({
                where:   { projetoId: req.params.id, enviado: true },
                orderBy: { versao: 'desc' },
                select:  { id: true }
            });

            return tx.projeto.update({
                where: { id: req.params.id },
                data: {
                    resultadoFinal: 'aprovado',
                    status:         'Aprovado',
                    ...(clienteId    && { clienteId }),
                    ...(agenciaFinal && { agenciaId: agenciaFinal }),
                    formaPagamento,
                    tipoDocumento,
                    condicoesPagamento,
                    observacoesAprovacao: observacoes,
                    ...(orcAprovado && { orcamentoAprovadoId: orcAprovado.id })
                }
            });
        });

        res.json(projetoAtualizado);
    } catch (err) { next(err); }
});

// ── Deletar projeto ────────────────────────────────────────────────────────
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

        if (req.files?.manual?.[0])   { const f = req.files.manual[0];   arquivos.manual   = { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` }; }
        if (req.files?.mapa?.[0])     { const f = req.files.mapa[0];     arquivos.mapa     = { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` }; }
        if (req.files?.briefing?.[0]) { const f = req.files.briefing[0]; arquivos.briefing = { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` }; }
        if (req.files?.logos?.length) {
            arquivos.logos = req.files.logos.map(f => ({ nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` }));
        }

        await prisma.projeto.update({ where: { id: req.params.id }, data: { arquivos } });
        res.json({ message: 'Arquivos enviados com sucesso', arquivos });
    } catch (err) { next(err); }
});

// ── Imagens do projeto ─────────────────────────────────────────────────────
// POST aceita memorialId opcional no FormData para vincular à versão
router.post('/projetos/:id/imagens', authMiddleware, uploadImagens.array('imagens', 20), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0)
            return res.status(400).json({ message: 'Nenhuma imagem enviada' });

        const memorialId = req.body.memorialId || null;

        // Valida que o memorial pertence ao projeto, se informado
        if (memorialId) {
            const memorialExiste = await prisma.memorial.findFirst({
                where:  { id: memorialId, projetoId: req.params.id },
                select: { id: true }
            });
            if (!memorialExiste)
                return res.status(400).json({ message: 'Memorial não encontrado neste projeto' });
        }

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
                        projetoId:  req.params.id,
                        memorialId: memorialId || null,
                        filename:   file.filename,
                        url:        `/uploads/projeto/${file.filename}`,
                        ordem:      ordemBase + index
                    }
                })
            )
        );

        // Atualiza status só se ainda estiver em "Em criação"
        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id }, select: { status: true }
        });
        if (projeto?.status === 'Em criação') {
            await prisma.projeto.update({ where: { id: req.params.id }, data: { status: 'Memorial' } });
        }

        res.status(201).json({ message: 'Imagens enviadas com sucesso', imagens });
    } catch (err) { next(err); }
});

// GET aceita ?memorialId=xxx para filtrar por versão do memorial
router.get('/projetos/:id/imagens', authMiddleware, async (req, res, next) => {
    try {
        const where = { projetoId: req.params.id };
        if (req.query.memorialId) where.memorialId = req.query.memorialId;

        const imagens = await prisma.imagemProjeto.findMany({
            where,
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
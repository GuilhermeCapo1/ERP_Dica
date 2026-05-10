import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { tmpdir } from 'os';
import fs from 'fs';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router     = Router();
const prisma     = new PrismaClient();
const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// O gerarContrato.js está na raiz do projeto (um nível acima de routes/)
const SCRIPT_PATH = join(__dirname, '..', 'gerarContrato.js');

// ── Contratos de um projeto específico ────────────────────────────────────
router.get('/projetos/:id/contratos', authMiddleware, async (req, res, next) => {
    try {
        const contratos = await prisma.contrato.findMany({
            where:   { projetoId: req.params.id },
            include: {
                criadoPor: { select: { name: true } },
                projeto: {
                    select: {
                        id: true, nome: true, cliente: true, feira: true,
                        datas: true, local: true, metragem: true,
                        clienteRef: true,
                        agenciaRef: true,
                    }
                }
            },
            orderBy: { criadoEm: 'desc' },
        });
        res.json(contratos);
    } catch (err) { next(err); }
});

// ── Lista todos os contratos ───────────────────────────────────────────────
router.get('/contratos', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({ where: { id: req.userId } });
        const cargo   = usuario?.cargo?.toLowerCase();
        const where   = ['gerente', 'diretor', 'financeiro'].includes(cargo)
            ? {}
            : { projeto: { responsavelId: req.userId } };

        const contratos = await prisma.contrato.findMany({
            where,
            include: {
                projeto: {
                    select: {
                        id: true, nome: true, cliente: true, feira: true,
                        datas: true, local: true, metragem: true,
                        formaPagamento: true, tipoDocumento: true,
                        condicoesPagamento: true, observacoesAprovacao: true,
                        status: true,
                        clienteRef: true,
                        agenciaRef: true,
                        memoriais:  { orderBy: { versao: 'desc' }, take: 1 },
                        orcamentos: { orderBy: { versao: 'desc' }, take: 1 },
                    }
                },
                criadoPor: { select: { name: true } },
            },
            orderBy: { criadoEm: 'desc' },
        });
        res.json(contratos);
    } catch (err) { next(err); }
});

// ── Cria contrato ─────────────────────────────────────────────────────────
router.post('/projetos/:id/contratos', authMiddleware, async (req, res, next) => {
    const { numero } = req.body;
    try {
        const projeto = await prisma.projeto.findUnique({ where: { id: req.params.id } });
        if (!projeto) return res.status(404).json({ message: 'Projeto não encontrado' });
        if (projeto.status !== 'Aprovado')
            return res.status(400).json({ message: 'Contrato só pode ser criado para projetos aprovados' });

        const contrato = await prisma.contrato.create({
            data: { projetoId: req.params.id, numero: numero || null, criadoPorId: req.userId }
        });
        res.status(201).json(contrato);
    } catch (err) { next(err); }
});

// ── Atualiza número + testemunhas ─────────────────────────────────────────
router.patch('/contratos/:id', authMiddleware, async (req, res, next) => {
    const { numero, testemunha1Nome, testemunha1Cpf, testemunha2Nome, testemunha2Cpf } = req.body;
    try {
        const contrato = await prisma.contrato.update({
            where: { id: req.params.id },
            data: {
                ...(numero          !== undefined && { numero }),
                ...(testemunha1Nome !== undefined && { testemunha1Nome }),
                ...(testemunha1Cpf  !== undefined && { testemunha1Cpf }),
                ...(testemunha2Nome !== undefined && { testemunha2Nome }),
                ...(testemunha2Cpf  !== undefined && { testemunha2Cpf }),
            },
        });
        res.json(contrato);
    } catch (err) { next(err); }
});

// ── Marcar como assinado ──────────────────────────────────────────────────
router.patch('/contratos/:id/assinar', authMiddleware, async (req, res, next) => {
    try {
        const contrato = await prisma.contrato.update({
            where: { id: req.params.id },
            data:  { assinado: true, assinadoEm: new Date() },
        });
        res.json(contrato);
    } catch (err) { next(err); }
});

// ── Download do .docx ─────────────────────────────────────────────────────
router.get('/contratos/:id/download', authMiddleware, async (req, res, next) => {
    try {
        const contrato = await prisma.contrato.findUnique({
            where: { id: req.params.id },
            include: {
                projeto: {
                    include: {
                        clienteRef: true,
                        agenciaRef: true,
                        memoriais:  { orderBy: { versao: 'desc' }, take: 1 },
                        orcamentos: { orderBy: { versao: 'desc' }, take: 1 },
                    }
                }
            }
        });

        if (!contrato) return res.status(404).json({ message: 'Contrato não encontrado' });

        const projeto   = contrato.projeto;
        const cliente   = projeto.clienteRef;
        const agencia   = projeto.agenciaRef  || null;
        const memorial  = projeto.memoriais?.[0]  || null;
        const orcamento = projeto.orcamentos?.[0] || null;

        const dados = {
            nome:      projeto.nome,
            feira:     projeto.feira,
            datas:     projeto.datas,
            local:     projeto.local,
            metragem:  projeto.metragem,

            nomeEmpresa:  cliente?.nomeEmpresa  || projeto.cliente,
            nomeFantasia: cliente?.nomeFantasia  || null,
            cnpj:         cliente?.cnpj          || null,
            cpf:          cliente?.cpf           || null,
            endereco:     cliente?.endereco      || null,
            cidade:       cliente?.cidade        || null,
            estado:       cliente?.estado        || null,
            cep:          cliente?.cep           || null,
            responsavel:  cliente?.responsavel   || null,

            formaPagamento:       projeto.formaPagamento,
            tipoDocumento:        projeto.tipoDocumento,
            condicoesPagamento:   projeto.condicoesPagamento,
            observacoesAprovacao: projeto.observacoesAprovacao,

            numeroContrato: contrato.numero || '___/____',

            agencia: agencia ? {
                nomeEmpresa: agencia.nomeEmpresa,
                cnpj:        agencia.cnpj        || null,
                cpf:         agencia.cpf         || null,
                responsavel: agencia.responsavel || null,
                endereco:    agencia.endereco    || null,
                cidade:      agencia.cidade      || null,
                estado:      agencia.estado      || null,
                cep:         agencia.cep         || null,
            } : null,

            testemunha1Nome: contrato.testemunha1Nome || null,
            testemunha1Cpf:  contrato.testemunha1Cpf  || null,
            testemunha2Nome: contrato.testemunha2Nome || null,
            testemunha2Cpf:  contrato.testemunha2Cpf  || null,

            memorial: memorial ? {
                camposAtivos:      memorial.camposAtivos,
                piso:              memorial.piso,
                estrutura:         memorial.estrutura,
                areaAtendimento:   memorial.areaAtendimento,
                audioVisual:       memorial.audioVisual,
                comunicacaoVisual: memorial.comunicacaoVisual,
                eletrica:          memorial.eletrica,
            } : null,

            orcamento: orcamento ? {
                itens:          orcamento.itens,
                formaPagamento: orcamento.formaPagamento,
                vencimentos:    orcamento.vencimentos,
            } : null,

            dataGeracao: new Date().toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric'
            }),
        };

        const outputPath = join(tmpdir(), `contrato_${contrato.id}_${Date.now()}.docx`);
        await execFileAsync('node', [SCRIPT_PATH, outputPath, JSON.stringify(dados)]);

        const nomeArquivo = `Contrato_${(projeto.cliente || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().getFullYear()}.docx`;
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        res.sendFile(resolve(outputPath), (err) => {
            fs.unlink(outputPath, () => {});
        });
    } catch (err) { next(err); }
});

// ── Deletar contrato ──────────────────────────────────────────────────────
router.delete('/contratos/:id', authMiddleware, async (req, res, next) => {
    try {
        await prisma.contrato.delete({ where: { id: req.params.id } });
        res.json({ message: 'Contrato deletado' });
    } catch (err) { next(err); }
});

export default router;
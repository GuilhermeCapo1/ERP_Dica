import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const prisma = new PrismaClient();
const app = express();
const isDev = process.env.NODE_ENV !== 'production';

// ══════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE OBRIGATÓRIAS
// ══════════════════════════════════════════════════════════════════════════
const requiredEnv = ['JWT_SECRET'];
for (const key of requiredEnv) {
    if (!process.env[key] && !isDev) {
        console.error(`FATAL: Variável de ambiente ${key} não definida.`);
        process.exit(1);
    }
}
// Em desenvolvimento, usa fallback seguro para não travar o servidor
if (!process.env.JWT_SECRET && isDev) {
    process.env.JWT_SECRET = 'dev-secret-inseguro-na-producao';
    console.warn('⚠️  JWT_SECRET não definido, usando fallback inseguro.');
}

// ══════════════════════════════════════════════════════════════════════════
// SEGURANÇA — HEADERS, CORS, RATE LIMIT
// ══════════════════════════════════════════════════════════════════════════

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const origemPermitida = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
    origin: origemPermitida,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const limitadorGeral = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas requisições. Tente novamente em breve.' },
});
app.use(limitadorGeral);

const limitadorLogin = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas tentativas de login. Aguarde 1 minuto.' },
});

// ══════════════════════════════════════════════════════════════════════════
// UPLOADS — VALIDAÇÃO MIME + EXTENSÃO + NOME SEGURO
// ══════════════════════════════════════════════════════════════════════════

const uploadDir = './uploads';
const uploadProjetoDir = './uploads/projeto';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(uploadProjetoDir)) fs.mkdirSync(uploadProjetoDir, { recursive: true });

const MIME_BRIEFING = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/pdf': '.pdf',
};
const MIME_IMAGENS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
};

function nomeSeguro(extensao) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return `${unique}${extensao}`;
}

const storageBriefing = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = MIME_BRIEFING[file.mimetype] || path.extname(file.originalname).toLowerCase();
        cb(null, nomeSeguro(ext));
    }
});

const storageImagens = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadProjetoDir),
    filename: (req, file, cb) => {
        const ext = MIME_IMAGENS[file.mimetype] || '.jpg';
        cb(null, nomeSeguro(ext));
    }
});

function filtrarBriefing(req, file, cb) {
    const mimeOk = Object.keys(MIME_BRIEFING).includes(file.mimetype);
    const extOk = /\.(jpeg|jpg|png|pdf)$/i.test(path.extname(file.originalname));
    if (mimeOk && extOk) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG ou PDF.'));
}

function filtrarImagens(req, file, cb) {
    const mimeOk = Object.keys(MIME_IMAGENS).includes(file.mimetype);
    const extOk = /\.(jpeg|jpg|png)$/i.test(path.extname(file.originalname));
    if (mimeOk && extOk) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Use JPG ou PNG.'));
}

const upload = multer({
    storage: storageBriefing,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: filtrarBriefing,
});

const uploadImagens = multer({
    storage: storageImagens,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: filtrarImagens,
});

// ══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICAÇÃO
// ══════════════════════════════════════════════════════════════════════════

function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Acesso não autorizado' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.userId || typeof decoded.userId !== 'string') {
            return res.status(401).json({ message: 'Token inválido' });
        }
        req.userId = decoded.userId;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' });
        }
        res.status(401).json({ message: 'Token inválido' });
    }
}

// ══════════════════════════════════════════════════════════════════════════
// AUTENTICAÇÃO
// ══════════════════════════════════════════════════════════════════════════

app.post('/cadastro', async (req, res, next) => {
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
            data: { email: email.toLowerCase().trim(), name: name.trim(), cargo: cargo?.toLowerCase(), password: hashedPassword },
            select: { id: true, email: true, name: true, cargo: true }
        });
        res.status(201).json({ message: 'Cadastro realizado com sucesso', user });
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ message: 'Email já cadastrado' });
        }
        next(err);
    }
});

app.post('/login', limitadorLogin, async (req, res, next) => {
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
    } catch (err) {
        next(err);
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAMESITE || (isDev ? 'lax' : 'strict'),
    });
    res.status(200).json({ message: 'Logout realizado' });
});

app.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { id: true, email: true, name: true, cargo: true }
        });
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
        res.json(user);
    } catch (err) {
        next(err);
    }
});

// ══════════════════════════════════════════════════════════════════════════
// USUÁRIOS
// ══════════════════════════════════════════════════════════════════════════

app.get('/usuarios', authMiddleware, async (req, res, next) => {
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

app.put('/usuarios/:id', authMiddleware, async (req, res, next) => {
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

app.delete('/usuarios/:id', authMiddleware, async (req, res, next) => {
    if (req.userId !== req.params.id)
        return res.status(403).json({ message: 'Acesso negado' });
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.status(200).json({ message: 'Usuário deletado com sucesso' });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// PROJETOS
// ══════════════════════════════════════════════════════════════════════════

app.get('/projetistas', authMiddleware, async (req, res, next) => {
    try {
        const projetistas = await prisma.user.findMany({
            where: { cargo: { contains: 'projet', mode: 'insensitive' } },
            select: { id: true, name: true }
        });
        res.json(projetistas);
    } catch (err) { next(err); }
});

app.get('/projetos/:id/detalhes', authMiddleware, async (req, res, next) => {
    try {
        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            include: {
                responsavel: { select: { id: true, name: true, cargo: true } },
                projetista: { select: { id: true, name: true } },
                clienteRef: true,
                imagensProjeto: { orderBy: { ordem: 'asc' } },
                memoriais: {
                    include: {
                        criadoPor: { select: { name: true } },
                        orcamento: {
                            include: { criadoPor: { select: { name: true } } }
                        }
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

app.get('/projetos', authMiddleware, async (req, res, next) => {
    try {
        const { status, responsavelId, cliente } = req.query;
        const where = {};
        if (status) where.status = status;
        if (responsavelId) where.responsavelId = responsavelId;
        if (cliente) where.cliente = { contains: cliente, mode: 'insensitive' };

        const projetos = await prisma.projeto.findMany({
            where,
            include: {
                responsavel: { select: { id: true, name: true, cargo: true } },
                projetista: { select: { id: true, name: true } },
                imagensProjeto: { orderBy: { ordem: 'asc' } },
                clienteRef: true
            },
            orderBy: { criadoEm: 'desc' }
        });
        res.json(projetos);
    } catch (err) { next(err); }
});

app.get('/meus-projetos', authMiddleware, async (req, res, next) => {
    try {
        const projetos = await prisma.projeto.findMany({
            where: { projetistaId: req.userId },
            include: {
                responsavel: { select: { id: true, name: true } },
                imagensProjeto: { orderBy: { ordem: 'asc' } }
            },
            orderBy: { criadoEm: 'desc' }
        });
        res.json(projetos);
    } catch (err) { next(err); }
});

app.post('/projetos', authMiddleware, async (req, res, next) => {
    const { cliente, feira, metragem, datas, local, briefing, dataLimite, tipo } = req.body;
    if (!cliente || !feira || !metragem || !datas || !local)
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    try {
        const projeto = await prisma.projeto.create({
            data: {
                nome: `${cliente} - ${feira}`,
                cliente, feira, metragem, datas, local, briefing, tipo,
                dataLimite: dataLimite ? new Date(dataLimite) : null,
                responsavelId: req.userId,
                status: 'Recebido'
            }
        });
        res.status(201).json(projeto);
    } catch (err) { next(err); }
});

app.put('/projetos/:id', authMiddleware, async (req, res, next) => {
    try {
        const { cliente, feira, metragem, datas, local, briefing, dataLimite, tipo } = req.body;
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: { cliente, feira, metragem, datas, local, briefing, dataLimite, tipo }
        });
        res.json(projeto);
    } catch (err) { next(err); }
});

app.patch('/projetos/:id/status', authMiddleware, async (req, res, next) => {
    const { status, justificativa } = req.body;
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
        const ordemAtual = ordemStatus.indexOf(projetoAtual?.status);
        const ordemNova = ordemStatus.indexOf(status);

        if (ordemNova < ordemAtual && !podeVoltarStatus)
            return res.status(403).json({ message: 'Apenas gerente ou diretor pode voltar o status' });

        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.json(projeto);
    } catch (err) { next(err); }
});

app.patch('/projetos/:id/projetista', authMiddleware, async (req, res, next) => {
    const { projetistaId } = req.body;
    if (!projetistaId) return res.status(400).json({ message: 'ProjetistaId obrigatório' });
    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: { projetistaId, status: 'Em criação' }
        });
        res.json(projeto);
    } catch (err) { next(err); }
});

// ── Retorna projetos de uma agência específica ─────────────────────────────
app.get('/projetos/:id/contratos', authMiddleware, async (req, res, next) => {
    try {
        const contratos = await prisma.contrato.findMany({
            where: { projetoId: req.params.id },
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

// ══════════════════════════════════════════════════════════════════════════
// RESULTADO DO PROJETO (APROVAÇÃO) – VERSÃO CORRETA COM AGÊNCIA
// ══════════════════════════════════════════════════════════════════════════
app.patch('/projetos/:id/resultado', authMiddleware, async (req, res, next) => {
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

        // Utilizamos transação para garantir consistência entre cliente, agência e projeto
        const projetoAtualizado = await prisma.$transaction(async (tx) => {
            let clienteId = undefined;
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
                                cnpj: agenciaNova.cnpj || null,
                                cpf: agenciaNova.cpf || null,
                                responsavel: agenciaNova.responsavel || null,
                                telefone: agenciaNova.telefone || null,
                                email: agenciaNova.email || null,
                                endereco: agenciaNova.endereco || null,
                                cidade: agenciaNova.cidade || null,
                                estado: agenciaNova.estado || null,
                                cep: agenciaNova.cep || null,
                            }
                        });
                        agenciaFinal = nova.id;
                    }
                }
            }

            let orcamentoAprovadoId = undefined;
            if (resultado === 'aprovado') {
                const orcamentoAprovado = await tx.orcamento.findFirst({
                    where: { projetoId: req.params.id, enviado: true },
                    orderBy: { versao: 'desc' },
                    select: { id: true }
                });
                orcamentoAprovadoId = orcamentoAprovado?.id;
            }

            return await tx.projeto.update({
                where: { id: req.params.id },
                data: {
                    resultadoFinal: resultado,
                    status: resultado === 'aprovado' ? 'Aprovado' : 'Reprovado',
                    ...(clienteId && { clienteId }),
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

app.delete('/projetos/:id', authMiddleware, async (req, res, next) => {
    try {
        await prisma.projeto.delete({ where: { id: req.params.id } });
        res.json({ message: 'Projeto deletado com sucesso' });
    } catch (err) { next(err); }
});

app.post('/projetos/:id/arquivos', authMiddleware, upload.fields([
    { name: 'manual', maxCount: 1 },
    { name: 'mapa', maxCount: 1 },
    { name: 'logos', maxCount: 5 },
    { name: 'briefing', maxCount: 1 },
]), async (req, res, next) => {
    try {
        const BASE_URL = process.env.BASE_URL || `http://localhost:3001`;
        const projetoAtual = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            select: { arquivos: true }
        });
        const arquivosAtuais = (projetoAtual?.arquivos && typeof projetoAtual.arquivos === 'object')
            ? projetoAtual.arquivos : {};
        const arquivos = { ...arquivosAtuais };

        if (req.files?.manual?.[0]) {
            const f = req.files.manual[0];
            arquivos.manual = { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` };
        }
        if (req.files?.mapa?.[0]) {
            const f = req.files.mapa[0];
            arquivos.mapa = { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` };
        }
        if (req.files?.briefing?.[0]) {
            const f = req.files.briefing[0];
            arquivos.briefing = { nome: f.originalname, url: `${BASE_URL}/uploads/${f.filename}` };
        }
        if (req.files?.logos?.length) {
            arquivos.logos = req.files.logos.map(f => ({
                nome: f.originalname,
                url: `${BASE_URL}/uploads/${f.filename}`
            }));
        }

        await prisma.projeto.update({
            where: { id: req.params.id },
            data: { arquivos }
        });
        res.json({ message: 'Arquivos enviados com sucesso', arquivos });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// IMAGENS DO PROJETO
// ══════════════════════════════════════════════════════════════════════════

app.post('/projetos/:id/imagens', authMiddleware, uploadImagens.array('imagens', 20), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0)
            return res.status(400).json({ message: 'Nenhuma imagem enviada' });

        const ultimaOrdem = await prisma.imagemProjeto.findFirst({
            where: { projetoId: req.params.id },
            orderBy: { ordem: 'desc' },
            select: { ordem: true }
        });
        let ordemBase = ultimaOrdem ? ultimaOrdem.ordem + 1 : 0;

        const imagens = await Promise.all(
            req.files.map((file, index) =>
                prisma.imagemProjeto.create({
                    data: {
                        projetoId: req.params.id,
                        filename: file.filename,
                        url: `/uploads/projeto/${file.filename}`,
                        ordem: ordemBase + index
                    }
                })
            )
        );

        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            select: { status: true }
        });
        if (projeto?.status === 'Em criação') {
            await prisma.projeto.update({
                where: { id: req.params.id },
                data: { status: 'Memorial' }
            });
        }

        res.status(201).json({ message: 'Imagens enviadas com sucesso', imagens });
    } catch (err) { next(err); }
});

app.get('/projetos/:id/imagens', authMiddleware, async (req, res, next) => {
    try {
        const imagens = await prisma.imagemProjeto.findMany({
            where: { projetoId: req.params.id },
            orderBy: { ordem: 'asc' }
        });
        res.json(imagens);
    } catch (err) { next(err); }
});

app.patch('/projetos/:id/imagens/ordem', authMiddleware, async (req, res, next) => {
    const { ordens } = req.body;
    if (!Array.isArray(ordens)) return res.status(400).json({ message: 'Ordens deve ser um array' });
    try {
        await Promise.all(ordens.map(({ id, ordem }) =>
            prisma.imagemProjeto.update({ where: { id }, data: { ordem } })
        ));
        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch (err) { next(err); }
});

app.delete('/projetos/:projetoId/imagens/:imagemId', authMiddleware, async (req, res, next) => {
    try {
        const imagem = await prisma.imagemProjeto.findUnique({
            where: { id: req.params.imagemId },
            select: { filename: true }
        });
        if (!imagem) return res.status(404).json({ message: 'Imagem não encontrada' });

        const filename = path.basename(imagem.filename);
        const caminho = path.join('./uploads/projeto', filename);
        if (fs.existsSync(caminho)) fs.unlinkSync(caminho);

        await prisma.imagemProjeto.delete({ where: { id: req.params.imagemId } });
        res.json({ message: 'Imagem deletada com sucesso' });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// MEMORIAL
// ══════════════════════════════════════════════════════════════════════════

app.get('/projetos/:id/memoriais', authMiddleware, async (req, res, next) => {
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

app.get('/memoriais/:id', authMiddleware, async (req, res, next) => {
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

app.post('/projetos/:id/memoriais', authMiddleware, async (req, res, next) => {
    const { piso, estrutura, areaAtendimento, audioVisual, comunicacaoVisual, eletrica, camposAtivos, ordemImagens } = req.body;
    try {
        const ultimaVersao = await prisma.memorial.findFirst({
            where: { projetoId: req.params.id },
            orderBy: { versao: 'desc' },
            select: { versao: true }
        });
        const proximaVersao = ultimaVersao ? ultimaVersao.versao + 1 : 1;

        const memorial = await prisma.memorial.create({
            data: {
                projetoId: req.params.id,
                versao: proximaVersao,
                piso: piso || null,
                estrutura: estrutura || null,
                areaAtendimento: areaAtendimento || null,
                audioVisual: audioVisual || null,
                comunicacaoVisual: comunicacaoVisual || null,
                eletrica: eletrica || null,
                camposAtivos: camposAtivos ? JSON.stringify(camposAtivos) : '["piso","estrutura","areaAtendimento","audioVisual","comunicacaoVisual","eletrica"]',
                ordemImagens: ordemImagens ? JSON.stringify(ordemImagens) : '[]',
                criadoPorId: req.userId
            }
        });

        await prisma.projeto.update({
            where: { id: req.params.id },
            data: { status: 'Precificação' }
        });

        res.status(201).json(memorial);
    } catch (err) { next(err); }
});

app.put('/memoriais/:id', authMiddleware, async (req, res, next) => {
    const { piso, estrutura, areaAtendimento, audioVisual, comunicacaoVisual, eletrica, camposAtivos, ordemImagens } = req.body;
    try {
        const memorial = await prisma.memorial.update({
            where: { id: req.params.id },
            data: {
                ...(piso !== undefined && { piso }),
                ...(estrutura !== undefined && { estrutura }),
                ...(areaAtendimento !== undefined && { areaAtendimento }),
                ...(audioVisual !== undefined && { audioVisual }),
                ...(comunicacaoVisual !== undefined && { comunicacaoVisual }),
                ...(eletrica !== undefined && { eletrica }),
                ...(camposAtivos && { camposAtivos: JSON.stringify(camposAtivos) }),
                ...(ordemImagens && { ordemImagens: JSON.stringify(ordemImagens) }),
            }
        });
        res.json(memorial);
    } catch (err) { next(err); }
});

app.delete('/memoriais/:id', authMiddleware, async (req, res, next) => {
    try {
        await prisma.memorial.delete({ where: { id: req.params.id } });
        res.json({ message: 'Memorial deletado com sucesso' });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// ORÇAMENTO
// ══════════════════════════════════════════════════════════════════════════

app.get('/projetos/:id/orcamentos', authMiddleware, async (req, res, next) => {
    try {
        const orcamentos = await prisma.orcamento.findMany({
            where: { projetoId: req.params.id },
            include: {
                memorial: { select: { versao: true } },
                criadoPor: { select: { name: true } }
            },
            orderBy: { versao: 'desc' }
        });
        res.json(orcamentos);
    } catch (err) { next(err); }
});

app.get('/orcamentos/:id', authMiddleware, async (req, res, next) => {
    try {
        const orcamento = await prisma.orcamento.findUnique({
            where: { id: req.params.id },
            include: {
                projeto: { select: { nome: true, cliente: true, feira: true, metragem: true, datas: true, local: true } },
                memorial: { select: { versao: true } },
                criadoPor: { select: { name: true } }
            }
        });
        if (!orcamento) return res.status(404).json({ message: 'Orçamento não encontrado' });
        res.json(orcamento);
    } catch (err) { next(err); }
});

app.post('/projetos/:id/orcamentos', authMiddleware, async (req, res, next) => {
    const { memorialId, itens, formaPagamento, vencimentos, cidade } = req.body;
    if (!memorialId) return res.status(400).json({ message: 'Memorial obrigatório' });

    try {
        const existe = await prisma.orcamento.findUnique({ where: { memorialId } });
        if (existe) return res.status(400).json({ message: 'Já existe orçamento para este memorial. Use PUT para editar.' });

        const ultimaVersao = await prisma.orcamento.findFirst({
            where: { projetoId: req.params.id },
            orderBy: { versao: 'desc' },
            select: { versao: true }
        });
        const proximaVersao = ultimaVersao ? ultimaVersao.versao + 1 : 1;

        const orcamento = await prisma.orcamento.create({
            data: {
                projetoId: req.params.id,
                memorialId,
                versao: proximaVersao,
                itens: itens ? JSON.stringify(itens) : '[]',
                formaPagamento: formaPagamento || null,
                vencimentos: vencimentos || null,
                cidade: cidade || 'São Paulo',
                criadoPorId: req.userId
            }
        });

        res.status(201).json(orcamento);
    } catch (err) { next(err); }
});

app.put('/orcamentos/:id', authMiddleware, async (req, res, next) => {
    const { itens, formaPagamento, vencimentos, cidade } = req.body;
    try {
        const orcamento = await prisma.orcamento.update({
            where: { id: req.params.id },
            data: {
                ...(itens !== undefined && { itens: JSON.stringify(itens) }),
                ...(formaPagamento !== undefined && { formaPagamento }),
                ...(vencimentos !== undefined && { vencimentos }),
                ...(cidade !== undefined && { cidade }),
            }
        });
        res.json(orcamento);
    } catch (err) { next(err); }
});

app.patch('/orcamentos/:id/enviar', authMiddleware, async (req, res, next) => {
    try {
        const orcamento = await prisma.orcamento.update({
            where: { id: req.params.id },
            data: { enviado: true, enviadoEm: new Date() }
        });
        await prisma.projeto.update({
            where: { id: orcamento.projetoId },
            data: { status: 'Enviado' }
        });
        res.json(orcamento);
    } catch (err) { next(err); }
});

app.delete('/orcamentos/:id', authMiddleware, async (req, res, next) => {
    try {
        await prisma.orcamento.delete({ where: { id: req.params.id } });
        res.json({ message: 'Orçamento deletado com sucesso' });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════════════════

app.get('/clientes', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { cargo: true }
        });
        const isGestorOuDiretor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());

        if (isGestorOuDiretor) {
            const clientes = await prisma.cliente.findMany({
                include: {
                    projetos: {
                        select: { id: true, nome: true, status: true, criadoEm: true, feira: true, local: true },
                        orderBy: { criadoEm: 'desc' }
                    }
                },
                orderBy: { nomeEmpresa: 'asc' }
            });
            return res.json(clientes.map(c => ({ ...c, proprio: true })));
        }

        const todosClientes = await prisma.cliente.findMany({
            include: {
                projetos: {
                    select: {
                        id: true, nome: true, status: true, criadoEm: true,
                        feira: true, local: true, responsavelId: true,
                        responsavel: { select: { name: true } }
                    },
                    orderBy: { criadoEm: 'desc' }
                }
            },
            orderBy: { nomeEmpresa: 'asc' }
        });

        const resposta = todosClientes.map(cliente => {
            const proprio = cliente.projetos.some(p => p.responsavelId === req.userId);
            if (proprio) {
                const projetosProprios = cliente.projetos.filter(p => p.responsavelId === req.userId);
                return { ...cliente, projetos: projetosProprios, proprio: true };
            }
            const vendedor = cliente.projetos[0]?.responsavel?.name || null;
            return {
                id: cliente.id,
                nomeEmpresa: cliente.nomeEmpresa,
                vendedorNome: vendedor,
                proprio: false,
            };
        });

        res.json(resposta);
    } catch (err) { next(err); }
});

app.get('/clientes/:id', authMiddleware, async (req, res, next) => {
    try {
        const cliente = await prisma.cliente.findUnique({
            where: { id: req.params.id },
            include: {
                projetos: {
                    select: { id: true, nome: true, status: true, criadoEm: true, feira: true, local: true },
                    orderBy: { criadoEm: 'desc' }
                }
            }
        });
        if (!cliente) return res.status(404).json({ message: 'Cliente não encontrado' });
        res.json(cliente);
    } catch (err) { next(err); }
});

app.put('/clientes/:id', authMiddleware, async (req, res, next) => {
    const { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel } = req.body;
    try {
        const [usuario, cliente] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.userId }, select: { cargo: true } }),
            prisma.cliente.findUnique({
                where: { id: req.params.id },
                include: { projetos: { select: { responsavelId: true } } }
            })
        ]);
        if (!cliente) return res.status(404).json({ message: 'Cliente não encontrado' });

        const isGestor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        const isVendedorDoCliente = cliente.projetos.some(p => p.responsavelId === req.userId);
        if (!isGestor && !isVendedorDoCliente)
            return res.status(403).json({ message: 'Sem permissão para editar este cliente' });

        const atualizado = await prisma.cliente.update({
            where: { id: req.params.id },
            data: { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel }
        });
        res.json(atualizado);
    } catch (err) { next(err); }
});

// Exclusão de cliente — com transação para não deixar projetos órfãos
app.delete('/clientes/:id', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { cargo: true }
        });
        const isGestor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        if (!isGestor)
            return res.status(403).json({ message: 'Apenas gerente ou diretor pode excluir clientes' });

        await prisma.$transaction([
            prisma.projeto.updateMany({
                where: { clienteId: req.params.id },
                data: { clienteId: null }
            }),
            prisma.cliente.delete({ where: { id: req.params.id } })
        ]);

        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// CONTRATOS (VERSÕES CORRETAS, SEM DUPLICATAS)
// ══════════════════════════════════════════════════════════════════════════

app.get('/projetos/:id/contratos', authMiddleware, async (req, res, next) => {
    try {
        const contratos = await prisma.contrato.findMany({
            where: { projetoId: req.params.id },
            include: { criadoPor: { select: { name: true } } },
            orderBy: { criadoEm: 'desc' },
        });
        res.json(contratos);
    } catch (err) { next(err); }
});

app.get('/contratos', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({ where: { id: req.userId } });
        const cargo = usuario?.cargo?.toLowerCase();
        const where = ['gerente', 'diretor', 'financeiro'].includes(cargo)
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
                        agenciaRef: true,   // ← ESTA LINHA ESTAVA FALTANDO
                        memoriais: { orderBy: { versao: 'desc' }, take: 1 },
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

app.post('/projetos/:id/contratos', authMiddleware, async (req, res, next) => {
    const { numero } = req.body;
    try {
        const projeto = await prisma.projeto.findUnique({ where: { id: req.params.id } });
        if (!projeto) return res.status(404).json({ message: 'Projeto não encontrado' });
        if (projeto.status !== 'Aprovado') return res.status(400).json({ message: 'Contrato só pode ser criado para projetos aprovados' });

        const contrato = await prisma.contrato.create({
            data: {
                projetoId: req.params.id,
                numero: numero || null,
                criadoPorId: req.userId,
            }
        });
        res.status(201).json(contrato);
    } catch (err) { next(err); }
});

// PATCH /contratos/:id — versão completa com testemunhas (removeu a duplicata simples)
app.patch('/contratos/:id', authMiddleware, async (req, res, next) => {
    const { numero, testemunha1Nome, testemunha1Cpf, testemunha2Nome, testemunha2Cpf } = req.body;
    try {
        const contrato = await prisma.contrato.update({
            where: { id: req.params.id },
            data: {
                ...(numero !== undefined && { numero }),
                ...(testemunha1Nome !== undefined && { testemunha1Nome }),
                ...(testemunha1Cpf !== undefined && { testemunha1Cpf }),
                ...(testemunha2Nome !== undefined && { testemunha2Nome }),
                ...(testemunha2Cpf !== undefined && { testemunha2Cpf }),
            },
        });
        res.json(contrato);
    } catch (err) { next(err); }
});

app.patch('/contratos/:id/assinar', authMiddleware, async (req, res, next) => {
    try {
        const contrato = await prisma.contrato.update({
            where: { id: req.params.id },
            data: { assinado: true, assinadoEm: new Date() },
        });
        res.json(contrato);
    } catch (err) { next(err); }
});

// GET /contratos/:id/download — versão completa com agência e testemunhas
app.get('/contratos/:id/download', authMiddleware, async (req, res, next) => {
    try {
        const contrato = await prisma.contrato.findUnique({
            where: { id: req.params.id },
            include: {
                projeto: {
                    include: {
                        clienteRef: true,
                        agenciaRef: true,
                        memoriais: { orderBy: { versao: 'desc' }, take: 1 },
                        orcamentos: { orderBy: { versao: 'desc' }, take: 1 },
                    }
                }
            }
        });

        if (!contrato) return res.status(404).json({ message: 'Contrato não encontrado' });

        const projeto = contrato.projeto;
        const cliente = projeto.clienteRef;
        const agencia = projeto.agenciaRef || null;
        const memorial = projeto.memoriais?.[0] || null;
        const orcamento = projeto.orcamentos?.[0] || null;

        const dados = {
            nome: projeto.nome,
            feira: projeto.feira,
            datas: projeto.datas,
            local: projeto.local,
            metragem: projeto.metragem,

            nomeEmpresa: cliente?.nomeEmpresa || projeto.cliente,
            nomeFantasia: cliente?.nomeFantasia || null,
            cnpj: cliente?.cnpj || null,
            cpf: cliente?.cpf || null,
            endereco: cliente?.endereco || null,
            cidade: cliente?.cidade || null,
            estado: cliente?.estado || null,
            cep: cliente?.cep || null,
            responsavel: cliente?.responsavel || null,

            formaPagamento: projeto.formaPagamento,
            tipoDocumento: projeto.tipoDocumento,
            condicoesPagamento: projeto.condicoesPagamento,
            observacoesAprovacao: projeto.observacoesAprovacao,

            numeroContrato: contrato.numero || '___/____',

            agencia: agencia ? {
                nomeEmpresa: agencia.nomeEmpresa,
                cnpj: agencia.cnpj || null,
                cpf: agencia.cpf || null,
                responsavel: agencia.responsavel || null,
                endereco: agencia.endereco || null,
                cidade: agencia.cidade || null,
                estado: agencia.estado || null,
                cep: agencia.cep || null,
            } : null,

            testemunha1Nome: contrato.testemunha1Nome || null,
            testemunha1Cpf: contrato.testemunha1Cpf || null,
            testemunha2Nome: contrato.testemunha2Nome || null,
            testemunha2Cpf: contrato.testemunha2Cpf || null,

            memorial: memorial ? {
                camposAtivos: memorial.camposAtivos,
                piso: memorial.piso,
                estrutura: memorial.estrutura,
                areaAtendimento: memorial.areaAtendimento,
                audioVisual: memorial.audioVisual,
                comunicacaoVisual: memorial.comunicacaoVisual,
                eletrica: memorial.eletrica,
            } : null,

            orcamento: orcamento ? {
                itens: orcamento.itens,
                formaPagamento: orcamento.formaPagamento,
                vencimentos: orcamento.vencimentos,
            } : null,

            dataGeracao: new Date().toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric'
            }),
        };

        const scriptPath = join(__dirname, 'gerarContrato.js');
        const outputPath = join(tmpdir(), `contrato_${contrato.id}_${Date.now()}.docx`);

        await execFileAsync('node', [scriptPath, outputPath, JSON.stringify(dados)]);

        const nomeArquivo = `Contrato_${(projeto.cliente || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().getFullYear()}.docx`;
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        res.sendFile(resolve(outputPath), (err) => {
            fs.unlink(outputPath, () => { });
        });
    } catch (err) { next(err); }
});

app.delete('/contratos/:id', authMiddleware, async (req, res, next) => {
    try {
        await prisma.contrato.delete({ where: { id: req.params.id } });
        res.json({ message: 'Contrato deletado' });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// AGÊNCIAS
// ══════════════════════════════════════════════════════════════════════════

app.get('/agencias', authMiddleware, async (req, res, next) => {
    try {
        const agencias = await prisma.agencia.findMany({
            include: {
                projetos: {
                    select: {
                        id: true, nome: true, cliente: true,
                        status: true, feira: true, local: true, criadoEm: true,
                    },
                    orderBy: { criadoEm: 'desc' },
                }
            },
            orderBy: { nomeEmpresa: 'asc' },
        });
        res.json(agencias);
    } catch (err) { next(err); }
});

app.post('/agencias', authMiddleware, async (req, res, next) => {
    const { nomeEmpresa, cnpj, cpf, responsavel, telefone, email, endereco, cidade, estado, cep } = req.body;
    if (!nomeEmpresa?.trim()) return res.status(400).json({ message: 'Nome da agência é obrigatório' });
    try {
        const agencia = await prisma.agencia.create({
            data: { nomeEmpresa, cnpj, cpf, responsavel, telefone, email, endereco, cidade, estado, cep }
        });
        res.status(201).json(agencia);
    } catch (err) { next(err); }
});

app.put('/agencias/:id', authMiddleware, async (req, res, next) => {
    const { nomeEmpresa, cnpj, cpf, responsavel, telefone, email, endereco, cidade, estado, cep } = req.body;
    try {
        const agencia = await prisma.agencia.update({
            where: { id: req.params.id },
            data: { nomeEmpresa, cnpj, cpf, responsavel, telefone, email, endereco, cidade, estado, cep }
        });
        res.json(agencia);
    } catch (err) { next(err); }
});

app.delete('/agencias/:id', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { cargo: true }
        });
        const isGestor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        if (!isGestor)
            return res.status(403).json({ message: 'Apenas gerente ou diretor pode excluir agências' });

        await prisma.$transaction([
            prisma.projeto.updateMany({
                where: { agenciaId: req.params.id },
                data: { agenciaId: null }
            }),
            prisma.agencia.delete({ where: { id: req.params.id } })
        ]);

        res.json({ message: 'Agência excluída com sucesso' });
    } catch (err) { next(err); }
});

app.patch('/projetos/:id/agencia', authMiddleware, async (req, res, next) => {
    const { agenciaId } = req.body;
    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: { agenciaId: agenciaId || null }
        });
        res.json(projeto);
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// ARQUIVOS ESTÁTICOS
// ══════════════════════════════════════════════════════════════════════════

app.use('/uploads', express.static('uploads', {
    dotfiles: 'deny',
    index: false,
    etag: true,
    maxAge: '7d',  // seguro porque os nomes de arquivo são únicos (timestamp + random)
}));

// ══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE GLOBAL DE ERRO — sempre o último
// ══════════════════════════════════════════════════════════════════════════

app.use((err, req, res, next) => {
    if (err.name === 'MulterError') {
        const mensagens = {
            LIMIT_FILE_SIZE: 'Arquivo muito grande. Tamanho máximo: 20MB.',
            LIMIT_FILE_COUNT: 'Número máximo de arquivos excedido.',
            LIMIT_UNEXPECTED_FILE: 'Campo de arquivo inesperado.',
        };
        return res.status(400).json({ message: mensagens[err.code] || 'Erro no upload do arquivo.' });
    }

    if (err.message?.includes('não permitido') || err.message?.includes('permitidos')) {
        return res.status(400).json({ message: err.message });
    }

    if (!isDev) {
        console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
        return res.status(500).json({ message: 'Erro interno no servidor' });
    }

    console.error(err);
    res.status(500).json({ message: err.message, stack: err.stack });
});

// ══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ══════════════════════════════════════════════════════════════════════════
process.on('SIGTERM', async () => {
    console.log('Sinal SIGTERM recebido, fechando conexões...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Sinal SIGINT recebido, fechando conexões...');
    await prisma.$disconnect();
    process.exit(0);
});

app.listen(3001, () => console.log(`Servidor rodando na porta 3001 [${isDev ? 'dev' : 'produção'}]`));
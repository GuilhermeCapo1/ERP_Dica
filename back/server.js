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
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

const prisma = new PrismaClient();
const app = express();
const isDev = process.env.NODE_ENV !== 'production';

// ══════════════════════════════════════════════════════════════════════════
// SEGURANÇA — HEADERS, CORS, RATE LIMIT
// ══════════════════════════════════════════════════════════════════════════

// Helmet — define headers de segurança HTTP automaticamente
// crossOriginResourcePolicy: false permite servir imagens de /uploads para o frontend
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — aceita apenas a origem do frontend; em produção troca pela URL real
const origemPermitida = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
    origin: origemPermitida,
    credentials: true,                    // necessário para enviar cookies JWT
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser — limite de 1mb para JSON (uploads usam multipart, não JSON)
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Rate limit geral — 200 req/min por IP (proteção contra abuso)
const limitadorGeral = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas requisições. Tente novamente em breve.' },
});
app.use(limitadorGeral);

// Rate limit específico para login — 10 tentativas/min por IP (anti brute-force)
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

// Extensões e MIMEs permitidos por tipo de upload
const MIME_BRIEFING = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/pdf': '.pdf',
};
const MIME_IMAGENS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
};

// Gera nome seguro sem caracteres especiais ou path traversal
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

// Valida MIME E extensão — dupla checagem para evitar bypass
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
    limits: { fileSize: 20 * 1024 * 1024 },   // 20MB por arquivo
    fileFilter: filtrarBriefing,
});

const uploadImagens = multer({
    storage: storageImagens,
    limits: { fileSize: 20 * 1024 * 1024 },   // 20MB por arquivo
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
        // Garante que o payload tem a estrutura esperada
        if (!decoded?.userId || typeof decoded.userId !== 'string') {
            return res.status(401).json({ message: 'Token inválido' });
        }
        req.userId = decoded.userId;
        next();
    } catch (err) {
        // Distingue token expirado de token inválido sem expor detalhes internos
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

    // Validações básicas de formato
    if (typeof email !== 'string' || !email.includes('@'))
        return res.status(400).json({ message: 'Email inválido' });
    if (typeof password !== 'string' || password.length < 6)
        return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres' });

    try {
        const hashedPassword = await bcrypt.hash(password, 12); // 12 rounds em produção
        const user = await prisma.user.create({
            data: { email: email.toLowerCase().trim(), name: name.trim(), cargo: cargo?.toLowerCase(), password: hashedPassword },
            select: { id: true, email: true, name: true, cargo: true } // nunca retorna password
        });
        res.status(201).json({ message: 'Cadastro realizado com sucesso', user });
    } catch (err) {
        // Código P2002 = unique constraint violation no Prisma (email duplicado)
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
            select: { id: true, password: true } // busca só o necessário
        });

        // Mensagem genérica para não revelar se o email existe ou não
        if (!user) {
            await bcrypt.compare(password, '$2b$12$invalido.hash.para.evitar.timing.attack.xxxx');
            return res.status(401).json({ message: 'Email ou senha incorretos' });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: 'Email ou senha incorretos' });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });

        // Em produção: secure: true (HTTPS obrigatório)
        // Em dev: secure: false para funcionar sem HTTPS
        res.cookie('token', token, {
            httpOnly: true,
            secure: !isDev,
            sameSite: isDev ? 'lax' : 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 horas
        });

        res.status(200).json({ message: 'Login bem-sucedido' });
    } catch (err) {
        next(err);
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, sameSite: isDev ? 'lax' : 'strict' });
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
        const { email, name, cargo } = req.body; // desestrutura para evitar mass assignment
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

// Detalhes completos de um projeto — usado na página de revisão pelo cliente
app.get('/projetos/:id/detalhes', authMiddleware, async (req, res, next) => {
    try {
        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            include: {
                responsavel:   { select: { id: true, name: true, cargo: true } },
                projetista:    { select: { id: true, name: true } },
                clienteRef:    true,
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
                        memorial:  { select: { versao: true } },
                        criadoPor: { select: { name: true } }
                    },
                    orderBy: { versao: 'desc' }
                }
            }
        })
        if (!projeto) return res.status(404).json({ message: 'Projeto não encontrado' })
        res.json(projeto)
    } catch (err) { next(err) }
})

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
        // Desestrutura para evitar que o cliente sobrescreva campos sensíveis
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

app.patch('/projetos/:id/resultado', authMiddleware, async (req, res, next) => {
    const {
        resultado,
        nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone,
        endereco, cidade, estado, cep, responsavel,
        formaPagamento, tipoDocumento, condicoesPagamento, observacoes
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

        let clienteId = undefined;

        if (resultado === 'aprovado' && nomeEmpresa) {
            const clienteExistente = cnpj
                ? await prisma.cliente.findFirst({ where: { cnpj } })
                : null;

            if (clienteExistente) {
                await prisma.cliente.update({
                    where: { id: clienteExistente.id },
                    data: { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel }
                });
                clienteId = clienteExistente.id;
            } else {
                const novoCliente = await prisma.cliente.create({
                    data: { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel }
                });
                clienteId = novoCliente.id;
            }
        }

        // Busca o orçamento aprovado — maior versão com enviado: true
        let orcamentoAprovadoId = undefined
        if (resultado === 'aprovado') {
            const orcamentoAprovado = await prisma.orcamento.findFirst({
                where: { projetoId: req.params.id, enviado: true },
                orderBy: { versao: 'desc' },
                select: { id: true }
            })
            orcamentoAprovadoId = orcamentoAprovado?.id
        }

        const projetoAtualizado = await prisma.projeto.update({
            where: { id: req.params.id },
            data: {
                resultadoFinal: resultado,
                status: resultado === 'aprovado' ? 'Aprovado' : 'Reprovado',
                ...(clienteId && { clienteId }),
                ...(resultado === 'aprovado' && {
                    formaPagamento,
                    tipoDocumento,
                    condicoesPagamento,
                    observacoesAprovacao: observacoes,
                    ...(orcamentoAprovadoId && { orcamentoAprovadoId })
                })
            }
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
    { name: 'manual',   maxCount: 1 },
    { name: 'mapa',     maxCount: 1 },
    { name: 'logos',    maxCount: 5 },
    { name: 'briefing', maxCount: 1 },
]), async (req, res, next) => {
    try {
        const BASE_URL = process.env.BASE_URL || `http://localhost:3001`;

        // Busca arquivos já existentes para não sobrescrever os que não foram reenviados
        const projetoAtual = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            select: { arquivos: true }
        });
        const arquivosAtuais = (projetoAtual?.arquivos && typeof projetoAtual.arquivos === 'object')
            ? projetoAtual.arquivos
            : {};

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

        // Salva como Json nativo — sem JSON.stringify
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

        // Muda status para "Memorial" automaticamente ao enviar primeira imagem
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

        // Garante que o path não tem traversal (../ etc)
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
            // Gerente/Diretor — vê todos os clientes com dados completos
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

        // Vendedor — busca todos os clientes para montar a lista completa
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
            // Verifica se ao menos um projeto do cliente pertence a este vendedor
            const proprio = cliente.projetos.some(p => p.responsavelId === req.userId);

            if (proprio) {
                // Retorna dados completos — filtra projetos só os do vendedor
                const projetosProprios = cliente.projetos.filter(p => p.responsavelId === req.userId);
                return {
                    ...cliente,
                    projetos: projetosProprios,
                    proprio: true,
                };
            }

            // Retorna apenas nome e vendedor responsável — sem dados sensíveis
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
        // Vendedor só pode editar se for responsável por ao menos um projeto deste cliente
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

// Exclusão de cliente — apenas gerente e diretor
app.delete('/clientes/:id', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { cargo: true }
        });
        const isGestor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        if (!isGestor)
            return res.status(403).json({ message: 'Apenas gerente ou diretor pode excluir clientes' });

        // Remove vínculo dos projetos antes de deletar (evita erro de FK)
        await prisma.projeto.updateMany({
            where: { clienteId: req.params.id },
            data: { clienteId: null }
        });

        await prisma.cliente.delete({ where: { id: req.params.id } });
        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// ARQUIVOS ESTÁTICOS
// ══════════════════════════════════════════════════════════════════════════

// Serve imagens de uploads com headers de segurança — sem directory listing
app.use('/uploads', express.static('uploads', {
    dotfiles: 'deny',       // bloqueia arquivos ocultos
    index: false,           // desativa directory listing
    etag: true,
}));

// ══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE GLOBAL DE ERRO — sempre o último
// ══════════════════════════════════════════════════════════════════════════

// Erros de multer (upload) — retorna 400 com mensagem amigável
app.use((err, req, res, next) => {
    if (err.name === 'MulterError') {
        const mensagens = {
            LIMIT_FILE_SIZE: 'Arquivo muito grande. Tamanho máximo: 20MB.',
            LIMIT_FILE_COUNT: 'Número máximo de arquivos excedido.',
            LIMIT_UNEXPECTED_FILE: 'Campo de arquivo inesperado.',
        };
        return res.status(400).json({ message: mensagens[err.code] || 'Erro no upload do arquivo.' });
    }

    // Erros de validação de tipo de arquivo (lançados pelo fileFilter)
    if (err.message?.includes('não permitido') || err.message?.includes('permitidos')) {
        return res.status(400).json({ message: err.message });
    }

    // Em produção: loga o erro internamente mas não expõe detalhes ao cliente
    if (!isDev) {
        console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
        return res.status(500).json({ message: 'Erro interno no servidor' });
    }

    // Em dev: retorna detalhes para facilitar debug
    console.error(err);
    res.status(500).json({ message: err.message, stack: err.stack });
});

// ══════════════════════════════════════════════════════════════════════════
// CONTRATO
// Adicionar após os imports, junto com os outros imports do topo:
//   import { execFile } from 'child_process';
//   import { promisify } from 'util';
//   const execFileAsync = promisify(execFile);
// ══════════════════════════════════════════════════════════════════════════

// GET /projetos/:id/contrato — gera e faz download do contrato .docx
app.get('/projetos/:id/contrato', authMiddleware, async (req, res) => {
    try {
        // Busca projeto com todas as relações necessárias
        const projeto = await prisma.projeto.findUnique({
            where: { id: req.params.id },
            include: {
                clienteRef: true,
                memoriais: {
                    orderBy: { versao: 'desc' },
                    take: 1,                          // pega o memorial mais recente
                    include: { orcamento: true }
                },
                orcamentos: {
                    orderBy: { versao: 'desc' },
                    take: 1                           // pega o orçamento mais recente
                },
            }
        });

        if (!projeto) return res.status(404).json({ message: 'Projeto não encontrado' });
        if (projeto.status !== 'Aprovado') return res.status(400).json({ message: 'Contrato só pode ser gerado para projetos aprovados' });

        const cliente = projeto.clienteRef;
        const memorial = projeto.memoriais?.[0] || null;
        const orcamento = projeto.orcamentos?.[0] || null;

        // Monta o número do contrato (ex: 114/2026)
        // Você pode criar uma sequência real no banco futuramente —
        // por enquanto usa o ano + um hash do ID
        const ano = new Date().getFullYear();
        const seq = parseInt(projeto.id.slice(-4), 16) % 1000;
        const numeroContrato = `${String(seq).padStart(3, '0')}/${ano}`;

        // Calcula valor total baseado no orçamento
        const itens = orcamento?.itens ? JSON.parse(orcamento.itens) : [];
        const subtotal = itens.reduce((acc, i) => acc + (i.quantidade || 0) * (i.valorUnitario || 0), 0);
        const totalNF = subtotal / 90 * 100;
        const recibo = subtotal;
        const valorFinal = projeto.tipoDocumento === 'nota_fiscal' ? totalNF : recibo;

        const dados = {
            // Dados do projeto
            nome: projeto.nome,
            feira: projeto.feira,
            datas: projeto.datas,
            local: projeto.local,
            metragem: projeto.metragem,

            // Dados do cliente (vindos do clienteRef ou dos campos diretos salvos na aprovação)
            nomeEmpresa: cliente?.nomeEmpresa || projeto.cliente,
            nomeFantasia: cliente?.nomeFantasia || null,
            cnpj: cliente?.cnpj || null,
            cpf: cliente?.cpf || null,
            endereco: cliente?.endereco || null,
            cidade: cliente?.cidade || null,
            estado: cliente?.estado || null,
            cep: cliente?.cep || null,
            responsavel: cliente?.responsavel || null,

            // Condições comerciais (salvas na aprovação)
            formaPagamento: projeto.formaPagamento,
            tipoDocumento: projeto.tipoDocumento,
            condicoesPagamento: projeto.condicoesPagamento,
            observacoesAprovacao: projeto.observacoesAprovacao,

            // Número do contrato
            numeroContrato,

            // Memorial descritivo (versão mais recente)
            memorial: memorial ? {
                camposAtivos: memorial.camposAtivos,
                piso: memorial.piso,
                estrutura: memorial.estrutura,
                areaAtendimento: memorial.areaAtendimento,
                audioVisual: memorial.audioVisual,
                comunicacaoVisual: memorial.comunicacaoVisual,
                eletrica: memorial.eletrica,
            } : null,

            // Orçamento
            orcamento: orcamento ? {
                itens: orcamento.itens,
                formaPagamento: orcamento.formaPagamento,
                vencimentos: orcamento.vencimentos,
                valorTotal: valorFinal,
            } : null,

            dataGeracao: new Date().toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric'
            }),
        };

        // Gera o arquivo .docx via script Node
        const outputPath = `/tmp/contrato_${projeto.id}_${Date.now()}.docx`;
        const scriptPath = new URL('./gerarContrato.js', import.meta.url).pathname;

        await execFileAsync('node', [scriptPath, outputPath, JSON.stringify(dados)]);

        // Envia o arquivo para download e apaga depois
        const nomeArquivo = `Contrato_${(projeto.cliente || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}_${ano}.docx`;
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.sendFile(outputPath, () => {
            // Apaga o arquivo temporário após enviar
            fs.unlink(outputPath, () => {});
        });

    } catch (error) {
        console.error('Erro ao gerar contrato:', error);
        res.status(500).json({ message: 'Erro ao gerar contrato: ' + error.message });
    }
});

app.listen(3001, () => console.log(`Servidor rodando na porta 3001 [${isDev ? 'dev' : 'produção'}]`));
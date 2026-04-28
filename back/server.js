import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ─── Diretórios de upload ──────────────────────────────────────────────────
const uploadDir = './uploads';
const uploadProjetoDir = './uploads/projeto';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(uploadProjetoDir)) fs.mkdirSync(uploadProjetoDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    }
});

const storageImagensProjeto = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadProjetoDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
        cb(new Error('Apenas imagens e PDFs são permitidos'));
    }
});

const uploadImagens = multer({
    storage: storageImagensProjeto,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
        cb(new Error('Apenas imagens JPG e PNG são permitidas'));
    }
});

// ─── Middleware de autenticação ────────────────────────────────────────────
function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Acesso não autorizado' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch {
        res.status(401).json({ message: 'Token inválido ou expirado' });
    }
}

// ══════════════════════════════════════════════════════════════════════════
// AUTENTICAÇÃO
// ══════════════════════════════════════════════════════════════════════════

app.post('/cadastro', async (req, res) => {
    const { email, name, cargo, password } = req.body;
    if (!email || !name || !password)
        return res.status(400).json({ message: 'Email, nome e senha são obrigatórios' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, name, cargo: cargo?.toLowerCase(), password: hashedPassword }
        });
        res.status(201).json({ message: 'Cadastro recebido', user });
    } catch {
        res.status(400).json({ message: 'Erro ao cadastrar usuário' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: 'Senha incorreta' });
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 3600000 });
        res.status(200).json({ message: 'Login bem-sucedido' });
    } catch {
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
    res.status(200).json({ message: 'Logout realizado' });
});

app.get('/me', authMiddleware, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true, cargo: true }
    });
    res.json(user);
});

// ══════════════════════════════════════════════════════════════════════════
// USUÁRIOS
// ══════════════════════════════════════════════════════════════════════════

app.get('/usuarios', authMiddleware, async (req, res) => {
    const where = req.query.name || req.query.email
        ? { OR: [{ name: req.query.name }, { email: req.query.email }] }
        : {};
    const users = await prisma.user.findMany({ where, select: { id: true, email: true, name: true, cargo: true } });
    res.status(200).json(users);
});

app.put('/usuarios/:id', authMiddleware, async (req, res) => {
    if (req.userId !== req.params.id) return res.status(403).json({ message: 'Acesso negado' });
    try {
        await prisma.user.update({ where: { id: req.params.id }, data: { email: req.body.email, name: req.body.name, cargo: req.body.cargo } });
        res.status(200).json(req.body);
    } catch {
        res.status(500).json({ message: 'Erro ao atualizar usuário' });
    }
});

app.delete('/usuarios/:id', authMiddleware, async (req, res) => {
    if (req.userId !== req.params.id) return res.status(403).json({ message: 'Acesso negado' });
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.status(200).json({ message: 'Usuário deletado com sucesso' });
    } catch {
        res.status(500).json({ message: 'Erro ao deletar usuário' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// PROJETOS
// ══════════════════════════════════════════════════════════════════════════

app.get('/projetistas', authMiddleware, async (req, res) => {
    const projetistas = await prisma.user.findMany({
        where: { cargo: { contains: 'projet', mode: 'insensitive' } },
        select: { id: true, name: true }
    });
    res.json(projetistas);
});

app.get('/projetos', authMiddleware, async (req, res) => {
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
});

app.get('/meus-projetos', authMiddleware, async (req, res) => {
    const projetos = await prisma.projeto.findMany({
        where: { projetistaId: req.userId },
        include: {
            responsavel: { select: { id: true, name: true } },
            imagensProjeto: { orderBy: { ordem: 'asc' } }
        },
        orderBy: { criadoEm: 'desc' }
    });
    res.json(projetos);
});

app.post('/projetos', authMiddleware, async (req, res) => {
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar projeto' });
    }
});

app.put('/projetos/:id', authMiddleware, async (req, res) => {
    try {
        const projeto = await prisma.projeto.update({ where: { id: req.params.id }, data: req.body });
        res.json(projeto);
    } catch {
        res.status(500).json({ message: 'Erro ao atualizar projeto' });
    }
});

// Atualiza status manualmente (gerente pode voltar status com justificativa)
app.patch('/projetos/:id/status', authMiddleware, async (req, res) => {
    const { status, justificativa } = req.body;
    const statusValidos = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado', 'Reprovado'];
    if (!statusValidos.includes(status))
        return res.status(400).json({ message: 'Status inválido' });

    // Verifica o cargo do usuário — só gerente/diretor pode voltar status
    const usuario = await prisma.user.findUnique({ where: { id: req.userId } });
    const podeVoltarStatus = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());

    const projetoAtual = await prisma.projeto.findUnique({ where: { id: req.params.id } });
    const ordemStatus = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado', 'Reprovado'];
    const ordemAtual = ordemStatus.indexOf(projetoAtual?.status);
    const ordemNova = ordemStatus.indexOf(status);

    // Bloqueia voltar status se não for gerente/diretor
    if (ordemNova < ordemAtual && !podeVoltarStatus)
        return res.status(403).json({ message: 'Apenas gerente ou diretor pode voltar o status' });

    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.json(projeto);
    } catch {
        res.status(500).json({ message: 'Erro ao atualizar status' });
    }
});

// Aloca projetista — muda status automaticamente para "Em criação"
app.patch('/projetos/:id/projetista', authMiddleware, async (req, res) => {
    const { projetistaId } = req.body;
    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: {
                projetistaId,
                status: 'Em criação'  // automático ao alocar projetista
            }
        });
        res.json(projeto);
    } catch {
        res.status(500).json({ message: 'Erro ao alocar projetista' });
    }
});

// Aprovação ou reprovação pelo vendedor — salva dados do cliente e condições
app.patch('/projetos/:id/resultado', authMiddleware, async (req, res) => {
    const {
        resultado,           // 'aprovado' | 'reprovado'
        // Dados do cliente (só quando aprovado)
        nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone,
        endereco, cidade, estado, cep, responsavel,
        // Condições comerciais (só quando aprovado)
        formaPagamento, tipoDocumento, condicoesPagamento, observacoes
    } = req.body;

    if (!['aprovado', 'reprovado'].includes(resultado))
        return res.status(400).json({ message: 'Resultado inválido' });

    // Verifica se é o vendedor responsável pelo projeto
    const projeto = await prisma.projeto.findUnique({
        where: { id: req.params.id },
        select: { responsavelId: true, cliente: true }
    });
    if (!projeto) return res.status(404).json({ message: 'Projeto não encontrado' });
    if (projeto.responsavelId !== req.userId)
        return res.status(403).json({ message: 'Apenas o vendedor responsável pode marcar o resultado' });

    try {
        let clienteId = undefined;

        if (resultado === 'aprovado' && nomeEmpresa) {
            // Cria ou atualiza o cliente
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
                    observacoesAprovacao: observacoes
                })
            }
        });

        res.json(projetoAtualizado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao registrar resultado' });
    }
});

app.delete('/projetos/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.projeto.delete({ where: { id: req.params.id } });
        res.json({ message: 'Projeto deletado com sucesso' });
    } catch {
        res.status(500).json({ message: 'Erro ao deletar projeto' });
    }
});

// Upload de arquivos de briefing
app.post('/projetos/:id/arquivos', authMiddleware, upload.fields([
    { name: 'manual', maxCount: 1 },
    { name: 'mapa', maxCount: 1 },
    { name: 'logos', maxCount: 5 },
    { name: 'briefing', maxCount: 1 },
]), async (req, res) => {
    try {
        const arquivos = {};
        if (req.files?.manual) arquivos.manual = req.files.manual[0].filename;
        if (req.files?.mapa) arquivos.mapa = req.files.mapa[0].filename;
        if (req.files?.logos) arquivos.logos = req.files.logos.map(f => f.filename);
        if (req.files?.briefing) arquivos.briefing = req.files.briefing[0].filename;
        await prisma.projeto.update({ where: { id: req.params.id }, data: { arquivos: JSON.stringify(arquivos) } });
        res.json({ message: 'Arquivos enviados com sucesso', arquivos });
    } catch {
        res.status(500).json({ message: 'Erro ao salvar arquivos' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// IMAGENS DO PROJETO (renders do projetista)
// ══════════════════════════════════════════════════════════════════════════

app.post('/projetos/:id/imagens', authMiddleware, uploadImagens.array('imagens', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0)
            return res.status(400).json({ message: 'Nenhuma imagem enviada' });

        const ultimaOrdem = await prisma.imagemProjeto.findFirst({
            where: { projetoId: req.params.id },
            orderBy: { ordem: 'desc' }
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

        // Muda status automaticamente para "Memorial" ao enviar primeira imagem
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao salvar imagens' });
    }
});

app.get('/projetos/:id/imagens', authMiddleware, async (req, res) => {
    const imagens = await prisma.imagemProjeto.findMany({
        where: { projetoId: req.params.id },
        orderBy: { ordem: 'asc' }
    });
    res.json(imagens);
});

app.patch('/projetos/:id/imagens/ordem', authMiddleware, async (req, res) => {
    const { ordens } = req.body;
    try {
        await Promise.all(ordens.map(({ id, ordem }) =>
            prisma.imagemProjeto.update({ where: { id }, data: { ordem } })
        ));
        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch {
        res.status(500).json({ message: 'Erro ao atualizar ordem' });
    }
});

app.delete('/projetos/:projetoId/imagens/:imagemId', authMiddleware, async (req, res) => {
    try {
        const imagem = await prisma.imagemProjeto.findUnique({ where: { id: req.params.imagemId } });
        if (!imagem) return res.status(404).json({ message: 'Imagem não encontrada' });
        const caminho = `./uploads/projeto/${imagem.filename}`;
        if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
        await prisma.imagemProjeto.delete({ where: { id: req.params.imagemId } });
        res.json({ message: 'Imagem deletada com sucesso' });
    } catch {
        res.status(500).json({ message: 'Erro ao deletar imagem' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// MEMORIAL
// ══════════════════════════════════════════════════════════════════════════

app.get('/projetos/:id/memoriais', authMiddleware, async (req, res) => {
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
});

app.get('/memoriais/:id', authMiddleware, async (req, res) => {
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
});

app.post('/projetos/:id/memoriais', authMiddleware, async (req, res) => {
    const { piso, estrutura, areaAtendimento, audioVisual, comunicacaoVisual, eletrica, camposAtivos, ordemImagens } = req.body;
    try {
        const ultimaVersao = await prisma.memorial.findFirst({
            where: { projetoId: req.params.id },
            orderBy: { versao: 'desc' }
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

        // Muda status do projeto para "Precificação" automaticamente
        await prisma.projeto.update({
            where: { id: req.params.id },
            data: { status: 'Precificação' }
        });

        res.status(201).json(memorial);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar memorial' });
    }
});

app.put('/memoriais/:id', authMiddleware, async (req, res) => {
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
    } catch {
        res.status(500).json({ message: 'Erro ao atualizar memorial' });
    }
});

app.delete('/memoriais/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.memorial.delete({ where: { id: req.params.id } });
        res.json({ message: 'Memorial deletado com sucesso' });
    } catch {
        res.status(500).json({ message: 'Erro ao deletar memorial' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// ORÇAMENTO
// ══════════════════════════════════════════════════════════════════════════

// Lista orçamentos de um projeto
app.get('/projetos/:id/orcamentos', authMiddleware, async (req, res) => {
    const orcamentos = await prisma.orcamento.findMany({
        where: { projetoId: req.params.id },
        include: {
            memorial: { select: { versao: true } },
            criadoPor: { select: { name: true } }
        },
        orderBy: { versao: 'desc' }
    });
    res.json(orcamentos);
});

// Busca um orçamento específico
app.get('/orcamentos/:id', authMiddleware, async (req, res) => {
    const orcamento = await prisma.orcamento.findUnique({
        where: { id: req.params.id },
        include: {
            projeto: {
                select: {
                    nome: true, cliente: true, feira: true,
                    metragem: true, datas: true, local: true
                }
            },
            memorial: { select: { versao: true } },
            criadoPor: { select: { name: true } }
        }
    });
    if (!orcamento) return res.status(404).json({ message: 'Orçamento não encontrado' });
    res.json(orcamento);
});

// Cria novo orçamento vinculado a um memorial
app.post('/projetos/:id/orcamentos', authMiddleware, async (req, res) => {
    const { memorialId, itens, formaPagamento, vencimentos, cidade } = req.body;
    if (!memorialId) return res.status(400).json({ message: 'Memorial obrigatório' });

    try {
        // Verifica se já existe orçamento para esse memorial
        const existe = await prisma.orcamento.findUnique({ where: { memorialId } });
        if (existe) return res.status(400).json({ message: 'Já existe orçamento para este memorial. Use PUT para editar.' });

        // Descobre a próxima versão
        const ultimaVersao = await prisma.orcamento.findFirst({
            where: { projetoId: req.params.id },
            orderBy: { versao: 'desc' }
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar orçamento' });
    }
});

// Atualiza orçamento existente
app.put('/orcamentos/:id', authMiddleware, async (req, res) => {
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
    } catch {
        res.status(500).json({ message: 'Erro ao atualizar orçamento' });
    }
});

// Marca orçamento como enviado — muda status do projeto para "Enviado"
app.patch('/orcamentos/:id/enviar', authMiddleware, async (req, res) => {
    try {
        const orcamento = await prisma.orcamento.update({
            where: { id: req.params.id },
            data: { enviado: true, enviadoEm: new Date() }
        });

        // Muda status do projeto para "Enviado" automaticamente
        await prisma.projeto.update({
            where: { id: orcamento.projetoId },
            data: { status: 'Enviado' }
        });

        res.json(orcamento);
    } catch {
        res.status(500).json({ message: 'Erro ao marcar orçamento como enviado' });
    }
});

app.delete('/orcamentos/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.orcamento.delete({ where: { id: req.params.id } });
        res.json({ message: 'Orçamento deletado com sucesso' });
    } catch {
        res.status(500).json({ message: 'Erro ao deletar orçamento' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════════════════

app.get('/clientes', authMiddleware, async (req, res) => {
    const usuario = await prisma.user.findUnique({ where: { id: req.userId } });
    const isGestorOuDiretor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());

    // Vendedor só vê clientes dos seus projetos
    const where = isGestorOuDiretor ? {} : {
        projetos: { some: { responsavelId: req.userId } }
    };

    const clientes = await prisma.cliente.findMany({
        where,
        include: {
            projetos: {
                select: { id: true, nome: true, status: true, criadoEm: true },
                orderBy: { criadoEm: 'desc' }
            }
        },
        orderBy: { nomeEmpresa: 'asc' }
    });
    res.json(clientes);
});

app.get('/clientes/:id', authMiddleware, async (req, res) => {
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
});

app.put('/clientes/:id', authMiddleware, async (req, res) => {
    try {
        const cliente = await prisma.cliente.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json(cliente);
    } catch {
        res.status(500).json({ message: 'Erro ao atualizar cliente' });
    }
});

// ─── Servir arquivos estáticos ─────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

app.listen(3001, () => console.log('Servidor rodando na porta 3001'));
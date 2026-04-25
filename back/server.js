import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient();
const app = express();

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ─── Diretórios de upload ──────────────────────────────────────────────────
const uploadDir = './uploads'
const uploadProjetoDir = './uploads/projeto'

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir)
if (!fs.existsSync(uploadProjetoDir)) fs.mkdirSync(uploadProjetoDir, { recursive: true })

// ─── Storage para arquivos de briefing ────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
        cb(null, `${unique}${path.extname(file.originalname)}`)
    }
})

// ─── Storage para imagens do projeto (renders do projetista) ──────────────
const storageImagensProjeto = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadProjetoDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
        cb(null, `${unique}${path.extname(file.originalname)}`)
    }
})

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf/
        const ext = allowed.test(path.extname(file.originalname).toLowerCase())
        if (ext) return cb(null, true)
        cb(new Error('Apenas imagens e PDFs são permitidos'))
    }
})

const uploadImagens = multer({
    storage: storageImagensProjeto,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png/
        const ext = allowed.test(path.extname(file.originalname).toLowerCase())
        if (ext) return cb(null, true)
        cb(new Error('Apenas imagens JPG e PNG são permitidas'))
    }
})

// ─── Middleware de autenticação ────────────────────────────────────────────
function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Acesso não autorizado' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido ou expirado' });
    }
}

// ══════════════════════════════════════════════════════════════════════════
// ROTAS DE AUTENTICAÇÃO
// ══════════════════════════════════════════════════════════════════════════

app.post('/cadastro', async (req, res) => {
    const { email, name, cargo, password } = req.body;
    if (!email || !name || !password) {
        return res.status(400).json({ message: 'Email, nome e senha são obrigatórios' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, name, cargo: cargo?.toLowerCase(), password: hashedPassword }
        });
        res.status(201).json({ message: 'Cadastro recebido', user });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(400).json({ message: 'Erro ao cadastrar usuário' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Senha incorreta' });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000
        });
        res.status(200).json({ message: 'Login bem-sucedido' });
    } catch (error) {
        console.error('Erro no login:', error);
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
// ROTAS DE USUÁRIOS
// ══════════════════════════════════════════════════════════════════════════

app.get('/usuarios', authMiddleware, async (req, res) => {
    let users = [];
    if (req.query.name || req.query.email) {
        users = await prisma.user.findMany({
            where: { OR: [{ name: req.query.name }, { email: req.query.email }] },
            select: { id: true, email: true, name: true, cargo: true }
        });
    } else {
        users = await prisma.user.findMany({
            select: { id: true, email: true, name: true, cargo: true }
        });
    }
    res.status(200).json(users);
});

app.put('/usuarios/:id', authMiddleware, async (req, res) => {
    if (req.userId !== req.params.id) {
        return res.status(403).json({ message: 'Acesso negado' });
    }
    try {
        await prisma.user.update({
            where: { id: req.params.id },
            data: { email: req.body.email, name: req.body.name, cargo: req.body.cargo }
        });
        res.status(200).json(req.body);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar usuário' });
    }
});

app.delete('/usuarios/:id', authMiddleware, async (req, res) => {
    if (req.userId !== req.params.id) {
        return res.status(403).json({ message: 'Acesso negado' });
    }
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.status(200).json({ message: 'Usuário deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao deletar usuário' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// ROTAS DE PROJETOS
// ══════════════════════════════════════════════════════════════════════════

app.get('/projetistas', authMiddleware, async (req, res) => {
    const projetistas = await prisma.user.findMany({
        where: { cargo: { contains: 'projet', mode: 'insensitive' } },
        select: { id: true, name: true }
    })
    res.json(projetistas)
})

app.get('/projetos', authMiddleware, async (req, res) => {
    const { status, responsavelId, cliente } = req.query
    const where = {}
    if (status) where.status = status
    if (responsavelId) where.responsavelId = responsavelId
    if (cliente) where.cliente = { contains: cliente, mode: 'insensitive' }

    const projetos = await prisma.projeto.findMany({
        where,
        include: {
            responsavel: { select: { id: true, name: true, cargo: true } },
            projetista: { select: { id: true, name: true } },
            imagensProjeto: { orderBy: { ordem: 'asc' } }
        },
        orderBy: { criadoEm: 'desc' }
    })
    res.json(projetos)
})

// Busca projetos alocados para o projetista logado
app.get('/meus-projetos', authMiddleware, async (req, res) => {
    const projetos = await prisma.projeto.findMany({
        where: { projetistaId: req.userId },
        include: {
            responsavel: { select: { id: true, name: true } },
            imagensProjeto: { orderBy: { ordem: 'asc' } }
        },
        orderBy: { criadoEm: 'desc' }
    })
    res.json(projetos)
})

app.post('/projetos', authMiddleware, async (req, res) => {
    const { cliente, feira, metragem, datas, local, briefing, dataLimite, tipo } = req.body
    if (!cliente || !feira || !metragem || !datas || !local) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' })
    }
    try {
        const projeto = await prisma.projeto.create({
            data: {
                nome: `${cliente} - ${feira}`,
                cliente, feira, metragem, datas, local, briefing, tipo,
                dataLimite: dataLimite ? new Date(dataLimite) : null,
                responsavelId: req.userId,
                status: 'Recebido'
            }
        })
        res.status(201).json(projeto)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Erro ao criar projeto' })
    }
})

app.put('/projetos/:id', authMiddleware, async (req, res) => {
    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: req.body
        })
        res.json(projeto)
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar projeto' })
    }
})

app.patch('/projetos/:id/status', authMiddleware, async (req, res) => {
    const { status } = req.body
    const statusValidos = ['Recebido', 'Em criação', 'Memorial', 'Precificação', 'Enviado', 'Aprovado']
    if (!statusValidos.includes(status)) {
        return res.status(400).json({ message: 'Status inválido' })
    }
    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: { status }
        })
        res.json(projeto)
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar status' })
    }
})

app.patch('/projetos/:id/projetista', authMiddleware, async (req, res) => {
    const { projetistaId } = req.body
    try {
        const projeto = await prisma.projeto.update({
            where: { id: req.params.id },
            data: { projetistaId }
        })
        res.json(projeto)
    } catch (error) {
        res.status(500).json({ message: 'Erro ao alocar projetista' })
    }
})

app.delete('/projetos/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.projeto.delete({ where: { id: req.params.id } })
        res.json({ message: 'Projeto deletado com sucesso' })
    } catch (error) {
        res.status(500).json({ message: 'Erro ao deletar projeto' })
    }
})

// Upload de arquivos de briefing
app.post('/projetos/:id/arquivos', authMiddleware, upload.fields([
    { name: 'manual', maxCount: 1 },
    { name: 'mapa', maxCount: 1 },
    { name: 'logos', maxCount: 5 },
    { name: 'briefing', maxCount: 1 },
]), async (req, res) => {
    try {
        const arquivos = {}
        if (req.files?.manual) arquivos.manual = req.files.manual[0].filename
        if (req.files?.mapa) arquivos.mapa = req.files.mapa[0].filename
        if (req.files?.logos) arquivos.logos = req.files.logos.map(f => f.filename)
        if (req.files?.briefing) arquivos.briefing = req.files.briefing[0].filename

        await prisma.projeto.update({
            where: { id: req.params.id },
            data: { arquivos: JSON.stringify(arquivos) }
        })
        res.json({ message: 'Arquivos enviados com sucesso', arquivos })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Erro ao salvar arquivos' })
    }
})

// ══════════════════════════════════════════════════════════════════════════
// ROTAS DE IMAGENS DO PROJETO (renders enviados pelo projetista)
// ══════════════════════════════════════════════════════════════════════════

// Upload de múltiplas imagens pelo projetista
app.post('/projetos/:id/imagens', authMiddleware, uploadImagens.array('imagens', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Nenhuma imagem enviada' })
        }

        // Busca a maior ordem atual para adicionar depois
        const ultimaOrdem = await prisma.imagemProjeto.findFirst({
            where: { projetoId: req.params.id },
            orderBy: { ordem: 'desc' }
        })
        let ordemBase = ultimaOrdem ? ultimaOrdem.ordem + 1 : 0

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
        )

        res.status(201).json({ message: 'Imagens enviadas com sucesso', imagens })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Erro ao salvar imagens' })
    }
})

// Busca imagens de um projeto
app.get('/projetos/:id/imagens', authMiddleware, async (req, res) => {
    const imagens = await prisma.imagemProjeto.findMany({
        where: { projetoId: req.params.id },
        orderBy: { ordem: 'asc' }
    })
    res.json(imagens)
})

// Atualiza a ordem das imagens (recebe array de { id, ordem })
app.patch('/projetos/:id/imagens/ordem', authMiddleware, async (req, res) => {
    const { ordens } = req.body // [{ id: '...', ordem: 0 }, ...]
    try {
        await Promise.all(
            ordens.map(({ id, ordem }) =>
                prisma.imagemProjeto.update({ where: { id }, data: { ordem } })
            )
        )
        res.json({ message: 'Ordem atualizada com sucesso' })
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar ordem' })
    }
})

// Deleta uma imagem do projeto
app.delete('/projetos/:projetoId/imagens/:imagemId', authMiddleware, async (req, res) => {
    try {
        const imagem = await prisma.imagemProjeto.findUnique({
            where: { id: req.params.imagemId }
        })
        if (!imagem) return res.status(404).json({ message: 'Imagem não encontrada' })

        // Remove o arquivo do disco
        const caminhoArquivo = `./uploads/projeto/${imagem.filename}`
        if (fs.existsSync(caminhoArquivo)) fs.unlinkSync(caminhoArquivo)

        await prisma.imagemProjeto.delete({ where: { id: req.params.imagemId } })
        res.json({ message: 'Imagem deletada com sucesso' })
    } catch (error) {
        res.status(500).json({ message: 'Erro ao deletar imagem' })
    }
})

// ══════════════════════════════════════════════════════════════════════════
// ROTAS DE MEMORIAL
// ══════════════════════════════════════════════════════════════════════════

// Lista todos os memoriais de um projeto (todas as versões)
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
            criadoPor: { select: { name: true } }
        },
        orderBy: { versao: 'desc' }
    })
    res.json(memoriais)
})

// Busca um memorial específico por ID
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
            criadoPor: { select: { name: true } }
        }
    })
    if (!memorial) return res.status(404).json({ message: 'Memorial não encontrado' })
    res.json(memorial)
})

// Cria um novo memorial (nova versão) para um projeto
app.post('/projetos/:id/memoriais', authMiddleware, async (req, res) => {
    const { piso, estrutura, areaAtendimento, audioVisual, comunicacaoVisual, eletrica, camposAtivos, ordemImagens } = req.body

    try {
        // Descobre qual é a próxima versão
        const ultimaVersao = await prisma.memorial.findFirst({
            where: { projetoId: req.params.id },
            orderBy: { versao: 'desc' }
        })
        const proximaVersao = ultimaVersao ? ultimaVersao.versao + 1 : 1

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
        })

        res.status(201).json(memorial)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Erro ao criar memorial' })
    }
})

// Atualiza um memorial existente (edição de rascunho)
app.put('/memoriais/:id', authMiddleware, async (req, res) => {
    const { piso, estrutura, areaAtendimento, audioVisual, comunicacaoVisual, eletrica, camposAtivos, ordemImagens } = req.body
    try {
        const memorial = await prisma.memorial.update({
            where: { id: req.params.id },
            data: {
                piso: piso ?? undefined,
                estrutura: estrutura ?? undefined,
                areaAtendimento: areaAtendimento ?? undefined,
                audioVisual: audioVisual ?? undefined,
                comunicacaoVisual: comunicacaoVisual ?? undefined,
                eletrica: eletrica ?? undefined,
                camposAtivos: camposAtivos ? JSON.stringify(camposAtivos) : undefined,
                ordemImagens: ordemImagens ? JSON.stringify(ordemImagens) : undefined,
            }
        })
        res.json(memorial)
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar memorial' })
    }
})

// Deleta um memorial
app.delete('/memoriais/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.memorial.delete({ where: { id: req.params.id } })
        res.json({ message: 'Memorial deletado com sucesso' })
    } catch (error) {
        res.status(500).json({ message: 'Erro ao deletar memorial' })
    }
})

// ─── Servir arquivos estáticos ─────────────────────────────────────────────
app.use('/uploads', express.static('uploads'))

app.listen(3001, () => console.log('Servidor rodando na porta 3001'));
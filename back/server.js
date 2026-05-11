import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import prisma from './lib/prisma.js';

// ── Routers ────────────────────────────────────────────────────────────────
import authRouter       from './routes/auth.js';
import usuariosRouter   from './routes/usuarios.js';
import projetosRouter   from './routes/projetos.js';
import memoriaisRouter  from './routes/memoriais.js';
import orcamentosRouter from './routes/orcamentos.js';
import clientesRouter   from './routes/clientes.js';
import contratosRouter  from './routes/contratos.js';
import agenciasRouter   from './routes/agencias.js';

const app   = express();
const isDev = process.env.NODE_ENV !== 'production';

// ══════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
// ══════════════════════════════════════════════════════════════════════════
const requiredEnv = ['JWT_SECRET'];
for (const key of requiredEnv) {
    if (!process.env[key] && !isDev) {
        console.error(`FATAL: Variável de ambiente ${key} não definida.`);
        process.exit(1);
    }
}
if (!process.env.JWT_SECRET && isDev) {
    process.env.JWT_SECRET = 'dev-secret-inseguro-na-producao';
    console.warn('⚠️  JWT_SECRET não definido, usando fallback inseguro.');
}

// ══════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAIS
// ══════════════════════════════════════════════════════════════════════════
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
    origin:         process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(rateLimit({
    windowMs:        60 * 1000,
    max:             200,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { message: 'Muitas requisições. Tente novamente em breve.' },
}));

// ══════════════════════════════════════════════════════════════════════════
// ROTAS
// ══════════════════════════════════════════════════════════════════════════
app.use(authRouter);
app.use(usuariosRouter);
app.use(projetosRouter);
app.use(memoriaisRouter);
app.use(orcamentosRouter);
app.use(clientesRouter);
app.use(contratosRouter);
app.use(agenciasRouter);

// ══════════════════════════════════════════════════════════════════════════
// ARQUIVOS ESTÁTICOS
// ══════════════════════════════════════════════════════════════════════════
app.use('/uploads', express.static('uploads', {
    dotfiles: 'deny',
    index:    false,
    etag:     true,
    maxAge:   '7d',
}));

// ══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE GLOBAL DE ERRO — sempre o último
// ══════════════════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
    if (err.name === 'MulterError') {
        const mensagens = {
            LIMIT_FILE_SIZE:       'Arquivo muito grande. Tamanho máximo: 20MB.',
            LIMIT_FILE_COUNT:      'Número máximo de arquivos excedido.',
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
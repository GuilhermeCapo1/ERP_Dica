import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir      = './uploads';
const uploadProjetoDir = './uploads/projeto';

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(uploadProjetoDir)) fs.mkdirSync(uploadProjetoDir, { recursive: true });

const MIME_BRIEFING = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'application/pdf': '.pdf',
};
const MIME_IMAGENS = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
};

function nomeSeguro(extensao) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return `${unique}${extensao}`;
}

const storageBriefing = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
        const ext = MIME_BRIEFING[file.mimetype] || path.extname(file.originalname).toLowerCase();
        cb(null, nomeSeguro(ext));
    }
});

const storageImagens = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadProjetoDir),
    filename:    (req, file, cb) => {
        const ext = MIME_IMAGENS[file.mimetype] || '.jpg';
        cb(null, nomeSeguro(ext));
    }
});

function filtrarBriefing(req, file, cb) {
    const mimeOk = Object.keys(MIME_BRIEFING).includes(file.mimetype);
    const extOk  = /\.(jpeg|jpg|png|pdf)$/i.test(path.extname(file.originalname));
    if (mimeOk && extOk) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG ou PDF.'));
}

function filtrarImagens(req, file, cb) {
    const mimeOk = Object.keys(MIME_IMAGENS).includes(file.mimetype);
    const extOk  = /\.(jpeg|jpg|png)$/i.test(path.extname(file.originalname));
    if (mimeOk && extOk) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Use JPG ou PNG.'));
}

export const upload = multer({
    storage:    storageBriefing,
    limits:     { fileSize: 20 * 1024 * 1024 },
    fileFilter: filtrarBriefing,
});

export const uploadImagens = multer({
    storage:    storageImagens,
    limits:     { fileSize: 20 * 1024 * 1024 },
    fileFilter: filtrarImagens,
});
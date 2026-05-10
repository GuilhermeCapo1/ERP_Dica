import jwt from 'jsonwebtoken';


export function authMiddleware(req, res, next) {
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
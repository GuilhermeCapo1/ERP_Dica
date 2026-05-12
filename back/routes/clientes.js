import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Select reutilizado — projetos com contrato assinado
const SELECT_PROJETO = {
    id: true, nome: true, status: true, criadoEm: true, feira: true, local: true,
    contratos: {
        where:  { assinado: true },
        select: { id: true, numero: true, assinadoEm: true },
        take:   1,
    }
}

router.get('/clientes', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({
            where:  { id: req.userId },
            select: { cargo: true }
        });
        const isGestorOuDiretor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());

        if (isGestorOuDiretor) {
            const clientes = await prisma.cliente.findMany({
                include: {
                    projetos: {
                        select:  SELECT_PROJETO,
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
                        ...SELECT_PROJETO,
                        responsavelId: true,
                        responsavel:   { select: { name: true } }
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
            return { id: cliente.id, nomeEmpresa: cliente.nomeEmpresa, vendedorNome: vendedor, proprio: false };
        });

        res.json(resposta);
    } catch (err) { next(err); }
});

router.get('/clientes/:id', authMiddleware, async (req, res, next) => {
    try {
        const cliente = await prisma.cliente.findUnique({
            where:   { id: req.params.id },
            include: {
                projetos: {
                    select:  SELECT_PROJETO,
                    orderBy: { criadoEm: 'desc' }
                }
            }
        });
        if (!cliente) return res.status(404).json({ message: 'Cliente não encontrado' });
        res.json(cliente);
    } catch (err) { next(err); }
});

router.put('/clientes/:id', authMiddleware, async (req, res, next) => {
    const { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel } = req.body;
    try {
        const [usuario, cliente] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.userId }, select: { cargo: true } }),
            prisma.cliente.findUnique({
                where:   { id: req.params.id },
                include: { projetos: { select: { responsavelId: true } } }
            })
        ]);
        if (!cliente) return res.status(404).json({ message: 'Cliente não encontrado' });

        const isGestor            = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        const isVendedorDoCliente = cliente.projetos.some(p => p.responsavelId === req.userId);
        if (!isGestor && !isVendedorDoCliente)
            return res.status(403).json({ message: 'Sem permissão para editar este cliente' });

        const atualizado = await prisma.cliente.update({
            where: { id: req.params.id },
            data:  { nomeEmpresa, nomeFantasia, cnpj, cpf, email, telefone, endereco, cidade, estado, cep, responsavel }
        });
        res.json(atualizado);
    } catch (err) { next(err); }
});

// ── Delete com cascata de projetos ────────────────────────────────────────
// Deleta o cliente E todos os projetos vinculados.
// O onDelete: Cascade no schema cuida de memoriais, orçamentos,
// imagens e contratos dentro de cada projeto automaticamente.
router.delete('/clientes/:id', authMiddleware, async (req, res, next) => {
    try {
        const usuario = await prisma.user.findUnique({
            where:  { id: req.userId },
            select: { cargo: true }
        });
        const isGestor = ['gerente', 'diretor'].includes(usuario?.cargo?.toLowerCase());
        if (!isGestor)
            return res.status(403).json({ message: 'Apenas gerente ou diretor pode excluir clientes' });

        // Busca projetos vinculados antes de deletar
        const projetosDoCliente = await prisma.projeto.findMany({
            where:  { clienteId: req.params.id },
            select: { id: true }
        });

        // Deleta projetos um a um — o cascade do schema cuida do resto
        await Promise.all(
            projetosDoCliente.map(p => prisma.projeto.delete({ where: { id: p.id } }))
        );

        await prisma.cliente.delete({ where: { id: req.params.id } });

        res.json({
            message: `Cliente excluído. ${projetosDoCliente.length} projeto(s) removido(s).`
        });
    } catch (err) { next(err); }
});

export default router;
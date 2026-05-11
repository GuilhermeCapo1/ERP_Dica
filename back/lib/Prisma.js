import { PrismaClient } from '@prisma/client';

// Instância única compartilhada por todos os módulos.
// Evita múltiplas conexões abertas ao banco na inicialização.
const prisma = new PrismaClient();

export default prisma;
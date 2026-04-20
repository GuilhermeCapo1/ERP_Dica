import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('senha_admin_aqui', 10)
  
  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@dicasolucoes.com.br',
      password: hashedPassword,
      cargo: 'admin'
    }
  })

  console.log('Admin criado com sucesso:', admin)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
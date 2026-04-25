"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const DEFAULT_CATEGORIES = [
    { name: 'Salário', type: 'income' },
    { name: 'Freelance', type: 'income' },
    { name: 'Investimentos', type: 'income' },
    { name: 'Aluguel recebido', type: 'income' },
    { name: 'Presente', type: 'income' },
    { name: 'Outros (receita)', type: 'income' },
    { name: 'Alimentação', type: 'expense' },
    { name: 'Moradia', type: 'expense' },
    { name: 'Transporte', type: 'expense' },
    { name: 'Saúde', type: 'expense' },
    { name: 'Educação', type: 'expense' },
    { name: 'Lazer', type: 'expense' },
    { name: 'Vestuário', type: 'expense' },
    { name: 'Serviços & Assinaturas', type: 'expense' },
    { name: 'Viagem', type: 'expense' },
    { name: 'Pets', type: 'expense' },
    { name: 'Eletrônicos', type: 'expense' },
    { name: 'Presentes & Doações', type: 'expense' },
    { name: 'Outros (despesa)', type: 'expense' },
];
async function main() {
    const wallets = await prisma.wallet.findMany({ select: { id: true, name: true } });
    console.log(`Found ${wallets.length} wallet(s).`);
    let totalCreated = 0;
    let totalSkipped = 0;
    for (const wallet of wallets) {
        const existing = await prisma.category.findMany({
            where: { walletId: wallet.id },
            select: { name: true },
        });
        const existingNames = new Set(existing.map((c) => c.name));
        const toCreate = DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name));
        if (toCreate.length === 0) {
            console.log(`  [${wallet.name}] all categories already exist — skipped`);
            totalSkipped += DEFAULT_CATEGORIES.length;
            continue;
        }
        await prisma.category.createMany({
            data: toCreate.map((c) => ({ walletId: wallet.id, name: c.name, type: c.type })),
        });
        console.log(`  [${wallet.name}] created ${toCreate.length} categories (${DEFAULT_CATEGORIES.length - toCreate.length} already existed)`);
        totalCreated += toCreate.length;
        totalSkipped += DEFAULT_CATEGORIES.length - toCreate.length;
    }
    console.log(`\nDone. Created: ${totalCreated} | Skipped (already existed): ${totalSkipped}`);
}
main()
    .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("Seeding database...");
    await prisma.authSession.deleteMany();
    await prisma.userOtp.deleteMany();
    await prisma.user.deleteMany();
    const devUser = await prisma.user.create({
        data: {
            email: "dev@whalet.local",
            status: "active",
        },
    });
    console.log(`Created dev user: ${devUser.email} (id: ${devUser.id})`);
    console.log("Seed complete.");
}
main()
    .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});

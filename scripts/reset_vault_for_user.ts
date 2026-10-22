import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

/**
 * Delete a member's Retirement Vault so onboarding can be walked through again.
 *
 * Only ever touches retirement_vaults (and the rows that cascade from them).
 * The user account, their transactions and everything else are untouched.
 *
 *   npx tsx scripts/reset_vault_for_user.ts                 # list vaults
 *   npx tsx scripts/reset_vault_for_user.ts you@email.com   # delete theirs
 */
async function main() {
  const email = process.argv[2];

  if (!email) {
    const vaults = await prisma.retirementVault.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (vaults.length === 0) {
      console.log('No retirement vaults exist. Onboarding is clear for every user.');
      return;
    }

    console.log(`${vaults.length} vault(s):\n`);
    for (const v of vaults) {
      console.log(
        `  ${v.vaultNumber}  ${v.status.padEnd(20)} ${v.riskProfile.padEnd(13)} ` +
          `${v.user.email}`,
      );
    }
    console.log('\nRe-run with an email to delete that user\'s vault.');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (user === null) {
    console.log(`No user found with email ${email}`);
    return;
  }

  const result = await prisma.retirementVault.deleteMany({ where: { userId: user.id } });
  console.log(
    result.count === 0
      ? `${email} has no vault — onboarding is already clear.`
      : `Deleted ${result.count} vault(s) for ${email}. You can run onboarding again.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

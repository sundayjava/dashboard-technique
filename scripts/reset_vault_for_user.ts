import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

/**
 * The pg driver prints an eight-line SSL deprecation notice on every run,
 * which buried this script's actual answer -- someone read "no output" as
 * "it did nothing" when it had in fact reported the user already had no
 * vault. Suppressed here only; it is informational and unrelated to us.
 */

/**
 * Delete a member's Retirement Vault so onboarding can be walked through again.
 *
 * Only ever touches retirement_vaults (and the rows that cascade from them).
 * The user account, their transactions and everything else are untouched.
 *
 *   npx tsx scripts/reset_vault_for_user.ts                 # list vaults
 *   npx tsx scripts/reset_vault_for_user.ts you@email.com   # delete theirs
 */
/** Make the result stand out from whatever the driver has already printed. */
function banner(lines: string[]): void {
  const width = Math.max(...lines.map((l) => l.length)) + 2;
  console.log('\n' + '─'.repeat(width));
  for (const line of lines) console.log(' ' + line);
  console.log('─'.repeat(width) + '\n');
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    const vaults = await prisma.retirementVault.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (vaults.length === 0) {
      banner(['No retirement vaults exist.', 'Onboarding is clear for every user.']);
      return;
    }

    banner([
      `${vaults.length} vault(s):`,
      '',
      ...vaults.map(
        (v) =>
          `${v.vaultNumber}  ${v.status.padEnd(18)} ${v.riskProfile.padEnd(13)} ${v.user.email}`,
      ),
      '',
      "Re-run with an email to delete that user's vault.",
    ]);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (user === null) {
    banner([`No user found with email ${email}`, 'Check the address, or run with no argument to list vaults.']);
    return;
  }

  const result = await prisma.retirementVault.deleteMany({ where: { userId: user.id } });

  if (result.count === 0) {
    // Say where the vaults actually are, rather than leaving someone to
    // wonder why nothing happened.
    const others = await prisma.retirementVault.findMany({
      include: { user: { select: { email: true } } },
    });
    banner([
      `${email} has no vault — nothing to reset.`,
      ...(others.length > 0
        ? ['', 'Vaults currently exist for:', ...others.map((v) => `  ${v.vaultNumber}  ${v.user.email}`)]
        : ['', 'No vaults exist for any user.']),
    ]);
    return;
  }

  banner([
    `Deleted ${result.count} vault(s) for ${email}.`,
    'You can run onboarding again from /retirement-vault/create.',
  ]);
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

import 'dotenv/config';
import { prisma } from '@/lib/prisma';

/**
 * Prove each vault is credited on ITS OWN balance.
 *
 * The daily rate is deliberately shared -- the market moved the same for
 * everyone, so every vault holding a class earns the same percentage. The
 * money is not: each vault's credit must be its own allocated balance times
 * that rate. Those two facts look alike in a summary line and come apart
 * badly if a loop ever collapses to one member, so this checks them
 * separately, against the rows themselves.
 *
 * Read-only.
 */
async function main() {
  const vaults = await prisma.retirementVault.findMany({
    where: { status: { in: ['ACTIVE', 'CLOSING'] } },
    select: { id: true, vaultNumber: true, userId: true, status: true },
    orderBy: { vaultNumber: 'asc' },
  });
  console.log(`\n  ${vaults.length} vault(s) eligible for crediting`);
  console.log(`  ${new Set(vaults.map((v) => v.userId)).size} distinct owner(s)\n`);

  // 1. Is any vault being skipped on a day others were paid?
  const days = await prisma.vaultClassAccrual.findMany({
    select: { accrualDate: true }, distinct: ['accrualDate'], orderBy: { accrualDate: 'desc' }, take: 5,
  });

  console.log('  COVERAGE -- who got credited on each day\n');
  for (const d of days) {
    const rows = await prisma.vaultClassAccrual.findMany({
      where: { accrualDate: d.accrualDate },
      select: { vaultId: true, assetClass: true },
    });
    const byVault = new Map<string, number>();
    for (const r of rows) byVault.set(r.vaultId, (byVault.get(r.vaultId) ?? 0) + 1);
    const date = d.accrualDate.toISOString().slice(0, 10);
    for (const v of vaults) {
      const n = byVault.get(v.id) ?? 0;
      console.log(`    ${date}  ${v.vaultNumber}  ${n} class credit(s)${n === 0 ? '   <-- none' : ''}`);
    }
    console.log();
  }

  // 2. Same rate for everyone, different money for everyone.
  console.log('  PER-MEMBER MATHS -- same rate, own balance\n');
  for (const d of days.slice(0, 2)) {
    const date = d.accrualDate.toISOString().slice(0, 10);
    const classes = await prisma.vaultClassAccrual.findMany({
      where: { accrualDate: d.accrualDate }, select: { assetClass: true }, distinct: ['assetClass'],
    });
    for (const c of classes) {
      const rows = await prisma.vaultClassAccrual.findMany({
        where: { accrualDate: d.accrualDate, assetClass: c.assetClass },
        select: { vaultId: true, openingValue: true, ratePercent: true, amount: true, closingValue: true },
      });
      if (rows.length < 1) continue;
      const rates = [...new Set(rows.map((r) => r.ratePercent.toFixed(6)))];
      console.log(`    ${date}  ${c.assetClass}  (${rows.length} vault(s))`);
      console.log(`      rate shared?  ${rates.length === 1 ? `YES  ${rates[0]}%` : `NO -- ${rates.join(', ')}`}`);
      for (const r of rows) {
        const v = vaults.find((x) => x.id === r.vaultId);
        const expected = (r.openingValue * r.ratePercent) / 100;
        const ok = Math.abs(expected - r.amount) < 0.005;
        console.log(
          `      ${(v?.vaultNumber ?? r.vaultId.slice(0, 8)).padEnd(14)} ` +
            `opening $${r.openingValue.toFixed(2).padStart(10)}  ` +
            `credit $${r.amount.toFixed(4).padStart(10)}  ` +
            `expected $${expected.toFixed(4).padStart(10)}  ${ok ? 'ok' : '*** MISMATCH ***'}`,
        );
      }
      console.log();
    }
  }

  // 3. Does any vault's running total disagree with the sum of its credits?
  console.log('  LEDGER -- allocation balance vs sum of its own credits\n');
  for (const v of vaults) {
    const allocs = await prisma.vaultAllocation.findMany({
      where: { vaultId: v.id }, select: { assetClass: true, accruedPerformance: true },
    });
    for (const a of allocs) {
      const agg = await prisma.vaultClassAccrual.aggregate({
        where: { vaultId: v.id, assetClass: a.assetClass }, _sum: { amount: true },
      });
      const summed = agg._sum.amount ?? 0;
      const drift = a.accruedPerformance - summed;
      if (Math.abs(drift) < 0.005 && summed === 0 && a.accruedPerformance === 0) continue;
      console.log(
        `    ${v.vaultNumber}  ${a.assetClass.padEnd(16)} ` +
          `balance $${a.accruedPerformance.toFixed(4).padStart(10)}  ` +
          `credits $${summed.toFixed(4).padStart(10)}  ` +
          `${Math.abs(drift) < 0.005 ? 'ok' : `*** OUT BY ${drift.toFixed(4)} ***`}`,
      );
    }
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

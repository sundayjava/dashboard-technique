import 'dotenv/config';
import { RebalanceStatus, VaultStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { loadVaultPolicy } from '../src/lib/vault/policy-store';
import { computeSignals } from '../src/lib/vault/signals';
import { proposeRebalance } from '../src/lib/vault/rebalance-engine';
import { REBALANCE_INTERVAL_DAYS } from '../src/lib/vault/rebalance-engine';
import { RebalanceTrigger } from '@prisma/client';

/**
 * Why no rebalance has been recorded yet.
 *
 * "Rebalance history is empty" has two completely different causes -- the
 * engine is not running, or it is running and correctly finding nothing to do
 * -- and the dashboard looks identical either way. This prints which, per
 * vault: days until the quarterly run, current drift against the threshold,
 * and the engine's own skip reason. Read-only; proposes without applying.
 */
async function main() {
  const asOf = new Date();
  const policy = await loadVaultPolicy();
  const signals = await computeSignals(asOf);

  console.log(`\n  drift threshold   ${policy.driftThresholdPercent} pts`);
  console.log(`  quarterly cadence ${REBALANCE_INTERVAL_DAYS} days`);
  console.log(`  price history     ${signals.sufficientHistory ? 'sufficient for tilts' : 'INSUFFICIENT -- rebalances to plain target, no tilt'}\n`);

  const vaults = await prisma.retirementVault.findMany({
    where: { status: VaultStatus.ACTIVE },
    select: { id: true, vaultNumber: true, activatedAt: true, allocationMode: true },
  });
  console.log(`  ${vaults.length} active vault(s)\n`);

  for (const v of vaults) {
    const events = await prisma.vaultRebalanceEvent.count({ where: { vaultId: v.id } });
    const last = await prisma.vaultRebalanceEvent.findFirst({
      where: { vaultId: v.id, status: RebalanceStatus.APPLIED },
      orderBy: { executedAt: 'desc' },
      select: { executedAt: true },
    });
    const since = last?.executedAt ?? v.activatedAt;
    const daysSince = since ? (asOf.getTime() - since.getTime()) / 86_400_000 : null;

    console.log(`  ${v.vaultNumber}  mode=${v.allocationMode}  events stored=${events}`);
    console.log(`    clock starts    ${since?.toISOString().slice(0, 10) ?? 'not activated'} (${last ? 'last rebalance' : 'activation'})`);
    console.log(`    days elapsed    ${daysSince === null ? '-' : daysSince.toFixed(1)} of ${REBALANCE_INTERVAL_DAYS}`);
    console.log(`    quarterly due   ${daysSince !== null && daysSince >= REBALANCE_INTERVAL_DAYS ? 'YES' : `no, in ${(REBALANCE_INTERVAL_DAYS - (daysSince ?? 0)).toFixed(0)} days`}`);

    const p = await proposeRebalance(v.id, RebalanceTrigger.DRIFT_THRESHOLD, { policy, signals, asOf });
    if (p === null) { console.log('    proposal        vault not found\n'); continue; }
    console.log(`    portfolio       $${p.portfolioValue.toFixed(2)}`);
    console.log(`    max drift       ${p.maxDriftPercent.toFixed(3)} pts  (threshold ${policy.driftThresholdPercent})`);
    console.log(`    actionable      ${p.actionable ? 'YES -- would rebalance' : 'no'}`);
    if (!p.actionable) console.log(`    skip reason     ${p.skipReason}`);
    console.log();
  }
}

main()
  .catch((error) => { console.error('Failed:', error instanceof Error ? error.message : error); process.exit(1); })
  .finally(() => prisma.$disconnect());

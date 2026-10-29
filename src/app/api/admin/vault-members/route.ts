import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-middleware';
import { getAssetClassNames } from '@/lib/vault/asset-class-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Member vaults, for an admin.
 *
 * Until this existed an admin could see the withdrawal queue and nothing else
 * -- no way to look up a member, check a balance, or answer "why does my
 * statement say that".
 *
 * Values are computed the same way the member's own screens compute them:
 * principal (cost basis) plus the performance credited to each class, plus
 * uninvested cash. Deliberately NOT via valueVault(), which runs several
 * queries per vault; across a whole book that is a page that times out. The
 * arithmetic is identical.
 *
 * The totals also answer a question nothing else in the product does: what the
 * platform has CREDITED versus what members actually paid in. Credited
 * performance is withdrawable cash, so that gap is a real liability and it
 * grows every night the engine runs.
 */

interface VaultRow {
  id: string;
  vaultNumber: string;
  status: string;
  riskProfile: string;
  allocationMode: string;
  memberName: string | null;
  memberEmail: string;
  cashBalance: number;
  principal: number;
  accrued: number;
  value: number;
  totalContributed: number;
  totalWithdrawn: number;
  createdAt: Date;
  lastValuedAt: Date | null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const id = new URL(request.url).searchParams.get('id');
    return id === null ? await listVaults() : await vaultDetail(id);
  } catch (error) {
    console.error('[Admin Vault Members] error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load member vaults.' },
      { status: 500 },
    );
  }
}

async function listVaults() {
  const vaults = await prisma.retirementVault.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      vaultNumber: true,
      status: true,
      riskProfile: true,
      allocationMode: true,
      cashBalance: true,
      totalContributed: true,
      totalWithdrawn: true,
      createdAt: true,
      lastValuedAt: true,
      user: { select: { name: true, email: true } },
      holdings: { select: { units: true, costBasis: true } },
      allocations: { select: { accruedPerformance: true } },
    },
  });

  const rows: VaultRow[] = vaults.map((v) => {
    // A zero-unit holding is a closed position, not principal.
    const principal = v.holdings
      .filter((h) => h.units !== 0)
      .reduce((s, h) => s + h.costBasis, 0);
    const accrued = v.allocations.reduce((s, a) => s + a.accruedPerformance, 0);

    return {
      id: v.id,
      vaultNumber: v.vaultNumber,
      status: v.status,
      riskProfile: v.riskProfile,
      allocationMode: v.allocationMode,
      memberName: v.user.name,
      memberEmail: v.user.email,
      cashBalance: v.cashBalance,
      principal,
      accrued,
      value: principal + accrued + v.cashBalance,
      totalContributed: v.totalContributed,
      totalWithdrawn: v.totalWithdrawn,
      createdAt: v.createdAt,
      lastValuedAt: v.lastValuedAt,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      vaults: acc.vaults + 1,
      principal: acc.principal + r.principal,
      accrued: acc.accrued + r.accrued,
      cash: acc.cash + r.cashBalance,
      value: acc.value + r.value,
      contributed: acc.contributed + r.totalContributed,
      withdrawn: acc.withdrawn + r.totalWithdrawn,
    }),
    { vaults: 0, principal: 0, accrued: 0, cash: 0, value: 0, contributed: 0, withdrawn: 0 },
  );

  return NextResponse.json({ success: true, rows, totals });
}

async function vaultDetail(id: string) {
  const vault = await prisma.retirementVault.findUnique({
    where: { id },
    select: {
      id: true,
      vaultNumber: true,
      status: true,
      riskProfile: true,
      allocationMode: true,
      focusedAssetClass: true,
      expertAllocatorActive: true,
      modeLastChangedAt: true,
      horizon: true,
      lockInPreference: true,
      cashBalance: true,
      totalContributed: true,
      totalWithdrawn: true,
      monthlyContribution: true,
      createdAt: true,
      activatedAt: true,
      lastValuedAt: true,
      user: { select: { name: true, email: true } },
      allocations: {
        orderBy: { assetClass: 'asc' },
        select: {
          assetClass: true,
          targetPercent: true,
          accruedPerformance: true,
          lastAccruedDate: true,
        },
      },
      holdings: {
        where: { units: { not: 0 } },
        select: {
          units: true,
          costBasis: true,
          asset: { select: { symbol: true, name: true, assetClass: true, currentPrice: true } },
        },
      },
    },
  });

  if (vault === null) {
    return NextResponse.json({ success: false, error: 'Vault not found.' }, { status: 404 });
  }

  const [contributions, withdrawals, accruals, classNames] = await Promise.all([
    prisma.vaultContribution.findMany({
      where: { vaultId: id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { type: true, amount: true, status: true, processedAt: true, createdAt: true },
    }),
    prisma.vaultWithdrawalRequest.findMany({
      where: { vaultId: id },
      orderBy: { requestedAt: 'desc' },
      take: 15,
      select: {
        amount: true, penaltyAmount: true, netAmount: true, status: true,
        requestedAt: true, noticeEndsAt: true, processedAt: true,
      },
    }),
    prisma.vaultClassAccrual.findMany({
      where: { vaultId: id },
      orderBy: [{ accrualDate: 'desc' }, { assetClass: 'asc' }],
      take: 30,
      select: {
        assetClass: true, accrualDate: true, ratePercent: true,
        amount: true, openingValue: true, closingValue: true,
      },
    }),
    getAssetClassNames(),
  ]);

  const principalByClass = new Map<string, number>();
  for (const h of vault.holdings) {
    principalByClass.set(
      h.asset.assetClass,
      (principalByClass.get(h.asset.assetClass) ?? 0) + h.costBasis,
    );
  }

  const classes = vault.allocations.map((a) => {
    const principal = principalByClass.get(a.assetClass) ?? 0;
    return {
      assetClass: a.assetClass,
      targetPercent: a.targetPercent,
      principal,
      accrued: a.accruedPerformance,
      value: principal + a.accruedPerformance,
      lastAccruedDate: a.lastAccruedDate,
    };
  });

  const principal = classes.reduce((s, c) => s + c.principal, 0);
  const accrued = classes.reduce((s, c) => s + c.accrued, 0);

  return NextResponse.json({
    success: true,
    vault: {
      ...vault,
      memberName: vault.user.name,
      memberEmail: vault.user.email,
      principal,
      accrued,
      value: principal + accrued + vault.cashBalance,
    },
    classes,
    classNames,
    holdings: vault.holdings.map((h) => ({
      symbol: h.asset.symbol,
      name: h.asset.name,
      assetClass: h.asset.assetClass,
      units: h.units,
      costBasis: h.costBasis,
      currentPrice: h.asset.currentPrice,
    })),
    contributions,
    withdrawals,
    accruals,
  });
}

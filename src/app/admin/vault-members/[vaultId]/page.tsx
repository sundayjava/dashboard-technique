'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { classLabel } from '@/lib/vault/class-presentation';
import {
  Block,
  Stat,
  Table,
  money,
  moneyTone,
  signedMoney,
} from '@/components/admin/VaultMemberUI';

interface Detail {
  vault: {
    vaultNumber: string;
    memberName: string | null;
    memberEmail: string;
    status: string;
    riskProfile: string;
    allocationMode: string;
    cashBalance: number;
    principal: number;
    accrued: number;
    value: number;
    totalContributed: number;
    totalWithdrawn: number;
  };
  classes: Array<{
    assetClass: string;
    targetPercent: number;
    principal: number;
    accrued: number;
    value: number;
    lastAccruedDate: string | null;
  }>;
  classNames: Record<string, string>;
  holdings: Array<{
    symbol: string;
    name: string;
    assetClass: string;
    units: number;
    costBasis: number;
    currentPrice: number;
  }>;
  contributions: Array<{
    type: string;
    amount: number;
    status: string;
    processedAt: string | null;
    createdAt: string;
  }>;
  withdrawals: Array<{
    amount: number;
    penaltyAmount: number;
    netAmount: number;
    status: string;
    requestedAt: string;
    processedAt: string | null;
  }>;
  accruals: Array<{
    assetClass: string;
    accrualDate: string;
    ratePercent: number;
    amount: number;
    openingValue: number;
    closingValue: number;
  }>;
}

const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '—');

/**
 * One member's vault, in full.
 *
 * WAS A MODAL ON THE LIST PAGE. It outgrew one: a vault carries six asset
 * classes, every instrument it holds, and three ledgers, and a dialog box
 * meant that reading the credits at the bottom scrolled the member's name off
 * the top. A record this long wants a page -- somewhere an admin can link a
 * colleague to, open in a second tab beside another member, and use the
 * browser's own find.
 *
 * Laid out widest-first: the balance, then where it sits, then how it got
 * there. The ledgers at the end are the only part that grows without bound,
 * so they are last.
 */
export default function AdminVaultMemberDetailPage() {
  const params = useParams<{ vaultId: string }>();
  const vaultId = params?.vaultId;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!vaultId) return;
    try {
      const res = await axios.get(`/api/admin/vault-members?id=${vaultId}`);
      setDetail(res.data);
    } catch {
      setMissing(true);
      toast.error('Could not load that vault.');
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (missing || detail === null) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-600">That vault could not be loaded.</p>
        <Link
          href="/admin/vault-members"
          className="text-sm text-gray-900 underline underline-offset-4 mt-2 inline-block"
        >
          Back to member vaults
        </Link>
      </div>
    );
  }

  const v = detail.vault;
  const label = (c: string) => classLabel(c, detail.classNames);

  /*
   * Credits grouped by day, newest first.
   *
   * The flat list was one row per class per day -- six rows that look like six
   * unrelated events when they are one night's run. Grouping them restores
   * the question an admin actually asks ("what did this member earn on the
   * 30th?") and gives it a single answer per day.
   */
  const byDay = new Map<string, typeof detail.accruals>();
  for (const a of detail.accruals) {
    const key = day(a.accrualDate);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(a);
    else byDay.set(key, [a]);
  }
  const creditDays = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link
          href="/admin/vault-members"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Member vaults
        </Link>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <h1 className="text-2xl font-bold text-gray-900">{v.memberName ?? v.memberEmail}</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {v.status.replace(/_/g, ' ').toLowerCase()}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-0.5">
          <span className="font-mono">{v.vaultNumber}</span> · {v.memberEmail}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {v.riskProfile.toLowerCase()} · {v.allocationMode.replace(/_/g, ' ').toLowerCase()}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Principal" value={money(v.principal)} sub="Paid in and invested" />
        <Stat
          label="Credited"
          value={money(v.accrued)}
          sub="Funded by the platform"
          tone={v.accrued > 0 ? 'amber' : 'plain'}
        />
        <Stat label="Cash" value={money(v.cashBalance)} sub="Uninvested" />
        <Stat label="Value" value={money(v.value)} sub="Principal + credited + cash" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <Block title="Asset classes">
          <Table head={['Class', 'Target', 'Principal', 'Credited', 'Value']}>
            {detail.classes.map((c) => (
              <tr key={c.assetClass} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2">
                  {label(c.assetClass)}
                  <span className="block text-[10px] text-gray-400">
                    {c.lastAccruedDate ? `credited to ${day(c.lastAccruedDate)}` : 'never credited'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{c.targetPercent}%</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(c.principal)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${moneyTone(c.accrued)}`}>
                  {c.accrued === 0 ? '—' : signedMoney(c.accrued)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{money(c.value)}</td>
              </tr>
            ))}
          </Table>
        </Block>

        {detail.holdings.length > 0 && (
          <Block title="Holdings">
            <Table head={['Instrument', 'Units', 'Cost basis', 'Last price']}>
              {detail.holdings.map((h) => (
                <tr key={h.symbol} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium">{h.symbol}</span>{' '}
                    <span className="text-gray-400 text-xs">{h.name}</span>
                    <span className="block text-[10px] text-gray-400">{label(h.assetClass)}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{h.units.toFixed(6)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(h.costBasis)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {h.currentPrice > 0 ? money(h.currentPrice) : '—'}
                  </td>
                </tr>
              ))}
            </Table>
          </Block>
        )}
      </div>

      {creditDays.length > 0 && (
        <Block title="Daily credits" note={`${detail.accruals.length} most recent`}>
          <Table head={['Day', 'Class', 'Rate', 'Opening', 'Credit', 'Closing']}>
            {creditDays.map(([date, rows]) => {
              const dayTotal = rows.reduce((s, r) => s + r.amount, 0);
              return [
                <tr key={`${date}-head`} className="bg-gray-50/80 border-y border-gray-100">
                  <td className="px-3 py-1.5 font-mono text-[11px] font-medium text-gray-700">
                    {date}
                  </td>
                  <td className="px-3 py-1.5 text-[11px] text-gray-500" colSpan={3}>
                    {rows.length} class{rows.length === 1 ? '' : 'es'}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums font-semibold ${moneyTone(dayTotal)}`}
                  >
                    {signedMoney(dayTotal)}
                  </td>
                  <td className="px-3 py-1.5" />
                </tr>,
                ...rows.map((a) => (
                  <tr key={`${date}-${a.assetClass}`} className="border-b border-gray-50">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2">{label(a.assetClass)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.ratePercent >= 0 ? '+' : ''}
                      {a.ratePercent.toFixed(4)}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                      {money(a.openingValue)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${moneyTone(a.amount)}`}>
                      {signedMoney(a.amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(a.closingValue)}</td>
                  </tr>
                )),
              ];
            })}
          </Table>
        </Block>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <Block
          title="Contributions"
          note={detail.contributions.length > 0 ? `${detail.contributions.length} most recent` : undefined}
        >
          {detail.contributions.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-gray-400">
              Nothing paid in yet. Total contributed {money(v.totalContributed)}.
            </p>
          ) : (
            <Table head={['Date', 'Type', 'Amount', 'Status']}>
              {detail.contributions.map((c, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {day(c.processedAt ?? c.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.type.replace(/_/g, ' ').toLowerCase()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(c.amount)}</td>
                  <td className="px-3 py-2 text-right">{c.status.toLowerCase()}</td>
                </tr>
              ))}
            </Table>
          )}
        </Block>

        <Block
          title="Withdrawals"
          note={detail.withdrawals.length > 0 ? `${detail.withdrawals.length} most recent` : undefined}
        >
          {detail.withdrawals.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-gray-400">
              Nothing withdrawn. Total withdrawn {money(v.totalWithdrawn)}.
            </p>
          ) : (
            <Table head={['Requested', 'Amount', 'Penalty', 'Net', 'Status']}>
              {detail.withdrawals.map((w, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2 font-mono text-[11px]">{day(w.requestedAt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(w.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">
                    {w.penaltyAmount > 0 ? `-${money(w.penaltyAmount)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {money(w.netAmount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {w.status.replace(/_/g, ' ').toLowerCase()}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Block>
      </div>
    </div>
  );
}

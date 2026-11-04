'use client';

/**
 * The approval queue, in the dashboard.
 *
 * Co-owner decisions used to travel by email: each party got a one-time link
 * and had to find that email to act. This panel replaces it — anything waiting
 * on the signed-in member is shown here, stays here until decided, and can be
 * decided at any time. It renders above the tab content on every tab, so a
 * waiting approval is impossible to miss.
 */

import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { ChainAccountSessionManager } from '@/lib/chain-account-session';

export interface PendingApproval {
  kind: 'WITHDRAWAL' | 'INVESTMENT' | 'CLOSURE' | 'MODIFICATION' | 'REMOVAL_TARGET' | 'REMOVAL_VOTE';
  id: string;
  title: string;
  description: string;
  reference: string | null;
  amount: number | null;
  currency: string | null;
  memberShare: number | null;
  initiatorName: string;
  awaitingCount: number;
  createdAt: string;
}

interface Props {
  chainAccountId: string;
  approvals: PendingApproval[];
  /** Called after a decision lands so the dashboard can reload. */
  onDecided: () => void;
}

const KIND_LABELS: Record<PendingApproval['kind'], string> = {
  WITHDRAWAL: 'Withdrawal',
  INVESTMENT: 'Investment',
  CLOSURE: 'Account closure',
  MODIFICATION: 'Account change',
  REMOVAL_TARGET: 'Your removal',
  REMOVAL_VOTE: 'Member removal',
};

export default function PendingApprovalsPanel({ chainAccountId, approvals, onDecided }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (approvals.length === 0) return null;

  const decide = async (approval: PendingApproval, decision: 'APPROVED' | 'REJECTED') => {
    const verb = decision === 'APPROVED' ? 'approve' : 'reject';

    if (approval.kind === 'REMOVAL_TARGET' && decision === 'APPROVED') {
      if (!confirm('Approving removes you from this Chain Account straight away. Continue?')) return;
    } else if (!confirm(`Are you sure you want to ${verb} this request?`)) {
      return;
    }

    const notes =
      decision === 'REJECTED'
        ? window.prompt('Optional: why are you rejecting this?') || undefined
        : undefined;

    setBusyId(approval.id);

    try {
      const response = await axios.post(
        '/api/chain-account/approvals',
        { chainAccountId, kind: approval.kind, id: approval.id, decision, notes },
        { headers: { Authorization: `Bearer ${ChainAccountSessionManager.getToken()}` } }
      );
      toast.success(response.data.message || 'Your decision has been recorded');
      onDecided();
    } catch (error) {
      console.error('Error recording approval decision:', error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error
        : undefined;
      toast.error(message || 'Failed to record your decision');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border-l-4 border-amber-500 p-4 sm:p-6 mb-5 sm:mb-6">
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            Waiting for your approval
            <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full align-middle">
              {approvals.length}
            </span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            These requests need your decision. They stay here until you act — you can approve or
            reject at any time.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {approvals.map((approval) => {
          const busy = busyId === approval.id;

          return (
            <div
              key={`${approval.kind}-${approval.id}`}
              className="border border-gray-200 rounded-lg p-3.5 sm:p-4 bg-amber-50/40"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {KIND_LABELS[approval.kind]}
                    </span>
                    {approval.reference && (
                      <span className="text-[11px] font-mono text-gray-500">{approval.reference}</span>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900">{approval.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{approval.description}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    <span>Requested by {approval.initiatorName}</span>
                    <span>{new Date(approval.createdAt).toLocaleString()}</span>
                    {approval.awaitingCount > 1 && (
                      <span>{approval.awaitingCount} members still to decide</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => decide(approval, 'APPROVED')}
                    disabled={busy}
                    className="flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => decide(approval, 'REJECTED')}
                    disabled={busy}
                    className="flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

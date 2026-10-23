'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarClock, FileText, LayoutDashboard, Minus,
  PieChart, Sparkles, TrendingUp, Wallet, X,
} from 'lucide-react';

export interface VaultNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const VAULT_NAV: VaultNavItem[] = [
  { label: 'Overview', href: '/retirement-vault/dashboard', icon: LayoutDashboard },
  { label: 'Allocation', href: '/retirement-vault/allocation', icon: PieChart },
  { label: 'Holdings', href: '/retirement-vault/holdings', icon: Wallet },
  { label: 'Performance', href: '/retirement-vault/performance', icon: TrendingUp },
  { label: 'Expert Allocator', href: '/retirement-vault/allocator', icon: Sparkles },
  { label: 'Contributions', href: '/retirement-vault/contributions', icon: CalendarClock },
  { label: 'Withdrawals', href: '/retirement-vault/withdrawals', icon: Minus },
  { label: 'Reports', href: '/retirement-vault/reports', icon: FileText },
];

interface Props {
  vaultNumber: string | null;
  status: string | null;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/**
 * Vault navigation.
 *
 * Styled to match the main app sidebar — dark surface, lime active state — so
 * the vault reads as part of the product rather than a bolted-on section.
 */
export default function VaultSidebar({
  vaultNumber,
  status,
  mobileOpen,
  onMobileClose,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const go = (href: string) => {
    router.push(href);
    onMobileClose();
  };

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-black border-r border-gray-800 flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-gray-800 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">
              <span className="text-[#c1ff72]">Retirement</span> Vault
            </p>
            {vaultNumber && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{vaultNumber}</p>
            )}
            {status && status !== 'ACTIVE' && (
              <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                {status.replace(/_/g, ' ').toLowerCase()}
              </span>
            )}
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden text-gray-400 hover:text-white cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {VAULT_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => go(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#c1ff72] text-black font-medium'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back to main dashboard
          </button>
        </div>
      </aside>
    </>
  );
}

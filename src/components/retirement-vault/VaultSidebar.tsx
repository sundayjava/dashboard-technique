'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarClock, FileText, HelpCircle, LayoutDashboard, Minus,
  PieChart, TrendingUp, Wallet, X,
} from 'lucide-react';

export interface VaultNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const VAULT_NAV: VaultNavItem[] = [
  { label: 'Overview', href: '/retirement-vault/dashboard', icon: LayoutDashboard },
  { label: 'Allocation', href: '/retirement-vault/allocation', icon: PieChart },
  { label: 'Performance', href: '/retirement-vault/performance', icon: TrendingUp },
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
 * A light rail with a soft filled active state, rather than the dark sidebar
 * the main app uses: the vault pages are a light surface throughout, and a
 * black rail beside them reads as a different product.
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
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[248px] bg-white border-r border-gray-100 flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-6 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#c1ff72] flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 text-black" />
              </span>
              <span className="text-base font-bold text-gray-900 tracking-tight">
                Vault
              </span>
            </div>
            {vaultNumber && (
              <p className="text-xs text-gray-400 mt-2 truncate">{vaultNumber}</p>
            )}
            {status && status !== 'ACTIVE' && (
              <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                {status.replace(/_/g, ' ').toLowerCase()}
              </span>
            )}
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden text-gray-400 hover:text-gray-900 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {VAULT_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => go(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer ${
                  active
                    ? 'bg-gray-100 text-gray-900 font-semibold'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-gray-900' : 'text-gray-400'}`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 space-y-1">
          <button
            onClick={() => router.push('/dashboard/support/faq')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-[18px] h-[18px] shrink-0 text-gray-400" />
            FAQs
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-[18px] h-[18px] shrink-0 text-gray-400" />
            Main dashboard
          </button>
        </div>
      </aside>
    </>
  );
}

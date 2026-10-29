'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, Bell, Loader2, Menu, User } from 'lucide-react';
import VaultSidebar, { VAULT_NAV } from '@/components/retirement-vault/VaultSidebar';
import { VaultProvider, useVault } from '@/components/retirement-vault/VaultContext';

/**
 * Shell for every vault page: sidebar, header and the shared data fetch.
 *
 * Lives in a route group so /retirement-vault/create — which is onboarding and
 * has no vault to navigate yet — stays outside it.
 */
export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onMissingVault = useCallback(() => {
    router.push('/retirement-vault/create');
  }, [router]);

  // Auth and missing-vault are both handled by the provider's fetch, which
  // already knows which failure it hit. Checking the session separately here
  // would mean redirecting during render, or holding duplicate state purely to
  // avoid that.
  const onUnauthenticated = useCallback(() => {
    router.push('/login');
  }, [router]);

  return (
    <VaultProvider onMissingVault={onMissingVault} onUnauthenticated={onUnauthenticated}>
      <Shell mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
        {children}
      </Shell>
    </VaultProvider>
  );
}

function Shell({
  children,
  mobileOpen,
  setMobileOpen,
}: {
  children: React.ReactNode;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const { data, loading } = useVault();
  const pathname = usePathname();
  const router = useRouter();
  const current = VAULT_NAV.find((n) => n.href === pathname);

  const pendingActivation = data?.vault?.status === 'PENDING_ACTIVATION';
  const incomplete = data?.valuation && !data.valuation.complete;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <VaultSidebar
        vaultNumber={data?.vault?.vaultNumber ?? null}
        status={data?.vault?.status ?? null}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-gray-50/90 backdrop-blur">
          <div className="px-4 lg:px-8 py-5 flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              {current?.label ?? 'Retirement Vault'}
            </h1>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => router.push('/dashboard/notifications')}
                aria-label="Notifications"
                className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/dashboard/account/profile')}
                aria-label="Profile"
                className="w-9 h-9 rounded-full bg-[#c1ff72] flex items-center justify-center text-black text-xs font-bold cursor-pointer"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 lg:px-8 pb-10 max-w-6xl">
          {/* Conditions that matter on every page, so they live in the shell
              rather than being repeated on each one. */}
          {pendingActivation && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Your vault is not active yet
                </p>
                <p className="text-sm text-amber-800 mt-0.5">
                  Nothing is invested until you fund it. Head to Contributions to make your
                  first deposit.
                </p>
              </div>
            </div>
          )}

          {incomplete && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-900">
                Live prices are unavailable for {data?.valuation?.missingPrices.join(', ')}, so
                these figures are incomplete.
              </p>
            </div>
          )}

          {loading && data === null ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

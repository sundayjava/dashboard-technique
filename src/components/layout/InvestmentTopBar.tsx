'use client';

import { useRouter } from 'next/navigation';

interface InvestmentTopBarProps {
  user: any;
  sidebarCollapsed?: boolean;
  onMobileMenuToggle?: () => void;
}

export function InvestmentTopBar({ user, sidebarCollapsed = false, onMobileMenuToggle }: InvestmentTopBarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('logout'));
    router.push('/login');
  };

  return (
    <header className={`fixed top-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 z-30 transition-all duration-300 ${
      sidebarCollapsed ? 'lg:left-20' : 'lg:left-64'
    } left-0`}>
      {/* Mobile Menu Button */}
      <button
        onClick={onMobileMenuToggle}
        className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors mr-2"
      >
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Left Section - Title */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex w-10 h-10 bg-[#c1ff72] rounded-lg items-center justify-center">
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div className="hidden md:block">
          <h1 className="text-lg font-bold text-gray-900">Investment Portal</h1>
          <p className="text-xs text-gray-500">Secure Trading Environment</p>
        </div>
        <div className="md:hidden">
          <h1 className="text-base font-bold text-gray-900">Investment</h1>
        </div>
      </div>

      {/* Right Section - User Menu */}
      <div className="flex items-center gap-3">
        <div className="hidden md:block text-right">
          <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
          <p className="text-xs text-gray-500">Investment Trader</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#c1ff72] rounded-full flex items-center justify-center">
            <span className="text-black font-bold text-sm">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="ml-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

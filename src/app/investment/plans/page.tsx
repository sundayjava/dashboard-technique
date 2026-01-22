'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface InvestmentPlan {
  id: string;
  planName: string;
  minAmount: number;
  maxAmount: number;
  arkIIAllocation: number;
  duration: number;
  profitPercentage: number;
  cryptoAddress: string | null;
  isActive: boolean;
  _count: {
    investments: number;
  };
}

export default function InvestmentPlansPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchPlans();
  }, [router]);

  const fetchPlans = async () => {
    try {
      const response = await axios.get('/api/admin/investment-plans?activeOnly=true');
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load investment plans');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading investment plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar 
        items={investmentSidebarItems}
        userId={user.id}
        user={user}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      
      <InvestmentTopBar 
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <main className={`pt-20 pb-8 px-4 md:px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'
      }`}>
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Investment Plans</h1>
          <p className="text-gray-600">Choose a plan that fits your investment goals</p>
        </div>

        {plans.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Plans Available</h3>
            <p className="text-gray-600">There are currently no active investment plans. Please check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-linear-to-r from-[#c1ff72] to-[#8fd04f] p-6 text-black">
                  <h3 className="text-xl font-bold mb-2">{plan.planName}</h3>
                  <div className="text-2xl font-bold">{plan.profitPercentage}%</div>
                  <p className="text-sm opacity-90">Expected Returns</p>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-semibold text-gray-900">{plan.duration} days</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Min. Investment</span>
                    <span className="font-semibold text-gray-900">${plan.minAmount.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Max. Investment</span>
                    <span className="font-semibold text-gray-900">${plan.maxAmount.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">ARK_II Allocation</span>
                    <span className="font-semibold text-gray-900">{plan.arkIIAllocation.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Active Investors</span>
                    <span className="font-semibold text-[#c1ff72]">{plan._count.investments}</span>
                  </div>

                  <button
                    onClick={() => router.push(`/investment/invest/${plan.id}`)}
                    className="w-full mt-4 px-6 py-3 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Invest Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

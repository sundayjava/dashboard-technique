'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, DollarSign, Activity, Target, Clock, Percent,
  ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';

interface PortfolioAnalytics {
  overview: {
    totalInvested: number;
    activeValue: number;
    totalReturns: number;
    totalProfit: number;
    expectedReturns: number;
    roi: number;
    avgInvestmentSize: number;
    successRate: number;
  };
  counts: {
    total: number;
    active: number;
    completed: number;
    pending: number;
  };
  statusDistribution: Record<string, number>;
  planDistribution: Record<string, { count: number; amount: number; profit: number }>;
  monthlyPerformance: Array<{
    month: string;
    invested: number;
    returns: number;
    profit: number;
    count: number;
  }>;
  activeInvestments: Array<{
    id: string;
    planName: string;
    amount: number;
    progress: number;
    daysRemaining: number;
    expectedProfit: number;
    expectedReturn: number;
    startDate: string;
    endDate: string;
  }>;
  recentInvestments: Array<{
    id: string;
    planName: string;
    amount: number;
    status: string;
    createdAt: string;
    profitEarned: number | null;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function PortfolioAnalytics() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Get user from localStorage like other pages
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchAnalytics(parsedUser.id);
  }, [router]);

  const fetchAnalytics = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching analytics for user:', userId);
      const response = await axios.get('/api/user/portfolio-analytics', {
        params: { userId }
      });
      console.log('Analytics response:', response.data);
      setAnalytics(response.data);
    } catch (error: any) {
      console.error('Error fetching portfolio analytics:', error);
      console.error('Error details:', error.response?.data);
      
      // If unauthorized, redirect to login
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('user');
        toast.error('Session expired. Please login again.');
        router.push('/login');
        return;
      }
      
      setError(error.response?.data?.error || error.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardSidebar 
          items={investmentSidebarItems}
          userId={user?.id}
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
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-800 mb-2">Failed to Load Analytics</h2>
              <p className="text-red-600 mb-4">{error || 'Failed to load portfolio analytics'}</p>
              <button 
                onClick={() => user && fetchAnalytics(user.id)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const statusData = Object.entries(analytics.statusDistribution)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  const planData = Object.entries(analytics.planDistribution).map(([name, data]) => ({
    name,
    ...data
  }));

  const profitChange = analytics.overview.roi;

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
        <div className="max-w-400 mx-auto space-y-4">
          {/* Page Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Portfolio Analytics</h1>
            <p className="text-sm text-gray-600">Track your investment performance and returns</p>
          </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-linear-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="w-7 h-7 text-blue-200" />
            <span className="text-xs bg-blue-400/30 px-2 py-0.5 rounded-full">Total</span>
          </div>
          <p className="text-blue-100 text-xs font-medium">Total Invested</p>
          <h3 className="text-2xl font-bold mt-1">${analytics.overview.totalInvested.toLocaleString()}</h3>
          <p className="text-blue-100 text-xs mt-1">{analytics.counts.total} investments</p>
        </div>

        <div className="bg-linear-to-br from-green-500 to-green-600 rounded-lg p-4 text-white shadow">
          <div className="flex items-center justify-between mb-3">
            <Activity className="w-7 h-7 text-green-200" />
            <span className="text-xs bg-green-400/30 px-2 py-0.5 rounded-full">Active</span>
          </div>
          <p className="text-green-100 text-xs font-medium">Active Value</p>
          <h3 className="text-2xl font-bold mt-1">${analytics.overview.activeValue.toLocaleString()}</h3>
          <p className="text-green-100 text-xs mt-1">{analytics.counts.active} active investments</p>
        </div>

        <div className="bg-linear-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white shadow">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-7 h-7 text-purple-200" />
            <div className="flex items-center">
              {profitChange >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-purple-200" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-purple-200" />
              )}
            </div>
          </div>
          <p className="text-purple-100 text-xs font-medium">Total Returns</p>
          <h3 className="text-2xl font-bold mt-1">${analytics.overview.totalReturns.toLocaleString()}</h3>
          <p className="text-purple-100 text-xs mt-1">
            +${analytics.overview.totalProfit.toLocaleString()} profit
          </p>
        </div>

        <div className="bg-linear-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white shadow">
          <div className="flex items-center justify-between mb-3">
            <Percent className="w-7 h-7 text-orange-200" />
            <span className="text-xs bg-orange-400/30 px-2 py-0.5 rounded-full">ROI</span>
          </div>
          <p className="text-orange-100 text-xs font-medium">Return on Investment</p>
          <h3 className="text-2xl font-bold mt-1">{analytics.overview.roi.toFixed(2)}%</h3>
          <p className="text-orange-100 text-xs mt-1">
            {analytics.overview.successRate.toFixed(1)}% success rate
          </p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
            <Target className="w-4 h-4 mr-2 text-blue-600" />
            Monthly Investment Performance
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={analytics.monthlyPerformance}>
              <defs>
                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="invested" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorInvested)" 
                name="Invested ($)" 
              />
              <Area 
                type="monotone" 
                dataKey="returns" 
                stroke="#10b981" 
                fillOpacity={1} 
                fill="url(#colorReturns)" 
                name="Returns ($)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-base font-bold text-gray-900 mb-3">Investment Status</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Plans Distribution */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-base font-bold text-gray-900 mb-3">Investment by Plan</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={planData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey="amount" fill="#3b82f6" name="Amount Invested ($)" radius={[8, 8, 0, 0]} />
            <Bar dataKey="profit" fill="#10b981" name="Profit Earned ($)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Profit Trend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-base font-bold text-gray-900 mb-3">Profit Growth Trend</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={analytics.monthlyPerformance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Monthly Profit ($)" 
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Active Investments Progress */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
          <Clock className="w-4 h-4 mr-2 text-blue-600" />
          Active Investments Progress
        </h2>
        <div className="space-y-3">
          {analytics.activeInvestments.length > 0 ? (
            analytics.activeInvestments.map((investment) => (
              <div key={investment.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{investment.planName}</h3>
                    <p className="text-sm text-gray-600">${investment.amount.toLocaleString()} invested</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-blue-600">{investment.progress}% Complete</p>
                    <p className="text-xs text-gray-500">{investment.daysRemaining} days left</p>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-linear-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${investment.progress}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Expected Profit</p>
                    <p className="font-semibold text-green-600">
                      +${investment.expectedProfit.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Expected Return</p>
                    <p className="font-semibold text-gray-900">
                      ${investment.expectedReturn.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">End Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(investment.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">No active investments</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <h3 className="text-xs font-medium text-gray-600 mb-1">Expected Returns</h3>
          <p className="text-2xl font-bold text-gray-900">
            ${analytics.overview.expectedReturns.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            From {analytics.counts.active} active investments
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <h3 className="text-xs font-medium text-gray-600 mb-1">Average Investment</h3>
          <p className="text-2xl font-bold text-gray-900">
            ${analytics.overview.avgInvestmentSize.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Per investment
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <h3 className="text-xs font-medium text-gray-600 mb-1">Completed Investments</h3>
          <p className="text-2xl font-bold text-gray-900">
            {analytics.counts.completed}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {analytics.overview.successRate.toFixed(1)}% success rate
          </p>
        </div>
      </div>
        </div>
      </main>
    </div>
  );
}

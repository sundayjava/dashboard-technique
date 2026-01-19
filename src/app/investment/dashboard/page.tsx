'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  DollarSign, BarChart3, Activity, Clock, Calendar, 
  PieChart, Wallet, Plus
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import MiniLineChart from '@/components/MiniLineChart';

interface CryptoToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string;
  priceHistory: { time: string; price: number }[];
}

interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  country: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast: string;
  previous: string;
}

export default function InvestmentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    totalInvested: 0,
    activeInvestments: 0,
    totalReturns: 0,
    portfolioValue: 0,
  });
  const [cryptoData, setCryptoData] = useState<CryptoToken[]>([]);
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [cryptoUpdating, setCryptoUpdating] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Check if user has investment access
    checkInvestmentAccess(parsedUser.id);
    fetchCryptoData();
    fetchEconomicCalendar();

    // Auto-refresh crypto data every 10 seconds
    const interval = setInterval(fetchCryptoData, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const fetchCryptoData = async () => {
    try {
      setCryptoUpdating(true);
      const response = await axios.get('/api/crypto/prices');
      if (response.data.success) {
        setCryptoData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching crypto data:', error);
    } finally {
      setCryptoUpdating(false);
    }
  };

  const fetchEconomicCalendar = async () => {
    try {
      const response = await axios.get('/api/economic-calendar');
      if (response.data.success) {
        setEconomicEvents(response.data.events);
      }
    } catch (error) {
      console.error('Error fetching economic calendar:', error);
    }
  };

  const checkInvestmentAccess = async (userId: string) => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/trade-key/check-access?userId=${userId}`);
      
      if (!response.data.hasAccess) {
        toast.error('You need a valid trade key to access investments');
        router.push('/dashboard');
        return;
      }

      // User has access, load dashboard data
      fetchDashboardStats(userId);
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking access:', error);
      toast.error('Failed to verify investment access');
      router.push('/dashboard');
    }
  };

  const fetchDashboardStats = async (userId: string) => {
    try {
      const response = await axios.get(`/api/investments/stats?userId=${userId}`);
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading investment dashboard...</p>
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
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      }`}>
        <div className="space-y-6">
          {/* Welcome Banner with Gradient */}
          <div className="bg-linear-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-2xl p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">Investment Portfolio Dashboard 📈</h1>
            <p className="text-purple-200">Track your investments and grow your wealth</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Total Invested */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-xs md:text-sm text-gray-600 mb-1">Total Invested</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                ${stats.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Active Investments */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                </div>
                <Activity className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-xs md:text-sm text-gray-600 mb-1">Active Plans</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.activeInvestments}</p>
            </div>

            {/* Total Returns */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <span className="text-xs text-green-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +12.5%
                </span>
              </div>
              <p className="text-xs md:text-sm text-gray-600 mb-1">Total Returns</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                ${stats.totalReturns.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Portfolio Value */}
            <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg border-l-4 border-orange-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <PieChart className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                </div>
                <DollarSign className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-xs md:text-sm text-gray-600 mb-1">Portfolio Value</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                ${stats.portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Quick Investment Actions */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/investment/plans')}
                className="p-4 rounded-xl border-2 border-purple-200 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Plus className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900 text-center">New Investment</p>
              </button>

              <button
                onClick={() => router.push('/investment/my-investments')}
                className="p-4 rounded-xl border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900 text-center">My Investments</p>
              </button>

              <button
                onClick={() => router.push('/investment/analytics')}
                className="p-4 rounded-xl border-2 border-green-200 hover:border-green-500 hover:bg-green-50 transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-green-100 group-hover:bg-green-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900 text-center">Analytics</p>
              </button>
            </div>
          </div>

          {/* Main Content Grid - Crypto Markets + Economic Calendar + Market Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Live Crypto - 3x3 Grid */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900">Live Crypto</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${cryptoUpdating ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className={`text-[10px] font-medium ${cryptoUpdating ? 'text-blue-600' : 'text-green-600'}`}>
                    {cryptoUpdating ? 'Updating...' : 'Real-time'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {cryptoData.slice(0, 9).map((crypto, index) => {
                  const priceHistory = crypto.priceHistory.map(item => item.price);
                  const trend = crypto.change24h >= 0 ? 'up' : 'down';

                  return (
                    <div
                      key={index}
                      className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-all duration-300"
                      style={{ transform: cryptoUpdating ? 'scale(0.95)' : 'scale(1)' }}
                    >
                      <div className="text-[10px] font-bold text-gray-900 mb-0.5 truncate">
                        {crypto.symbol}
                      </div>
                      <div className="text-[9px] font-semibold text-gray-700 mb-1">
                        ${crypto.price < 1 
                          ? crypto.price.toFixed(4)
                          : crypto.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                        }
                      </div>
                      <MiniLineChart 
                        data={priceHistory}
                        trend={trend}
                        height={24}
                      />
                      <div className={`text-[8px] font-semibold mt-0.5 ${
                        crypto.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Economic Calendar */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900">Economic Calendar</h2>
                </div>
              </div>

              <div className="overflow-y-auto max-h-62.5 pr-1 custom-scrollbar-light">
                {economicEvents.slice(0, 10).map((event) => (
                  <div key={event.id} className="mb-3 pb-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-700">{event.country}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          event.impact === 'high' ? 'bg-red-100 text-red-700' :
                          event.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {event.impact.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">{event.time}</span>
                    </div>

                    <p className="text-xs font-semibold text-gray-900 mb-1.5 line-clamp-2">
                      {event.event}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-500">Forecast:</span>
                        <span className="text-[10px] font-semibold text-gray-700">{event.forecast}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-500">Prev:</span>
                        <span className="text-[10px] font-semibold text-gray-600">{event.previous}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Timeline Chart */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900">Market Timeline - 24H</h2>
                </div>
                <span className="text-xs text-gray-500">{cryptoData.length} Assets</span>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 gap-1.5 mb-3 p-2 bg-gray-50 rounded">
                {cryptoData.slice(0, 9).map((crypto, index) => {
                  const colors = [
                    'rgb(59, 130, 246)', // blue
                    'rgb(147, 51, 234)', // purple
                    'rgb(236, 72, 153)', // pink
                    'rgb(34, 197, 94)', // green
                    'rgb(251, 146, 60)', // orange
                    'rgb(14, 165, 233)', // sky
                    'rgb(168, 85, 247)', // violet
                    'rgb(234, 88, 12)', // red-orange
                    'rgb(16, 185, 129)', // emerald
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <div key={index} className="flex items-center gap-1">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      ></div>
                      <span className="text-[9px] font-semibold text-gray-700">{crypto.symbol}</span>
                      <span className={`text-[8px] font-medium ${
                        crypto.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Combined Timeline Chart */}
              <div className="w-full" style={{ height: '100px' }}>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="w-full"
                >
                  <defs>
                    {cryptoData.slice(0, 9).map((crypto, index) => {
                      const colors = [
                        'rgb(59, 130, 246)', // blue
                        'rgb(147, 51, 234)', // purple
                        'rgb(236, 72, 153)', // pink
                        'rgb(34, 197, 94)', // green
                        'rgb(251, 146, 60)', // orange
                        'rgb(14, 165, 233)', // sky
                        'rgb(168, 85, 247)', // violet
                        'rgb(234, 88, 12)', // red-orange
                        'rgb(16, 185, 129)', // emerald
                      ];
                      const color = colors[index % colors.length];

                      return (
                        <linearGradient key={index} id={`gradient-invest-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                        </linearGradient>
                      );
                    })}
                  </defs>

                  {/* Draw all crypto lines */}
                  {cryptoData.slice(0, 9).map((crypto, index) => {
                    const colors = [
                      'rgb(59, 130, 246)', // blue
                      'rgb(147, 51, 234)', // purple
                      'rgb(236, 72, 153)', // pink
                      'rgb(34, 197, 94)', // green
                      'rgb(251, 146, 60)', // orange
                      'rgb(14, 165, 233)', // sky
                      'rgb(168, 85, 247)', // violet
                      'rgb(234, 88, 12)', // red-orange
                      'rgb(16, 185, 129)', // emerald
                    ];
                    const color = colors[index % colors.length];

                    // Get all prices from all cryptos to find global min/max for proper scaling
                    const allPrices = cryptoData.slice(0, 9).flatMap(c => 
                      c.priceHistory.map(item => item.price)
                    );
                    const globalMax = Math.max(...allPrices);
                    const globalMin = Math.min(...allPrices);
                    const range = globalMax - globalMin || 1;

                    // Normalize this crypto's prices
                    const prices = crypto.priceHistory.map(item => item.price);
                    const points = prices.map((price, i) => {
                      const x = (i / (prices.length - 1)) * 100;
                      const y = 100 - ((price - globalMin) / range) * 90; // Use 90% of height
                      return `${x},${y}`;
                    });

                    const pathD = `M ${points.join(' L ')}`;
                    const areaD = `M 0,100 L ${points.join(' L ')} L 100,100 Z`;

                    return (
                      <g key={index}>
                        {/* Area fill */}
                        <path 
                          d={areaD} 
                          fill={`url(#gradient-invest-${index})`}
                          className="transition-all duration-700"
                        />

                        {/* Line */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={color}
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                          className="transition-all duration-700"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.9"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Timeline labels */}
              <div className="flex justify-between mt-2 px-1">
                <span className="text-[10px] text-gray-500 font-medium">24h ago</span>
                <span className="text-[10px] text-gray-500 font-medium">Now</span>
              </div>

              {/* Stats Summary */}
              {cryptoData.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">Highest</div>
                    <div className="text-xs font-bold text-green-600">
                      {cryptoData.slice(0, 9).reduce((max, c) => c.change24h > max.change24h ? c : max).symbol}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">Average</div>
                    <div className="text-xs font-bold text-gray-900">
                      {(cryptoData.slice(0, 9).reduce((sum, c) => sum + c.change24h, 0) / cryptoData.slice(0, 9).length).toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500">Lowest</div>
                    <div className="text-xs font-bold text-red-600">
                      {cryptoData.slice(0, 9).reduce((min, c) => c.change24h < min.change24h ? c : min).symbol}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Old Market Overview - Keep for reference */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Detailed Market Overview</h2>
              <div className="flex items-center text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                Live
              </div>
            </div>

            <div className="space-y-3">
              {cryptoData.slice(0, 8).map((crypto, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-10 h-10 bg-linear-to-br from-purple-800 to-indigo-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {crypto.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{crypto.symbol}</p>
                      <p className="text-xs text-gray-500">{crypto.name}</p>
                    </div>
                  </div>

                  <div className="flex-1 max-w-30 h-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={crypto.priceHistory}>
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          stroke={crypto.change24h >= 0 ? '#10b981' : '#ef4444'} 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-sm flex items-center justify-end ${crypto.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {crypto.change24h >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 mr-1" />
                      )}
                      {Math.abs(crypto.change24h).toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Old Economic Calendar Section - Removed to avoid duplication */}
          {/* Kept only in the 3-column grid above */}

          {/* Investment Tips */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Investment Tips</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-blue-600 font-bold">💡</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Diversify Your Portfolio</h3>
                  <p className="text-sm text-gray-600">Spread investments across different plans to minimize risk</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-purple-600 font-bold">📊</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Monitor Market Trends</h3>
                  <p className="text-sm text-gray-600">Stay informed with our real-time market data and analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

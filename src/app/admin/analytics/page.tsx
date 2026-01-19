'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Users, DollarSign, Award, Activity, Target } from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalUsers: number;
    totalInvestments: number;
    totalInvested: number;
    totalReturns: number;
    totalPlans: number;
    totalTradeKeys: number;
    activeInvestors: number;
  };
  recentActivity: {
    newUsersLast30Days: number;
    newInvestmentsLast30Days: number;
    revenueLast30Days: number;
  };
  statusBreakdown: Record<string, number>;
  revenueByStatus: Record<string, number>;
  topPlans: Array<{
    planName: string;
    totalInvestments: number;
    totalAmount: number;
    avgAmount: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    investments: number;
    revenue: number;
    newUsers: number;
    completedInvestments: number;
  }>;
  paymentMethods: Record<string, number>;
  performance: {
    avgROI: number;
    completedInvestments: number;
    totalProfit: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/analytics');
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load analytics data</p>
        <button 
          onClick={fetchAnalytics}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const statusData = Object.entries(analytics.statusBreakdown).map(([name, value]) => ({
    name,
    value
  }));

  const paymentData = Object.entries(analytics.paymentMethods).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">Comprehensive overview of your investment platform performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-linear-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Users</p>
              <h3 className="text-3xl font-bold mt-2">{analytics.overview.totalUsers.toLocaleString()}</h3>
              <p className="text-blue-100 text-xs mt-2">
                +{analytics.recentActivity.newUsersLast30Days} this month
              </p>
            </div>
            <Users className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-linear-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Invested</p>
              <h3 className="text-3xl font-bold mt-2">${analytics.overview.totalInvested.toLocaleString()}</h3>
              <p className="text-green-100 text-xs mt-2">
                {analytics.overview.totalInvestments} investments
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-green-200" />
          </div>
        </div>

        <div className="bg-linear-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Total Returns</p>
              <h3 className="text-3xl font-bold mt-2">${analytics.overview.totalReturns.toLocaleString()}</h3>
              <p className="text-purple-100 text-xs mt-2">
                ${analytics.performance.totalProfit.toLocaleString()} profit
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-200" />
          </div>
        </div>

        <div className="bg-linear-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Average ROI</p>
              <h3 className="text-3xl font-bold mt-2">{analytics.performance.avgROI.toFixed(2)}%</h3>
              <p className="text-orange-100 text-xs mt-2">
                {analytics.overview.activeInvestors} active investors
              </p>
            </div>
            <Award className="w-12 h-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Monthly Performance Trends
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics.monthlyTrends}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorInvestments" x1="0" y1="0" x2="0" y2="1">
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
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
              <Area type="monotone" dataKey="investments" stroke="#10b981" fillOpacity={1} fill="url(#colorInvestments)" name="Investments (#)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Investment Status Distribution */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-blue-600" />
            Investment Status Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={100}
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

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Investment Plans */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top Investment Plans</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.topPlans}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="planName" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="totalAmount" fill="#3b82f6" name="Total Amount ($)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="totalInvestments" fill="#10b981" name="Count" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Method Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">User & Investment Growth</h2>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={analytics.monthlyTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis yAxisId="left" stroke="#6b7280" />
            <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              yAxisId="left" 
              type="monotone" 
              dataKey="newUsers" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              name="New Users" 
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="completedInvestments" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Completed Investments" 
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-600 mb-2">30-Day Activity</h3>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">
              {analytics.recentActivity.newInvestmentsLast30Days}
            </p>
            <p className="text-sm text-gray-600">New Investments</p>
            <p className="text-xl font-semibold text-green-600">
              ${analytics.recentActivity.revenueLast30Days.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Revenue Generated</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Platform Health</h3>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">
              {analytics.overview.totalPlans}
            </p>
            <p className="text-sm text-gray-600">Active Plans</p>
            <p className="text-xl font-semibold text-blue-600">
              {analytics.overview.totalTradeKeys}
            </p>
            <p className="text-xs text-gray-500">Active Trade Keys</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Performance Metrics</h3>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">
              {analytics.performance.completedInvestments}
            </p>
            <p className="text-sm text-gray-600">Completed Investments</p>
            <p className="text-xl font-semibold text-green-600">
              ${analytics.performance.totalProfit.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Total Profit Distributed</p>
          </div>
        </div>
      </div>
    </div>
  );
}

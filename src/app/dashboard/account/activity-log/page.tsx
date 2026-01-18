'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Filter, Activity, Monitor, Smartphone, MapPin } from 'lucide-react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import axios from 'axios';

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-100 text-green-800 border-green-200',
  LOGOUT: 'bg-gray-100 text-gray-800 border-gray-200',
  PASSWORD_CHANGED: 'bg-blue-100 text-blue-800 border-blue-200',
  PIN_CHANGED: 'bg-purple-100 text-purple-800 border-purple-200',
  PROFILE_UPDATED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  KYC_SUBMITTED: 'bg-orange-100 text-orange-800 border-orange-200',
  TRANSACTION: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  DEFAULT: 'bg-gray-100 text-gray-800 border-gray-200',
};

const getActionIcon = (action: string) => {
  const iconProps = { className: "w-4 h-4" };
  switch (action) {
    case 'LOGIN':
    case 'LOGOUT':
      return <Activity {...iconProps} />;
    default:
      return <Monitor {...iconProps} />;
  }
};

export default function ActivityLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const getUserId = () => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          return userData.id;
        } catch (error) {
          console.error('Error parsing stored user:', error);
        }
      }
    }
    return null;
  };

  useEffect(() => {
    fetchLogs();
  }, [filter, offset]);

  const fetchLogs = async () => {
    const userId = getUserId();
    if (!userId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (filter !== 'ALL') {
        params.append('action', filter);
      }

      const response = await axios.get(`/api/activity-log?${params}`);
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceType = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown Device';
    if (/mobile/i.test(userAgent)) return 'Mobile Device';
    if (/tablet/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
  };

  const getBrowserName = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown Browser';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other Browser';
  };

  return (
    <DashboardLayoutWrapper>
      <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-[#c1ff72] rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
                <p className="text-gray-600">Track your account activity and security events</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Filter className="w-4 h-4" />
                <span className="font-medium">Filter:</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['ALL', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGED', 'PIN_CHANGED', 'PROFILE_UPDATED', 'KYC_SUBMITTED', 'TRANSACTION'].map((action) => (
                  <button
                    key={action}
                    onClick={() => {
                      setFilter(action);
                      setOffset(0);
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      filter === action
                        ? 'bg-[#c1ff72] text-black'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {action.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Activity List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Activity ({total} {total === 1 ? 'event' : 'events'})
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg">Loading activity logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">No activity found</p>
                <p className="text-gray-400 text-sm">
                  {filter === 'ALL' 
                    ? 'Your account activity will appear here'
                    : 'Try selecting a different filter'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="shrink-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          ACTION_COLORS[log.action] || ACTION_COLORS.DEFAULT
                        }`}>
                          {getActionIcon(log.action)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {log.action.replace(/_/g, ' ')}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">{log.description}</p>
                          </div>
                          <span className="text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          {log.ipAddress && log.ipAddress !== 'unknown' && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{log.ipAddress}</span>
                            </div>
                          )}
                          {log.userAgent && log.userAgent !== 'unknown' && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Smartphone className="w-3.5 h-3.5" />
                                <span>{getDeviceType(log.userAgent)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Monitor className="w-3.5 h-3.5" />
                                <span>{getBrowserName(log.userAgent)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && logs.length > 0 && total > limit && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-900 text-sm mb-1">Security Tip</h3>
            <p className="text-yellow-800 text-sm">
              Review your activity log regularly. If you notice any suspicious activity, change your password immediately and contact support.
            </p>
          </div>
        </div>
    </DashboardLayoutWrapper>
  );
}

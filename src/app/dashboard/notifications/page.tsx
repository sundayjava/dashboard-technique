'use client';

import { useState, useEffect } from 'react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import { Bell, X, Trash2, Check, CheckCheck } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

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

  const fetchNotifications = async () => {
    const userId = getUserId();
    if (!userId) return;

    setLoading(true);
    try {
      const response = await axios.get(`/api/notifications?userId=${userId}`);
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await axios.patch(`/api/notifications/${notificationId}`);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      await axios.post('/api/notifications/mark-all-read', { userId });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await axios.delete(`/api/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TRANSACTION':
        return '💳';
      case 'SECURITY':
        return '🔒';
      case 'LOAN':
        return '💰';
      case 'KYC':
        return '✅';
      case 'CARD':
        return '💳';
      case 'WELCOME':
        return '👋';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'TRANSACTION':
        return 'border-green-200 bg-green-50/50';
      case 'SECURITY':
        return 'border-red-200 bg-red-50/50';
      case 'LOAN':
        return 'border-blue-200 bg-blue-50/50';
      case 'KYC':
        return 'border-yellow-200 bg-yellow-50/50';
      default:
        return 'border-gray-200 bg-gray-50/50';
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <DashboardLayoutWrapper>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Bell className="w-8 h-8 text-gray-900" />
              <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-[#c1ff72] text-gray-900 font-medium rounded-lg hover:bg-[#b0ef62] transition-colors"
              >
                <CheckCheck className="w-5 h-5" />
                Mark all as read
              </button>
            )}
          </div>
          <p className="text-gray-600">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'You\'re all caught up!'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-[#c1ff72] text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-[#c1ff72] text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-[#c1ff72] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 text-lg">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center bg-white border border-gray-200 rounded-lg">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </p>
            <p className="text-gray-400 text-sm">
              {filter === 'unread' ? 'All notifications have been read' : 'You don\'t have any notifications yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white border rounded-lg p-5 transition-all hover:shadow-md ${
                  !notification.isRead ? 'border-l-4 border-l-blue-500 ' + getNotificationColor(notification.type) : 'border-gray-200'
                } ${notification.link ? 'cursor-pointer' : ''}`}
                onClick={() => notification.link && handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="shrink-0">
                    <span className="text-4xl">{getNotificationIcon(notification.type)}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`text-base font-semibold text-gray-900 ${!notification.isRead ? 'font-bold' : ''}`}>
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <span className="shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                    <p className="text-xs text-gray-400">{formatTimeAgo(notification.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!notification.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-5 h-5 text-gray-600" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayoutWrapper>
  );
}

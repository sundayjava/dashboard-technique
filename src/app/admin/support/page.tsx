'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  pending: number;
  replied: number;
  closed: number;
}

export default function AdminSupportPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, replied: 0, closed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [activeFilter]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/admin/support?status=${activeFilter}`);
      setMessages(response.data.messages);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    setIsSending(true);

    try {
      // Get admin user ID from localStorage or context
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const adminId = user?.id || 'admin';

      await axios.put('/api/admin/support', {
        id: selectedMessage.id,
        adminReply: replyText,
        repliedBy: adminId,
        status: 'REPLIED',
      });

      toast.success('Reply sent successfully!');
      setShowReplyModal(false);
      setSelectedMessage(null);
      setReplyText('');
      fetchMessages();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      await axios.delete(`/api/admin/support?id=${id}`);
      toast.success('Message deleted successfully');
      fetchMessages();
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const adminId = user?.id || 'admin';

      await axios.put('/api/admin/support', {
        id,
        adminReply: '',
        repliedBy: adminId,
        status,
      });

      toast.success('Status updated successfully');
      fetchMessages();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const openReplyModal = (message: ContactMessage) => {
    setSelectedMessage(message);
    setReplyText(message.adminReply || '');
    setShowReplyModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#c1ff72', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Customer Support</h1>
        <p className="text-gray-600">Manage and respond to customer inquiries</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Total Messages</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-4">
          <p className="text-xs text-yellow-800 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
          <p className="text-xs text-green-800 mb-1">Replied</p>
          <p className="text-2xl font-bold text-green-900">{stats.replied}</p>
        </div>
        <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Closed</p>
          <p className="text-2xl font-bold text-gray-900">{stats.closed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['ALL', 'PENDING', 'REPLIED', 'CLOSED'].map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
              activeFilter === filter
                ? 'bg-[#c1ff72] text-black'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {messages.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            No messages found
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {messages.map((message) => (
              <div key={message.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{message.subject}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        message.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        message.status === 'REPLIED' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {message.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">{message.name}</span> ({message.email})
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{message.message}</p>
                    
                    {message.adminReply && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                        <p className="text-xs text-green-800 font-semibold mb-1">Admin Reply:</p>
                        <p className="text-sm text-green-900 whitespace-pre-wrap">{message.adminReply}</p>
                        {message.repliedAt && (
                          <p className="text-xs text-green-600 mt-2">
                            Replied on {new Date(message.repliedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      Received: {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openReplyModal(message)}
                    className="px-4 py-2 bg-[#c1ff72] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm"
                  >
                    {message.adminReply ? 'Edit Reply' : 'Reply'}
                  </button>
                  
                  {message.status !== 'CLOSED' && (
                    <button
                      onClick={() => handleUpdateStatus(message.id, 'CLOSED')}
                      className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                      Mark as Closed
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(message.id)}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {showReplyModal && selectedMessage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowReplyModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Reply to Message</h2>
              <button
                onClick={() => setShowReplyModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Original Message */}
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Original Message:</p>
                <p className="text-sm text-gray-900 mb-2"><strong>From:</strong> {selectedMessage.name} ({selectedMessage.email})</p>
                <p className="text-sm text-gray-900 mb-2"><strong>Subject:</strong> {selectedMessage.subject}</p>
                <p className="text-sm text-gray-700">{selectedMessage.message}</p>
              </div>

              {/* Reply Text */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Reply <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                  rows={8}
                  placeholder="Type your reply here..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReplyModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReply}
                  disabled={isSending || !replyText.trim()}
                  className="flex-1 px-6 py-3 bg-[#c1ff72] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { sidebarItems } from '@/config/sidebar.config';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authorizationCode: string;
  avatar?: string | null;
}

interface Message {
  id: string;
  subject?: string;
  content: string;
  isRead: boolean;
  senderId: string;
  receiverId: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    avatar?: string | null;
    role: string;
  };
  receiver: {
    id: string;
    name: string | null;
    email: string;
    avatar?: string | null;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function MessagePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [adminId, setAdminId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role === 'ADMIN') {
      router.push('/admin/dashboard');
      return;
    }

    setUser(parsedUser);
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchMessages();
      fetchAdmin();
      // Poll for new messages every 10 seconds
      const interval = setInterval(fetchMessages, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchAdmin = async () => {
    try {
      const response = await axios.get('/api/admin');
      setAdminId(response.data.id);
    } catch (error) {
      console.error('Error fetching admin:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    if (!user) return;

    try {
      const response = await axios.get(`/api/messages?userId=${user.id}`);
      setMessages(response.data.messages);
      
      // Mark unread messages as read
      const unreadMessages = response.data.messages.filter(
        (msg: Message) => !msg.isRead && msg.receiverId === user.id
      );
      
      for (const msg of unreadMessages) {
        await axios.patch(`/api/messages/${msg.id}`);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user || !adminId) {
      if (!adminId) {
        alert('Unable to send message. Admin not available.');
      }
      return;
    }

    setSending(true);
    try {
      await axios.post('/api/messages', {
        senderId: user.id,
        receiverId: adminId,
        subject: subject.trim() || undefined,
        content: newMessage.trim()
      });

      setNewMessage('');
      setSubject('');
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar 
        items={sidebarItems}
        userId={user.id}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <DashboardTopBar 
        user={user} 
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Content */}
      <main className={`pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#c1ff72] rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                <p className="text-gray-600">Chat with support team</p>
              </div>
            </div>
          </div>

          {/* Chat Container */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-lg font-medium">No messages yet</p>
                  <p className="text-sm">Start a conversation with our support team</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isCurrentUser = message.senderId === user.id;
                  const displayUser = isCurrentUser ? message.receiver : message.sender;
                  
                  return (
                    <div key={message.id} className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${
                        isCurrentUser ? 'bg-[#c1ff72] text-black' : 'bg-gray-700'
                      }`}>
                        {displayUser.avatar ? (
                          <img src={displayUser.avatar} alt={displayUser.name || displayUser.email} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (displayUser.name || displayUser.email)[0].toUpperCase()
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={`flex-1 max-w-lg ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {isCurrentUser ? 'You' : (displayUser.name || displayUser.email)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(message.createdAt)}
                          </span>
                        </div>
                        
                        {message.subject && (
                          <div className="text-sm font-semibold text-gray-800 mb-1">
                            {message.subject}
                          </div>
                        )}
                        
                        <div className={`rounded-lg px-4 py-2 ${
                          isCurrentUser 
                            ? 'bg-[#c1ff72] text-black' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-3 md:p-4 bg-gray-50">
              <div className="space-y-2 md:space-y-3">
                {/* Subject (optional) - Hidden on mobile */}
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (optional)"
                  className="hidden md:block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent text-sm"
                />

                {/* Message Input */}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Type your message..."
                    rows={2}
                    className="flex-1 px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent resize-none text-sm"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim() || !adminId}
                    className="shrink-0 w-10 h-10 md:w-auto md:h-auto md:px-6 md:py-2 bg-[#c1ff72] text-black font-semibold rounded-lg hover:bg-[#b0ef62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center md:gap-2"
                    title={sending ? "Sending..." : "Send message"}
                  >
                    {sending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span className="hidden md:inline">Sending...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span className="hidden md:inline">Send</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

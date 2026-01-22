'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Search, Loader2, User, Mail, Clock, CheckCheck } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

interface Message {
  id: string;
  subject: string | null;
  content: string;
  isRead: boolean;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
    role: string;
  };
  receiver: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
    role: string;
  };
}

interface Conversation {
  userId: string;
  userName: string | null;
  userEmail: string;
  userAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [adminId, setAdminId] = useState<string>('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setAdminId(user.id);
      fetchMessages(user.id);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async (userId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/messages?userId=${userId}`);
      const allMessages: Message[] = response.data.messages || [];
      
      // Group messages by conversation (other user)
      const conversationsMap = new Map<string, Conversation>();
      
      allMessages.forEach((message) => {
        const otherUser = message.senderId === userId ? message.receiver : message.sender;
        const otherUserId = otherUser.id;
        
        if (!conversationsMap.has(otherUserId)) {
          conversationsMap.set(otherUserId, {
            userId: otherUserId,
            userName: otherUser.name,
            userEmail: otherUser.email,
            userAvatar: otherUser.avatar,
            lastMessage: message.content,
            lastMessageTime: message.createdAt,
            unreadCount: 0,
            messages: []
          });
        }
        
        const conversation = conversationsMap.get(otherUserId)!;
        conversation.messages.push(message);
        
        // Update last message if this is more recent
        if (new Date(message.createdAt) > new Date(conversation.lastMessageTime)) {
          conversation.lastMessage = message.content;
          conversation.lastMessageTime = message.createdAt;
        }
        
        // Count unread messages sent to admin
        if (message.receiverId === userId && !message.isRead) {
          conversation.unreadCount++;
        }
      });
      
      // Convert map to array and sort by last message time
      const conversationsArray = Array.from(conversationsMap.values())
        .map(conv => ({
          ...conv,
          messages: conv.messages.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        }))
        .sort((a, b) => 
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );
      
      setConversations(conversationsArray);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Mark all unread messages in this conversation as read
    const unreadMessageIds = conversation.messages
      .filter(msg => msg.receiverId === adminId && !msg.isRead)
      .map(msg => msg.id);
    
    if (unreadMessageIds.length > 0) {
      try {
        await Promise.all(
          unreadMessageIds.map(id => axios.patch(`/api/messages/${id}`, { isRead: true }))
        );
        
        // Update local state
        setConversations(prev => 
          prev.map(conv => 
            conv.userId === conversation.userId 
              ? { ...conv, unreadCount: 0, messages: conv.messages.map(msg => ({ ...msg, isRead: true })) }
              : conv
          )
        );
        
        if (selectedConversation?.userId === conversation.userId) {
          setSelectedConversation(prev => prev ? {
            ...prev,
            unreadCount: 0,
            messages: prev.messages.map(msg => ({ ...msg, isRead: true }))
          } : null);
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!replyMessage.trim() || !selectedConversation) return;
    
    setSending(true);
    try {
      const response = await axios.post('/api/messages', {
        senderId: adminId,
        receiverId: selectedConversation.userId,
        subject: 'Admin Reply',
        content: replyMessage.trim()
      });
      
      const newMessage = response.data.data; // API returns { message: '...', data: {...} }
      
      // Update conversations
      setConversations(prev => 
        prev.map(conv => {
          if (conv.userId === selectedConversation.userId) {
            return {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessage: newMessage.content,
              lastMessageTime: newMessage.createdAt
            };
          }
          return conv;
        }).sort((a, b) => 
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        )
      );
      
      // Update selected conversation
      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, newMessage],
        lastMessage: newMessage.content,
        lastMessageTime: newMessage.createdAt
      } : null);
      
      setReplyMessage('');
      toast.success('Message sent');
      scrollToBottom();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(conv => 
    conv.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        <p className="mt-2 text-gray-600">Communicate with users and respond to their inquiries</p>
      </div>

      {/* Messages Interface */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 h-[calc(100vh-16rem)]">
          {/* Conversations List */}
          <div className="lg:col-span-1 border-r border-gray-200">
            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="overflow-y-auto h-[calc(100%-5rem)]">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium text-lg">No conversations yet</p>
                  <p className="text-gray-500 text-sm mt-2">
                    {searchTerm ? 'No results found' : 'Messages from users will appear here'}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.userId}
                    onClick={() => handleSelectConversation(conversation)}
                    className={`w-full p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors text-left ${
                      selectedConversation?.userId === conversation.userId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar 
                        src={conversation.userAvatar} 
                        name={conversation.userName || conversation.userEmail} 
                        size="md" 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {conversation.userName || 'User'}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatTime(conversation.lastMessageTime)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mb-1">
                          {conversation.userEmail}
                        </p>
                        <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                          {conversation.lastMessage}
                        </p>
                      </div>
                      {conversation.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      src={selectedConversation.userAvatar} 
                      name={selectedConversation.userName || selectedConversation.userEmail} 
                      size="md" 
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedConversation.userName || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">{selectedConversation.userEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedConversation.messages.map((message, index) => {
                    const isAdmin = message.senderId === adminId;
                    return (
                      <div
                        key={`${message.id}-${index}`}
                        className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${isAdmin ? 'order-2' : 'order-1'}`}>
                          <div
                            className={`rounded-lg p-3 ${
                              isAdmin
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {message.subject && (
                              <p className={`text-xs font-semibold mb-1 ${isAdmin ? 'text-blue-100' : 'text-gray-500'}`}>
                                {message.subject}
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          </div>
                          <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(message.createdAt)}</span>
                            {isAdmin && message.isRead && (
                              <CheckCheck className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Box */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply..."
                      rows={3}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !replyMessage.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-fit"
                    >
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      Send
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <MessageSquare className="w-24 h-24 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium text-lg">Select a conversation</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Choose a conversation from the list to view and reply to messages
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CreditCard, Plus, Edit2, Trash2, Loader2, Search } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Card {
  id: string;
  userId: string;
  user: User;
  cardNumber: string;
  cardType: string;
  expiryDate: string;
  status: string;
  cardLimit: number;
  createdAt: string;
}

export default function CardManagementPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [formData, setFormData] = useState({
    userId: '',
    cardType: 'DEBIT',
    expiryDate: '',
    status: 'ACTIVE',
    cardLimit: 10000,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cardsRes, usersRes] = await Promise.all([
        axios.get('/api/admin/cards').catch(() => ({ data: [] })),
        axios.get('/api/admin/users').catch(() => ({ data: [] })),
      ]);
      setCards(cardsRes.data);
      setUsers(usersRes.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch data');
      setCards([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingCard) {
        await axios.patch(`/api/admin/cards/${editingCard.id}`, formData);
        toast.success('Card updated successfully');
      } else {
        await axios.post('/api/admin/cards', formData);
        toast.success('Card created successfully');
      }
      
      setShowModal(false);
      setEditingCard(null);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      cardType: 'DEBIT',
      expiryDate: '',
      status: 'ACTIVE',
      cardLimit: 10000,
    });
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setFormData({
      userId: card.userId,
      cardType: card.cardType,
      expiryDate: card.expiryDate,
      status: card.status,
      cardLimit: card.cardLimit,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this card?')) return;

    try {
      await axios.delete(`/api/admin/cards/${id}`);
      toast.success('Card deleted successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete card');
    }
  };

  const filteredCards = cards.filter(card =>
    card.user.name.toLowerCase().includes(search.toLowerCase()) ||
    card.user.email.toLowerCase().includes(search.toLowerCase()) ||
    card.cardNumber.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Card Management</h1>
          <p className="mt-2 text-gray-600">Manage user debit and credit cards</p>
        </div>
        <button
          onClick={() => {
            setEditingCard(null);
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Issue Card
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by user or card number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <CreditCard className="w-16 h-16 text-gray-400 mb-2" />
              <p className="text-gray-900 font-medium text-lg">No cards issued yet</p>
              <p className="text-gray-500">Click "Issue Card" to create your first card</p>
            </div>
          </div>
        ) : (
          filteredCards.map((card) => (
            <div key={card.id} className="bg-linear-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-8">
                <CreditCard className="w-10 h-10" />
                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                  card.status === 'ACTIVE' 
                    ? 'bg-green-500'
                    : card.status === 'BLOCKED'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
                }`}>
                  {card.status}
                </span>
              </div>
              
              <div className="mb-6">
                <div className="text-xl font-mono tracking-wider mb-2">
                  {card.cardNumber}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>VALID THRU</span>
                  <span className="font-mono">{card.expiryDate}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs opacity-75 mb-1">CARDHOLDER</div>
                  <div className="font-semibold">{card.user.name}</div>
                  <div className="text-xs opacity-75">{card.cardType}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(card)}
                    className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(card.id)}
                    className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white border-opacity-20">
                <div className="text-xs opacity-75">Card Limit</div>
                <div className="text-lg font-semibold">${card.cardLimit.toLocaleString()}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingCard ? 'Edit Card' : 'Issue New Card'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={!!editingCard}
                >
                  <option value="">Select User</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.cardType}
                  onChange={(e) => setFormData({ ...formData, cardType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="DEBIT">Debit Card</option>
                  <option value="CREDIT">Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date (MM/YY) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  placeholder="12/25"
                  pattern="[0-9]{2}/[0-9]{2}"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Limit ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.cardLimit}
                  onChange={(e) => setFormData({ ...formData, cardLimit: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="ACTIVE">Active</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving...' : editingCard ? 'Update' : 'Issue'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCard(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

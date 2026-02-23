'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Search,
  Loader2,
  X,
  CheckCircle,
  Pencil,
  Trash2,
  Users,
  Hash,
} from 'lucide-react';

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  accounts: { currency: string }[];
}

interface ArkAssignment {
  id: string;
  userId: string;
  amount: number;
  notes: string | null;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

export default function AssignArkTokenPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [assignments, setAssignments] = useState<ArkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Form
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const parsed = JSON.parse(userData);
    if (parsed.role !== 'ADMIN') { router.push('/dashboard'); return; }
    setAdminUser(parsed);
    fetchData(parsed.id);
  }, [router]);

  const fetchData = async (adminId: string) => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/admin/assign-ark-token?adminId=${adminId}`);
      setUsers(res.data.users);
      setAssignments(res.data.assignments);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = useCallback(async (query: string) => {
    if (!adminUser) return;
    try {
      setSearching(true);
      const res = await axios.get(
        `/api/admin/assign-ark-token?adminId=${adminUser.id}${query ? `&search=${encodeURIComponent(query)}` : ''}`
      );
      setSearchResults(res.data.users.slice(0, 10));
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }, [adminUser]);

  useEffect(() => {
    if (!showDropdown) return;
    const t = setTimeout(() => searchUsers(userSearch), 300);
    return () => clearTimeout(t);
  }, [userSearch, showDropdown, searchUsers]);

  const handleSelectUser = (u: UserOption) => {
    setSelectedUser(u);
    setUserSearch(u.name || u.email);
    setShowDropdown(false);
    // Pre-fill amount if already assigned
    const existing = assignments.find(a => a.userId === u.id);
    if (existing) setAmount(existing.amount.toString());
  };

  const existingAssignment = selectedUser ? assignments.find(a => a.userId === selectedUser.id) : null;

  const handleAssign = async () => {
    if (!selectedUser) return toast.error('Please select a user');
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) return toast.error('Enter a valid ARK II amount');

    try {
      setSubmitting(true);
      const res = await axios.post('/api/admin/assign-ark-token', {
        adminId: adminUser.id,
        userId: selectedUser.id,
        amount: parsed,
        notes: notes || undefined,
      });
      toast.success(res.data.message);
      setSelectedUser(null);
      setUserSearch('');
      setAmount('');
      setNotes('');
      fetchData(adminUser.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign ARK II');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (assignmentId: string) => {
    const parsed = parseFloat(editAmount);
    if (!editAmount || isNaN(parsed) || parsed <= 0) return toast.error('Enter a valid amount');

    try {
      setSubmitting(true);
      await axios.patch('/api/admin/assign-ark-token', {
        adminId: adminUser.id,
        assignmentId,
        amount: parsed,
      });
      toast.success('ARK II amount updated');
      setEditingId(null);
      setEditAmount('');
      fetchData(adminUser.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (a: ArkAssignment) => {
    if (!confirm(`Remove ARK II (${a.amount.toLocaleString()}) from ${a.user.name || a.user.email}?`)) return;
    try {
      setRevokingId(a.id);
      await axios.delete(`/api/admin/assign-ark-token?adminId=${adminUser.id}&assignmentId=${a.id}`);
      toast.success('ARK II removed');
      fetchData(adminUser.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove');
    } finally {
      setRevokingId(null);
    }
  };

  const userInitial = (u: { name: string | null; email: string }) =>
    (u.name || u.email).charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assign ARK II</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign an ARK II amount to any user. If the user already has ARK II, their amount will be updated.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Users with ARK II</p>
            <p className="text-xl font-bold text-gray-900">{assignments.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Hash className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total ARK II Assigned</p>
            <p className="text-xl font-bold text-gray-900">
              {assignments.reduce((s, a) => s + a.amount, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Assignment Form */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Assign ARK II to a User</h2>
        </div>
        <div className="p-6 space-y-4">

          {/* User picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              User <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); setShowDropdown(true); }}
                onFocus={() => { setShowDropdown(true); if (searchResults.length === 0) setSearchResults(users.slice(0, 10)); }}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {userSearch && (
                <button onClick={() => { setUserSearch(''); setSelectedUser(null); setShowDropdown(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}

              {showDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {searching ? (
                    <div className="flex justify-center p-3"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>
                  ) : searchResults.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500 text-center">No users found</p>
                  ) : searchResults.map(u => (
                    <button key={u.id} onClick={() => handleSelectUser(u)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{userInitial(u)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name || 'Unnamed'}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      {assignments.find(a => a.userId === u.id) && (
                        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0 font-medium">
                          {assignments.find(a => a.userId === u.id)!.amount.toLocaleString()} ARK II
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedUser && (
              <p className="mt-1.5 text-xs text-green-700 flex items-center gap-1 flex-wrap">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">{selectedUser.name || selectedUser.email}</span>
                {existingAssignment && (
                  <span className="text-orange-600">
                    — currently has <strong>{existingAssignment.amount.toLocaleString()}</strong> ARK II (will be updated)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Amount — the key field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              ARK II Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g.  200"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">Enter the ARK II number to assign to this user</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason or reference..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleAssign}
            disabled={submitting || !selectedUser || !amount}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Saving...' : existingAssignment ? 'Update Amount' : 'Assign ARK II'}
          </button>
        </div>
      </div>

      {/* Assignments table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Current ARK II Assignments</h2>
          <p className="text-xs text-gray-500 mt-0.5">{assignments.length} user{assignments.length !== 1 ? 's' : ''}</p>
        </div>

        {assignments.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Hash className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No ARK II assignments yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">User</th>
                  <th className="px-6 py-3 text-left">ARK II Amount</th>
                  <th className="px-6 py-3 text-left">Notes</th>
                  <th className="px-6 py-3 text-left">Assigned On</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-bold">{userInitial(a.user)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{a.user.name || 'Unnamed'}</p>
                          <p className="text-xs text-gray-500">{a.user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Inline-editable amount */}
                    <td className="px-6 py-4">
                      {editingId === a.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            className="w-32 px-2 py-1 border border-blue-400 rounded text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => handleUpdate(a.id)} disabled={submitting}
                            className="text-green-600 hover:text-green-700 disabled:opacity-50">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => { setEditingId(null); setEditAmount(''); }}
                            className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-gray-900">
                          {a.amount.toLocaleString()}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-gray-500 max-w-[180px] truncate">
                      {a.notes || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(a.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingId(a.id); setEditAmount(a.amount.toString()); }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit amount"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRevoke(a)}
                          disabled={revokingId === a.id}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Remove"
                        >
                          {revokingId === a.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

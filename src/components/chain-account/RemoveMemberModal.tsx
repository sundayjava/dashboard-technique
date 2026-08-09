'use client';

import { useState } from 'react';
import { X, Loader2, UserX, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    name: string | null;
    email: string;
  };
}

interface RemoveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainAccountId: string;
  currentMemberId: string;
  members: Member[];
  accessToken: string;
}

export default function RemoveMemberModal({
  isOpen,
  onClose,
  chainAccountId,
  currentMemberId,
  members,
  accessToken,
}: RemoveMemberModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter out current user
  const removableMembers = members.filter(m => m.id !== currentMemberId);

  const handleSubmit = async () => {
    if (!selectedMemberId || !reason) {
      toast.error('Please select a member and provide a reason');
      return;
    }

    setSubmitting(true);

    try {
      const response = await axios.post(
        '/api/chain-account/remove-member',
        {
          chainAccountId,
          targetMemberId: selectedMemberId,
          reason,
        },
        {
          headers: {
            'X-Chain-Access-Token': accessToken,
          }
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        onClose();
        setSelectedMemberId('');
        setReason('');
      }
    } catch (error: any) {
      console.error('Remove member error:', error);
      toast.error(error.response?.data?.error || 'Failed to submit removal request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <UserX className="w-6 h-6 text-orange-600 mr-3" />
            <h2 className="text-xl font-bold text-gray-900">Remove Member</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Warning */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-orange-600 mr-3 shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-semibold mb-1">Removal Process:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>The selected member must approve their removal</li>
                  <li>All remaining members must vote to approve</li>
                  <li>Admin must give final approval</li>
                  <li>If any step is rejected, the removal is cancelled</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Select Member */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Member to Remove *
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Choose a member</option>
              {removableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.user.name || member.user.email} ({member.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Removal *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Explain why this member should be removed from the Chain Account..."
            />
            <p className="text-xs text-gray-500 mt-1">
              This reason will be shared with all members
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedMemberId || !reason}
              className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Removal Request'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

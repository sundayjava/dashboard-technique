'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface InvestmentPlan {
  id: string;
  planName: string;
  minAmount: number;
  maxAmount: number;
  arkIIAllocation: number;
  duration: number;
  profitPercentage: number;
  compoundingCycles: number;
  canBeStoppedByUser: boolean;
  cryptoAddress: string | null;
  cryptoSymbol: string | null;
  cryptoIcon: string | null;
  chainAccountsEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: {
    investments: number;
    restrictions: number;
  };
}

interface Restriction {
  id: string;
  userId: string;
  planId: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    authorizationCode: string;
  };
}

interface SimpleUser {
  id: string;
  name: string | null;
  email: string;
  authorizationCode: string;
}

interface PlanFormData {
  planName: string;
  minAmount: string;
  maxAmount: string;
  arkIIAllocation: string;
  duration: string;
  profitPercentage: string;
  compoundingCycles: string;
  canBeStoppedByUser: boolean;
  chainAccountsEnabled: boolean;
  cryptoAddress: string;
  cryptoSymbol: string;
  cryptoIcon: string;
}

export default function AdminInvestmentPlansPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InvestmentPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRestrictionsModal, setShowRestrictionsModal] = useState(false);
  const [selectedPlanForRestriction, setSelectedPlanForRestriction] = useState<InvestmentPlan | null>(null);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isLoadingRestrictions, setIsLoadingRestrictions] = useState(false);
  const [isAddingRestrictions, setIsAddingRestrictions] = useState(false);
  const [removingRestrictionId, setRemovingRestrictionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlanFormData>({
    planName: '',
    minAmount: '',
    maxAmount: '',
    arkIIAllocation: '',
    duration: '',
    profitPercentage: '',
    compoundingCycles: '0',
    canBeStoppedByUser: true,
    chainAccountsEnabled: false,
    cryptoAddress: '',
    cryptoSymbol: '',
    cryptoIcon: ''
  });
  const [iconPreview, setIconPreview] = useState<string>('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'ADMIN') {
      toast.error('Unauthorized access');
      router.push('/dashboard');
      return;
    }

    setUser(parsedUser);
    fetchPlans();
  }, [router]);

  const fetchPlans = async () => {
    try {
      const response = await axios.get('/api/admin/investment-plans');
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load investment plans');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      setAllUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    }
  };

  const fetchRestrictions = async (planId: string) => {
    setIsLoadingRestrictions(true);
    try {
      const response = await axios.get(`/api/admin/investment-plan-restrictions?planId=${planId}`);
      setRestrictions(response.data.restrictions || []);
    } catch (error) {
      console.error('Error fetching restrictions:', error);
      toast.error('Failed to load restrictions');
    } finally {
      setIsLoadingRestrictions(false);
    }
  };

  const handleOpenRestrictionsModal = async (plan: InvestmentPlan) => {
    setSelectedPlanForRestriction(plan);
    setShowRestrictionsModal(true);
    await Promise.all([fetchRestrictions(plan.id), fetchUsers()]);
  };

  const handleCloseRestrictionsModal = () => {
    setShowRestrictionsModal(false);
    setSelectedPlanForRestriction(null);
    setRestrictions([]);
    setSelectedUserIds([]);
    setUserSearchQuery('');
  };

  const handleAddRestrictions = async () => {
    if (!selectedPlanForRestriction || selectedUserIds.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    setIsAddingRestrictions(true);
    try {
      await axios.post('/api/admin/investment-plan-restrictions', {
        planId: selectedPlanForRestriction.id,
        userIds: selectedUserIds,
        createdBy: user.id,
      });
      toast.success(`Restricted ${selectedUserIds.length} user(s) successfully`);
      setSelectedUserIds([]);
      await fetchRestrictions(selectedPlanForRestriction.id);
      await fetchPlans();
    } catch (error: any) {
      console.error('Error adding restrictions:', error);
      toast.error(error.response?.data?.error || 'Failed to add restrictions');
    } finally {
      setIsAddingRestrictions(false);
    }
  };

  const handleRemoveRestriction = async (restrictionId: string) => {
    if (!selectedPlanForRestriction) return;

    setRemovingRestrictionId(restrictionId);
    try {
      await axios.delete(`/api/admin/investment-plan-restrictions?id=${restrictionId}`);
      toast.success('Restriction removed successfully');
      await fetchRestrictions(selectedPlanForRestriction.id);
      await fetchPlans();
    } catch (error: any) {
      console.error('Error removing restriction:', error);
      toast.error(error.response?.data?.error || 'Failed to remove restriction');
    } finally {
      setRemovingRestrictionId(null);
    }
  };

  const handleOpenModal = (plan?: InvestmentPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        planName: plan.planName,
        minAmount: plan.minAmount.toString(),
        maxAmount: plan.maxAmount.toString(),
        arkIIAllocation: plan.arkIIAllocation.toString(),
        duration: plan.duration.toString(),
        profitPercentage: plan.profitPercentage.toString(),
        compoundingCycles: plan.compoundingCycles.toString(),
        canBeStoppedByUser: plan.canBeStoppedByUser,
        chainAccountsEnabled: plan.chainAccountsEnabled,
        cryptoAddress: plan.cryptoAddress || '',
        cryptoSymbol: plan.cryptoSymbol || '',
        cryptoIcon: plan.cryptoIcon || ''
      });
      setIconPreview(plan.cryptoIcon || '');
    } else {
      setEditingPlan(null);
      setFormData({
        planName: '',
        minAmount: '',
        maxAmount: '',
        arkIIAllocation: '',
        duration: '',
        profitPercentage: '',
        compoundingCycles: '0',
        canBeStoppedByUser: true,
        chainAccountsEnabled: false,
        cryptoAddress: '',
        cryptoSymbol: '',
        cryptoIcon: ''
      });
      setIconPreview('');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPlan(null);
    setFormData({
      planName: '',
      minAmount: '',
      maxAmount: '',
      arkIIAllocation: '',
      duration: '',
      profitPercentage: '',
      compoundingCycles: '0',
      canBeStoppedByUser: true,
      chainAccountsEnabled: false,
      cryptoAddress: '',
      cryptoSymbol: '',
      cryptoIcon: ''
    });
    setIconPreview('');
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData({ ...formData, cryptoIcon: base64String });
      setIconPreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const minAmount = parseFloat(formData.minAmount);
    const maxAmount = parseFloat(formData.maxAmount);
    const arkIIAllocation = parseFloat(formData.arkIIAllocation);
    const duration = parseInt(formData.duration);
    const profitPercentage = parseFloat(formData.profitPercentage);

    if (minAmount >= maxAmount) {
      toast.error('Minimum amount must be less than maximum amount');
      return;
    }

    if (arkIIAllocation < 0) {
      toast.error('ARK_II allocation cannot be negative');
      return;
    }

    if (duration <= 0) {
      toast.error('Duration must be greater than 0');
      return;
    }

    if (profitPercentage < 0) {
      toast.error('Profit percentage cannot be negative');
      return;
    }

    const compoundingCycles = parseInt(formData.compoundingCycles) || 0;
    
    if (compoundingCycles < 0) {
      toast.error('Compounding cycles cannot be negative');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        planName: formData.planName,
        minAmount,
        maxAmount,
        arkIIAllocation,
        duration,
        profitPercentage,
        compoundingCycles,
        canBeStoppedByUser: formData.canBeStoppedByUser,
        chainAccountsEnabled: formData.chainAccountsEnabled,
        cryptoAddress: formData.cryptoAddress || null,
        cryptoSymbol: formData.cryptoSymbol || null,
        cryptoIcon: formData.cryptoIcon || null,
        createdBy: user.id
      };

      if (editingPlan) {
        await axios.put('/api/admin/investment-plans', {
          id: editingPlan.id,
          ...payload
        });
        toast.success('Investment plan updated successfully');
      } else {
        await axios.post('/api/admin/investment-plans', payload);
        toast.success('Investment plan created successfully');
      }

      handleCloseModal();
      fetchPlans();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.response?.data?.error || 'Failed to save plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (plan: InvestmentPlan) => {
    try {
      await axios.put('/api/admin/investment-plans', {
        id: plan.id,
        isActive: !plan.isActive
      });
      toast.success(`Plan ${!plan.isActive ? 'activated' : 'deactivated'} successfully`);
      fetchPlans();
    } catch (error: any) {
      console.error('Error toggling plan status:', error);
      toast.error(error.response?.data?.error || 'Failed to update plan status');
    }
  };

  const handleDelete = async (plan: InvestmentPlan) => {
    if (!confirm(`Are you sure you want to delete "${plan.planName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/investment-plans?id=${plan.id}`);
      toast.success('Investment plan deleted successfully');
      fetchPlans();
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast.error(error.response?.data?.error || 'Failed to delete plan');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Investment Plans</h1>
            <p className="text-gray-600 mt-1">Manage all investment plans</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 md:mt-0 px-6 py-3 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Plan
          </button>
        </div>

        {/* Plans Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Plan Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Crypto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount Range</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Profit %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ARK_II</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Investors</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Restrictions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Chain Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                      No investment plans found. Create your first plan to get started.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm text-gray-900">{plan.planName}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(plan.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {plan.cryptoSymbol || plan.cryptoIcon ? (
                          <div className="flex items-center gap-1.5">
                            {plan.cryptoIcon && (
                              <img 
                                src={plan.cryptoIcon} 
                                alt={plan.cryptoSymbol || 'Crypto'} 
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            )}
                            {plan.cryptoSymbol && (
                              <span className="text-xs font-semibold text-gray-700">
                                {plan.cryptoSymbol}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        ${plan.minAmount.toLocaleString()} - ${plan.maxAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {plan.compoundingCycles > 1 
                          ? `${plan.duration}^${plan.compoundingCycles} (${plan.duration * plan.compoundingCycles}d)`
                          : `${plan.duration}d`
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-green-600">{plan.profitPercentage}%</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{plan.arkIIAllocation.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 text-center">
                        {plan._count?.investments || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenRestrictionsModal(plan)}
                          className={`relative inline-flex items-center justify-center p-1.5 rounded-lg transition-colors ${
                            plan._count?.restrictions && plan._count.restrictions > 0
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={`Manage restrictions (${plan._count?.restrictions || 0} restricted)`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {plan._count?.restrictions && plan._count.restrictions > 0 && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-orange-600 rounded-full">
                              {plan._count.restrictions}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {plan.chainAccountsEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-800">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(plan)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                            plan.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenModal(plan)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(plan)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPlan ? 'Edit Investment Plan' : 'Create New Investment Plan'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Plan Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={formData.planName}
                    onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="e.g., Premium Growth Plan"
                    required
                  />
                </div>

                {/* Min Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Amount ($) *
                  </label>
                  <input
                    type="number"
                    value={formData.minAmount}
                    onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="1000"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                {/* Max Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Amount ($) *
                  </label>
                  <input
                    type="number"
                    value={formData.maxAmount}
                    onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="10000"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                {/* ARK_II Allocation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ARK_II Allocation *
                  </label>
                  <input
                    type="number"
                    value={formData.arkIIAllocation}
                    onChange={(e) => setFormData({ ...formData, arkIIAllocation: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="1000000"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (Days) *
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="365"
                    min="1"
                    required
                  />
                </div>

                {/* Profit Percentage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profit Percentage (%) *
                  </label>
                  <input
                    type="number"
                    value={formData.profitPercentage}
                    onChange={(e) => setFormData({ ...formData, profitPercentage: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="15.5"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                {/* Compounding Cycles */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Compounding Cycles
                  </label>
                  <input
                    type="number"
                    value={formData.compoundingCycles}
                    onChange={(e) => setFormData({ ...formData, compoundingCycles: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {formData.compoundingCycles && parseInt(formData.compoundingCycles) > 0
                      ? `Plan will run ${parseInt(formData.compoundingCycles)} times (Total: ${parseInt(formData.duration) * parseInt(formData.compoundingCycles)} days)`
                      : 'Leave as 0 for no compounding (single run)'}
                  </p>
                </div>

                {/* Can Be Stopped By User */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="canBeStoppedByUser"
                      checked={formData.canBeStoppedByUser}
                      onChange={(e) => setFormData({ ...formData, canBeStoppedByUser: e.target.checked })}
                      className="w-5 h-5 text-[#c1ff72] focus:ring-[#c1ff72] border-gray-300 rounded"
                    />
                    <label htmlFor="canBeStoppedByUser" className="text-sm font-medium text-gray-700">
                      Allow users to stop compounding early
                    </label>
                  </div>
                  <p className="mt-1 ml-8 text-sm text-gray-500">
                    If enabled, users can manually stop the compounding cycle before completion
                  </p>
                </div>

                {/* Chain Account Enabled */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="chainAccountsEnabled"
                      checked={formData.chainAccountsEnabled}
                      onChange={(e) => setFormData({ ...formData, chainAccountsEnabled: e.target.checked })}
                      className="w-5 h-5 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="chainAccountsEnabled" className="text-sm font-medium text-gray-700">
                      Enable for Chain Accounts
                    </label>
                  </div>
                  <p className="mt-1 ml-8 text-sm text-gray-500">
                    If enabled, this plan will be available for Chain Account investments
                  </p>
                </div>

                {/* Crypto Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Crypto Payment Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.cryptoAddress}
                    onChange={(e) => setFormData({ ...formData, cryptoAddress: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="0x..."
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Leave blank to disable crypto payments for this plan
                  </p>
                </div>

                {/* Crypto Symbol */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Crypto Symbol (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.cryptoSymbol}
                    onChange={(e) => setFormData({ ...formData, cryptoSymbol: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                    placeholder="e.g., BTC, ETH, USDT"
                    maxLength={10}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Crypto currency symbol for this plan
                  </p>
                </div>

                {/* Crypto Icon Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Crypto Icon (Optional)
                  </label>
                  <div className="flex items-center gap-4">
                    {iconPreview && (
                      <div className="w-16 h-16 rounded-lg border-2 border-gray-200 overflow-hidden shrink-0">
                        <img 
                          src={iconPreview} 
                          alt="Crypto icon preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleIconUpload}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#c1ff72] file:text-black hover:file:opacity-90"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Upload icon (max 2MB, PNG/JPG)
                      </p>
                    </div>
                  </div>
                  {iconPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, cryptoIcon: '' });
                        setIconPreview('');
                      }}
                      className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove Icon
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restrictions Management Modal */}
      {showRestrictionsModal && selectedPlanForRestriction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Manage Access Restrictions</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedPlanForRestriction.planName}</p>
              </div>
              <button
                onClick={handleCloseRestrictionsModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Add New Restrictions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Add User Restrictions</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Select users who should NOT be able to see or invest in this plan
                </p>
                
                {/* User Search */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search users by name, email, or authorization code..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                  />
                </div>

                {/* User Selection List with Table */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="w-10 px-3 py-2"></th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Auth Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                  {allUsers
                    .filter(user => {
                      const searchLower = userSearchQuery.toLowerCase();
                      return (
                        user.name?.toLowerCase().includes(searchLower) ||
                        user.email.toLowerCase().includes(searchLower) ||
                        user.authorizationCode.toLowerCase().includes(searchLower)
                      );
                    })
                    .filter(user => !restrictions.some(r => r.userId === user.id))
                    .map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => {
                        if (selectedUserIds.includes(user.id)) {
                          setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                        } else {
                          setSelectedUserIds([...selectedUserIds, user.id]);
                        }
                      }}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds([...selectedUserIds, user.id]);
                              } else {
                                setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-[#c1ff72] focus:ring-[#c1ff72] border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{user.name || 'N/A'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{user.email}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 font-mono">{user.authorizationCode}</td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                  {allUsers.filter(user => {
                    const searchLower = userSearchQuery.toLowerCase();
                    return (
                      user.name?.toLowerCase().includes(searchLower) ||
                      user.email.toLowerCase().includes(searchLower) ||
                      user.authorizationCode.toLowerCase().includes(searchLower)
                    );
                  }).filter(user => !restrictions.some(r => r.userId === user.id)).length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      {userSearchQuery ? 'No users found matching your search' : 'All users are already restricted'}
                    </div>
                  )}
                </div>

                {selectedUserIds.length > 0 && (
                  <button
                    onClick={handleAddRestrictions}
                    disabled={isAddingRestrictions}
                    className="mt-3 w-full px-4 py-2 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAddingRestrictions ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Restricting...
                      </>
                    ) : (
                      `Restrict ${selectedUserIds.length} User${selectedUserIds.length > 1 ? 's' : ''}`
                    )}
                  </button>
                )}
              </div>

              {/* Current Restrictions */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Currently Restricted Users ({restrictions.length})</h3>
                {isLoadingRestrictions ? (
                  <div className="text-center py-6 text-sm text-gray-500">Loading...</div>
                ) : restrictions.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg">
                    No users are currently restricted from this plan
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Auth Code</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Restricted On</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {restrictions.map((restriction) => (
                          <tr key={restriction.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">
                              {restriction.user.name || 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-600">{restriction.user.email}</td>
                            <td className="px-4 py-2 text-xs text-gray-500 font-mono">{restriction.user.authorizationCode}</td>
                            <td className="px-4 py-2 text-xs text-gray-500">
                              {new Date(restriction.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => handleRemoveRestriction(restriction.id)}
                                disabled={removingRestrictionId === restriction.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove restriction"
                              >
                                {removingRestrictionId === restriction.id ? (
                                  <>
                                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Removing...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Remove
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3">
              <button
                onClick={handleCloseRestrictionsModal}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

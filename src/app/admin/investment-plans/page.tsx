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
  cryptoAddress: string | null;
  cryptoSymbol: string | null;
  cryptoIcon: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    investments: number;
  };
}

interface PlanFormData {
  planName: string;
  minAmount: string;
  maxAmount: string;
  arkIIAllocation: string;
  duration: string;
  profitPercentage: string;
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
  const [formData, setFormData] = useState<PlanFormData>({
    planName: '',
    minAmount: '',
    maxAmount: '',
    arkIIAllocation: '',
    duration: '',
    profitPercentage: '',
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

    setIsSubmitting(true);

    try {
      const payload = {
        planName: formData.planName,
        minAmount,
        maxAmount,
        arkIIAllocation,
        duration,
        profitPercentage,
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Plan Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Crypto</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount Range</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Profit %</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ARK_II</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Investors</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      No investment plans found. Create your first plan to get started.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{plan.planName}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(plan.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {plan.cryptoSymbol || plan.cryptoIcon ? (
                          <div className="flex items-center gap-2">
                            {plan.cryptoIcon && (
                              <img 
                                src={plan.cryptoIcon} 
                                alt={plan.cryptoSymbol || 'Crypto'} 
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            {plan.cryptoSymbol && (
                              <span className="text-sm font-semibold text-gray-700">
                                {plan.cryptoSymbol}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        ${plan.minAmount.toLocaleString()} - ${plan.maxAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{plan.duration} days</td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-green-600">{plan.profitPercentage}%</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{plan.arkIIAllocation.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {plan._count?.investments || 0}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(plan)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            plan.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(plan)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(plan)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <div className="w-16 h-16 rounded-lg border-2 border-gray-200 overflow-hidden flex-shrink-0">
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
    </div>
  );
}

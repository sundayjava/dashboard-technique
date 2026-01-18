'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GroupedSettings {
  [category: string]: SystemSetting[];
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GroupedSettings>({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/settings');
      setSettings(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting: SystemSetting) => {
    setEditingKey(setting.key);
    setEditValue(setting.value);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleSave = async (key: string, type: string) => {
    try {
      // Validate based on type
      let validatedValue = editValue;
      if (type === 'number') {
        const num = parseFloat(editValue);
        if (isNaN(num)) {
          toast.error('Please enter a valid number');
          return;
        }
        validatedValue = num.toString();
      } else if (type === 'boolean') {
        if (!['true', 'false'].includes(editValue.toLowerCase())) {
          toast.error('Please enter true or false');
          return;
        }
        validatedValue = editValue.toLowerCase();
      }

      await axios.put('/api/settings', { key, value: validatedValue });
      toast.success('Setting updated successfully');
      setEditingKey(null);
      setEditValue('');
      fetchSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update setting');
    }
  };

  const filteredSettings = () => {
    let filtered: GroupedSettings = {};

    Object.entries(settings).forEach(([category, items]) => {
      if (selectedCategory !== 'all' && category !== selectedCategory) return;

      const filteredItems = items.filter((setting) =>
        setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        setting.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (filteredItems.length > 0) {
        filtered[category] = filteredItems;
      }
    });

    return filtered;
  };

  const categories = ['all', ...Object.keys(settings)];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage application-wide settings and configurations
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Settings
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by key or description..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Settings by Category */}
        {Object.entries(filteredSettings()).length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No settings found matching your criteria</p>
          </div>
        ) : (
          Object.entries(filteredSettings()).map(([category, items]) => (
            <div key={category} className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 capitalize">
                {category} Settings
              </h2>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Setting
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((setting) => (
                      <tr key={setting.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{setting.key}</p>
                            {setting.description && (
                              <p className="text-sm text-gray-500 mt-1">{setting.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {editingKey === setting.key ? (
                            <input
                              type={setting.type === 'number' ? 'number' : 'text'}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              autoFocus
                            />
                          ) : (
                            <span className="text-sm text-gray-900">
                              {setting.type === 'boolean' ? (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    setting.value === 'true'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {setting.value}
                                </span>
                              ) : (
                                setting.value
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {setting.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {editingKey === setting.key ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSave(setting.key, setting.type)}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancel}
                                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEdit(setting)}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex">
            <div className="shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">About Settings</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Changes take effect immediately for new transactions</li>
                  <li>Number values must be numeric (decimals allowed)</li>
                  <li>Boolean values must be true or false</li>
                  <li>Be careful when modifying limits and fees</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

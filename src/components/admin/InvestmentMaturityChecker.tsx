'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

export default function InvestmentMaturityChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleCheckInvestments = async () => {
    setIsChecking(true);
    setLastResult(null);

    try {
      const response = await axios.get('/api/cron/check-investments');
      
      if (response.data.success) {
        toast.success(
          `Found ${response.data.maturedInvestments} matured investment(s). ` +
          `Sent ${response.data.emailsSent} notifications to ${response.data.adminsNotified} admin(s).`
        );
        setLastResult(response.data);
      } else {
        toast.error(response.data.error || 'Failed to check investments');
        setLastResult(response.data);
      }
    } catch (error: any) {
      console.error('Error checking investments:', error);
      toast.error(
        error.response?.data?.error || 
        'Failed to check for matured investments'
      );
      setLastResult({ error: error.message });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Investment Maturity Check</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manually check for matured investments and send notifications
          </p>
        </div>
        <button
          onClick={handleCheckInvestments}
          disabled={isChecking}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            isChecking
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black hover:opacity-90'
          }`}
        >
          {isChecking ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Checking...
            </span>
          ) : (
            'Check Now'
          )}
        </button>
      </div>

      {lastResult && (
        <div className="mt-6">
          {lastResult.success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-green-600 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 mb-2">
                    {lastResult.message}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-green-700 font-medium">Matured Investments</p>
                      <p className="text-green-900 text-lg font-bold">
                        {lastResult.maturedInvestments}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700 font-medium">Admins Notified</p>
                      <p className="text-green-900 text-lg font-bold">
                        {lastResult.adminsNotified}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700 font-medium">Emails Sent</p>
                      <p className="text-green-900 text-lg font-bold">
                        {lastResult.emailsSent}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700 font-medium">Emails Failed</p>
                      <p className="text-green-900 text-lg font-bold">
                        {lastResult.emailsFailed}
                      </p>
                    </div>
                  </div>

                  {lastResult.investments && lastResult.investments.length > 0 && (
                    <div className="mt-4">
                      <p className="text-green-700 font-medium mb-2">Matured Investments:</p>
                      <div className="space-y-2">
                        {lastResult.investments.map((inv: any) => (
                          <div
                            key={inv.id}
                            className="bg-white border border-green-200 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {inv.investor} - {inv.plan}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Amount: ${inv.amount.toLocaleString()} | 
                                  Cycle: {inv.currentCycle}/{inv.totalCycles}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500">
                                {new Date(inv.endDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-red-600 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                  <p className="text-red-700 text-sm">
                    {lastResult.error || 'An error occurred'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <svg
            className="w-5 h-5 text-blue-600 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-medium text-gray-900 mb-1">Automated Checks</p>
            <p>
              This check runs automatically every 6 hours via cron job. You can also trigger it
              manually here for testing purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

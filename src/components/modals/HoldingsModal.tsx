'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  X,
  Coins,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Info,
  DollarSign,
  Wallet,
  Clock,
  Award,
} from 'lucide-react';

interface HoldingToken {
  id: string;
  name: string;
  symbol: string;
  logo: string | null;
  currentPrice: number;
  priceChange24h: number;
  interestRate: number;
}

interface UserHolding {
  id: string;
  depositedAmount: number;
  tokenAmount: number;
  currentValue: number;
  interestEarned: number;
  status: string;
  createdAt: string;
  token: HoldingToken;
}

interface HoldingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  accountBalance: number;
  accountCurrency: string;
  onSuccess: () => void;
}

export default function HoldingsModal({
  isOpen,
  onClose,
  userId,
  accountBalance,
  accountCurrency,
  onSuccess,
}: HoldingsModalProps) {
  const [step, setStep] = useState<'intro' | 'select' | 'deposit' | 'my-holdings'>('intro');
  const [tokens, setTokens] = useState<HoldingToken[]>([]);
  const [holdings, setHoldings] = useState<UserHolding[]>([]);
  const [selectedToken, setSelectedToken] = useState<HoldingToken | null>(null);
  const [amount, setAmount] = useState('');
  const [usdAmount, setUsdAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTokens();
      fetchMyHoldings();
    }
  }, [isOpen]);

  useEffect(() => {
    const convertToUSD = async () => {
      if (!amount || parseFloat(amount) <= 0 || accountCurrency === 'USD') {
        setUsdAmount(parseFloat(amount) || 0);
        return;
      }

      try {
        const response = await axios.get(`/api/crypto/convert?amount=${amount}&from=${accountCurrency}&to=USD`);
        setUsdAmount(response.data.convertedAmount);
      } catch (error) {
        console.error('Error converting to USD:', error);
        setUsdAmount(0);
      }
    };

    convertToUSD();
  }, [amount, accountCurrency]);

  const fetchTokens = async () => {
    try {
      const response = await axios.get('/api/holdings/tokens');
      setTokens(response.data.tokens);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  };

  const fetchMyHoldings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/holdings/my-holdings?userId=${userId}`);
      setHoldings(response.data.holdings);
    } catch (error) {
      console.error('Error fetching holdings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHolding = async () => {
    if (!selectedToken || !amount) {
      alert('Please enter an amount');
      return;
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    if (depositAmount > accountBalance) {
      alert('Insufficient balance');
      return;
    }

    try {
      setCreating(true);
      await axios.post('/api/holdings/my-holdings', {
        userId,
        tokenId: selectedToken.id,
        amount: depositAmount,
      });

      alert(`Successfully created holding request for ${depositAmount} ${accountCurrency} in ${selectedToken.name}!\n\nYour holding is pending admin approval. You'll be notified once it's reviewed.`);
      setAmount('');
      setSelectedToken(null);
      setStep('my-holdings');
      fetchMyHoldings();
      onSuccess(); // Refresh parent component
    } catch (error: any) {
      console.error('Error creating holding:', error);
      alert(error.response?.data?.error || 'Failed to create holding');
    } finally {
      setCreating(false);
    }
  };

  const handleWithdraw = async (holdingId: string) => {
    if (!confirm('Are you sure you want to withdraw this holding?')) return;

    try {
      const response = await axios.patch('/api/holdings/my-holdings', {
        userId,
        holdingId,
      });

      alert(`Successfully withdrawn ${response.data.amount.toFixed(2)} ${accountCurrency} to your account!`);
      fetchMyHoldings();
      onSuccess(); // Refresh parent component
    } catch (error: any) {
      console.error('Error withdrawing holding:', error);
      alert(error.response?.data?.error || 'Failed to withdraw holding');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="w-6 h-6 text-blue-600" />
            Crypto Holdings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Intro Step */}
          {step === 'intro' && (
            <div className="space-y-6">
              <div className="bg-linear-to-r from-blue-50 to-purple-50 rounded-lg md:p-6 p-2">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  How Crypto Holdings Work
                </h3>
                <div className="space-y-3 text-sm text-gray-700">

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                      <Award className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Earn Interest</p>
                      <p className="text-gray-600">
                        Earn daily interest on your holdings based on the annual percentage yield (APY)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Withdraw Anytime</p>
                      <p className="text-gray-600">
                        Withdraw your holdings + interest back to your account balance at any time
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Cryptocurrency prices are volatile and can go up or down. Your holding value will change based on market conditions.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('my-holdings')}
                  className="flex-1 md:px-4 px-2 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  My Holdings
                </button>
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 md:px-4 px-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Select Token Step */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Select Cryptocurrency</h3>
                <button
                  onClick={() => setStep('intro')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Back
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tokens.map((token) => (
                  <button
                    key={token.id}
                    onClick={() => {
                      setSelectedToken(token);
                      setStep('deposit');
                    }}
                    className="md:p-4 p-2 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {token.logo ? (
                        <img src={token.logo} alt={token.name} className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-lg font-bold text-blue-600">{token.symbol[0]}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{token.name}</p>
                        <p className="text-sm text-gray-500">{token.symbol}</p>
                      </div>
                      <div className={`flex items-center gap-1 ${token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {token.priceChange24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className="text-sm font-medium">{Math.abs(token.priceChange24h).toFixed(2)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Current Price:</span>
                      <span className="font-bold text-gray-900">${token.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-600">Interest Rate:</span>
                      <span className="font-bold text-green-600">{token.interestRate}% APY</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deposit Step */}
          {step === 'deposit' && selectedToken && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Deposit Funds</h3>
                <button
                  onClick={() => {
                    setStep('select');
                    setSelectedToken(null);
                    setAmount('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Back
                </button>
              </div>

              {/* Selected Token Info */}
              <div className="bg-gray-50 rounded-lg md:p-4 p-2 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  {selectedToken.logo ? (
                    <img src={selectedToken.logo} alt={selectedToken.name} className="w-12 h-12 rounded-full" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xl font-bold text-blue-600">{selectedToken.symbol[0]}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{selectedToken.name}</p>
                    <p className="text-sm text-gray-500">{selectedToken.symbol}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Current Price</p>
                    <p className="font-bold text-gray-900">${selectedToken.currentPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Interest Rate</p>
                    <p className="font-bold text-green-600">{selectedToken.interestRate}% APY</p>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Amount ({accountCurrency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => setAmount(accountBalance.toString())}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Max
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Available Balance: {accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {accountCurrency}
                </p>
              </div>

              {/* Preview */}
              {amount && parseFloat(amount) > 0 && selectedToken && (
                <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl md:p-5 p-2.5 border-2 border-blue-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-semibold text-gray-800">Investment Preview</p>
                  </div>
                  <div className="md:space-y-3 space-y-1.5">
                    <div className="bg-white/70 backdrop-blur-sm rounded-lg md:p-3 p-1.5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600">You'll receive</span>
                        <span className="text-xs text-gray-500">{selectedToken.symbol}</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {(usdAmount / selectedToken.currentPrice).toFixed(8)}
                      </p>
                      {accountCurrency !== 'USD' && (
                        <p className="text-xs text-gray-500 mt-1">
                          ≈ ${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </p>
                      )}
                    </div>
                    
                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600">Current price</span>
                        <div className="flex items-center gap-1">
                          {selectedToken.priceChange24h >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-600" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-600" />
                          )}
                          <span className={`text-xs font-medium ${
                            selectedToken.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {selectedToken.priceChange24h >= 0 ? '+' : ''}{selectedToken.priceChange24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        ${selectedToken.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="bg-linear-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1">
                          <Award className="w-3 h-3 text-green-600" />
                          <span className="text-xs font-medium text-green-800">Daily interest ({selectedToken.interestRate}% APY)</span>
                        </div>
                        <span className="text-xs text-green-700">Compounds with value</span>
                      </div>
                      <p className="text-xl font-bold text-green-700">
                        ${((usdAmount * selectedToken.interestRate) / 365 / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        ≈ ${((usdAmount * selectedToken.interestRate) / 12 / 100).toFixed(2)}/month
                      </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                      <p className="text-xs text-yellow-800 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>Interest grows/falls with token price in real-time. Higher price = higher daily interest!</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleCreateHolding}
                disabled={creating || !amount || parseFloat(amount) <= 0}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 font-medium"
              >
                {creating ? 'Creating Holding...' : 'Swap'}
              </button>
            </div>
          )}

          {/* My Holdings Step */}
          {step === 'my-holdings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">My Holdings</h3>
                <button
                  onClick={() => setStep('intro')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Back
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-600 mt-2">Loading...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending Holdings */}
                  {holdings.filter(h => h.status === 'PENDING').length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <h4 className="text-sm font-bold text-gray-900">Pending Approval</h4>
                        <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded">
                          {holdings.filter(h => h.status === 'PENDING').length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {holdings
                          .filter(h => h.status === 'PENDING')
                          .map((holding) => (
                            <div key={holding.id} className="border-2 border-yellow-300 bg-yellow-50 rounded-lg p-4">
                              <div className="flex items-center gap-3 mb-2">
                                {holding.token.logo ? (
                                  <img src={holding.token.logo} alt={holding.token.name} className="w-10 h-10 rounded-full" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-lg font-bold text-blue-600">{holding.token.symbol[0]}</span>
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900">{holding.token.name}</p>
                                  <p className="text-sm text-gray-600">
                                    {holding.tokenAmount.toFixed(8)} {holding.token.symbol}
                                  </p>
                                </div>
                                <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
                                  PENDING
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-600">Requested Amount</p>
                                  <p className="font-bold text-gray-900">
                                    {holding.depositedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {accountCurrency}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Submitted</p>
                                  <p className="font-medium text-gray-900">
                                    {new Date(holding.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 bg-yellow-100 border border-yellow-300 rounded p-2">
                                <p className="text-xs text-yellow-800">
                                  ⏳ Awaiting admin approval. You'll be notified once reviewed.
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Active Holdings */}
                  {holdings.filter(h => h.status === 'ACTIVE').length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Award className="w-4 h-4 text-green-600" />
                        <h4 className="text-sm font-bold text-gray-900">Active Holdings</h4>
                        <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded">
                          {holdings.filter(h => h.status === 'ACTIVE').length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {holdings
                          .filter(h => h.status === 'ACTIVE')
                          .map((holding) => {
                            // P/L calculation: Only show interest earned since we can't mix currencies
                            // currentValue and depositedAmount are in different currencies
                            // currentValue = USD, depositedAmount = user's local currency
                            const profitLoss = holding.interestEarned; // Interest only (in USD)
                            const profitLossPercent = holding.currentValue > 0 ? (profitLoss / holding.currentValue) * 100 : 0;

                            return (
                              <div key={holding.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            {holding.token.logo ? (
                              <img src={holding.token.logo} alt={holding.token.name} className="w-10 h-10 rounded-full" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-lg font-bold text-blue-600">{holding.token.symbol[0]}</span>
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="font-bold text-gray-900">{holding.token.name}</p>
                              <p className="text-sm text-gray-500">
                                {holding.tokenAmount.toFixed(8)} {holding.token.symbol}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                            <div>
                              <p className="text-gray-600">Deposited</p>
                              <p className="font-bold text-gray-900">
                                {holding.depositedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {accountCurrency}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Current Value</p>
                              <p className="font-bold text-gray-900">
                                ${holding.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Interest Earned</p>
                              <p className="font-bold text-green-600">
                                +${holding.interestEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Profit/Loss</p>
                              <p className={`font-bold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {profitLoss >= 0 ? '+' : ''}${profitLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                <span className="text-xs ml-1">({profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%)</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(holding.createdAt).toLocaleDateString()}
                            </span>
                            <span>APY: {holding.token.interestRate}%</span>
                          </div>

                          <button
                            onClick={() => handleWithdraw(holding.id)}
                            className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                          >
                            Withdraw (${(holding.currentValue + holding.interestEarned).toLocaleString('en-US', { minimumFractionDigits: 2 })})
                          </button>
                        </div>
                      );
                    })}
                      </div>
                    </div>
                  )}

                  {/* No Holdings Message */}
                  {holdings.filter(h => h.status === 'ACTIVE' || h.status === 'PENDING').length === 0 && (
                    <div className="text-center py-8">
                      <Coins className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-600 mb-4">No holdings yet</p>
                      <button
                        onClick={() => setStep('select')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Create Holding
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

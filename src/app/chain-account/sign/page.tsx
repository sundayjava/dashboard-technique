'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SessionManager } from '@/lib/session';
import axios from 'axios';
import { Check, Loader2, CheckCircle, AlertCircle, FileText, Users, Shield, DollarSign, Key, FileCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface MemorandumData {
  chainAccount: {
    id: string;
    accountNumber: string;
    accountName: string;
    status: string;
  };
  member: {
    id: string;
    role: string;
    hasConfirmed: boolean;
    confirmedAt: string | null;
  };
  memorandum: {
    documentReference: string;
    dateIssued: string;
    content: any;
  };
  allMembers: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    hasConfirmed: boolean;
    confirmedAt: string | null;
  }>;
}

export default function SignMemorandumPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signingToken = searchParams.get('ref');

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [data, setData] = useState<MemorandumData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userData = SessionManager.getUser();
    if (userData) {
      setUser(userData);
      loadMemorandum();
    } else {
      const returnUrl = `/chain-account/sign?ref=${signingToken}`;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [signingToken, router]);

  const loadMemorandum = async () => {
    if (!signingToken) {
      setError('Invalid signing link');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`/api/chain-account/memorandum?token=${signingToken}`);

      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load memorandum');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signingToken || !data) return;

    setSigning(true);

    try {
      SessionManager.updateActivity();

      const response = await axios.post('/api/chain-account/sign', {
        signingToken,
      });

      if (response.data.success) {
        toast.success('Memorandum signed successfully!');

        if (response.data.allConfirmed) {
          toast.success('Chain Account activated! All members have signed.');
          SessionManager.updateActivity();
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          setData(prev => prev ? {
            ...prev,
            member: {
              ...prev.member,
              hasConfirmed: true,
              confirmedAt: new Date().toISOString(),
            }
          } : null);
        }
      }
    } catch (err: any) {
      console.error('Chain Account signing error:', err);
      toast.error(err.response?.data?.error || 'Failed to sign memorandum');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading memorandum...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">
            {error || 'This link is invalid or has expired. Please contact Acredis support.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { chainAccount, member, memorandum, allMembers } = data;
  const content = memorandum.content;

  if (member.hasConfirmed) {
    const confirmedCount = allMembers.filter(m => m.hasConfirmed).length;
    const totalMembers = allMembers.length;
    const allConfirmed = confirmedCount === totalMembers;

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Already Signed</h1>
            <p className="text-gray-600 mb-6">
              You have already signed this memorandum on {new Date(member.confirmedAt!).toLocaleDateString()}.
            </p>

            {allConfirmed ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Account Activated</h3>
                <p className="text-green-800">
                  All members have signed the memorandum. Your Chain Account is now active! Check your email for your access token.
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Waiting for Other Members</h3>
                <p className="text-blue-800 mb-4">
                  {confirmedCount} of {totalMembers} members have signed. The account will activate once everyone has confirmed.
                </p>
                <div className="space-y-2">
                  {allMembers.map((m, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {m.name || m.email} ({m.role})
                      </span>
                      {m.hasConfirmed ? (
                        <span className="flex items-center text-green-600">
                          <Check className="w-4 h-4 mr-1" />
                          Signed
                        </span>
                      ) : (
                        <span className="text-gray-400">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header */}
      <header className="bg-linear-to-r from-[#1e3a8a] to-[#1e40af] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <Image src="/logo/WG_Gbg_Fin-No-bg.png" alt="Acredis Finance" width={60} height={60} className="w-10 h-10 sm:w-14 sm:h-14 shrink-0" />
              <div>
                <h1 className="text-lg sm:text-2xl font-bold leading-tight">ACREDIS FINANCE</h1>
                <p className="text-xs sm:text-sm text-blue-200">Digital Blockchain Banking &amp; Investment</p>
              </div>
            </div>
            <div className="sm:text-right">
              <h2 className="text-base sm:text-xl font-bold leading-tight">CHAIN ACCOUNT MEMORANDUM</h2>
              <p className="text-xs sm:text-sm text-blue-200">UAE Jurisdiction</p>
            </div>
          </div>

          <div className="border-t border-blue-400 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
              <div>
                <p className="text-blue-200 text-xs">Document Reference</p>
                <p className="font-semibold text-xs sm:text-sm break-all">{memorandum.documentReference}</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs">Date Issued</p>
                <p className="font-semibold text-xs sm:text-sm">{new Date(memorandum.dateIssued).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs">Document Status</p>
                <p className="font-semibold text-xs sm:text-sm">PENDING — Awaiting All Signatures</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs">Jurisdiction</p>
                <p className="font-semibold text-xs sm:text-sm">United Arab Emirates</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto py-6 sm:py-8 px-3 sm:px-4">
        {/* MEMORANDUM TITLE */}
        <div className="bg-white border-b-4 border-yellow-500 shadow-sm p-4 sm:p-6 mb-6">
          <h1 className="text-2xl sm:text-4xl font-bold text-center text-gray-900">
            MEMORANDUM OF AGREEMENT
          </h1>
          <p className="text-center text-yellow-600 font-semibold mt-2 text-base sm:text-lg">
            Chain Account Establishment
          </p>
        </div>

        {/* PREAMBLE */}
        <div className="bg-white shadow-sm p-4 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-blue-600 pb-2">PREAMBLE</h2>
          <div className="text-gray-700 space-y-3 text-sm leading-relaxed">
            <p>
              This Memorandum of Agreement (&quot;Agreement&quot;) is issued by <strong>Acredis Finance</strong>, a digital blockchain
              banking and investment platform operating under the laws of the United Arab Emirates, to formalize the establishment
              and governance of a <strong>Chain Account</strong> between the undersigned parties (&quot;the Parties&quot;).
            </p>
            <p>
              A Chain Account is a multi-party digital account that allows two or more verified Acredis users to collectively manage
              funds, assets, and investment activity subject to the authorization model and terms outlined herein.
            </p>
            <p>
              By signing this Memorandum, each party acknowledges having read, understood, and agreed to all terms, conditions,
              and governance rules set forth in this document and the platform&apos;s general Terms of Service.
            </p>
          </div>
        </div>

        {/* PART 1: Account Details */}
        <div className="bg-white shadow-sm p-4 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <FileText className="w-6 h-6 mr-2 text-blue-600" />
            PART 1 — ACCOUNT DETAILS
          </h2>
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span className="text-gray-600 font-medium">Account Name:</span>
                <p className="font-semibold text-gray-900 mt-1">{content.accountDetails.accountName}</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Chain Account ID:</span>
                <p className="font-semibold text-gray-900 mt-1">{content.accountDetails.chainAccountId}</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Account Type:</span>
                <p className="font-semibold text-gray-900 mt-1">{content.accountDetails.accountType}</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Date of Application:</span>
                <p className="font-semibold text-gray-900 mt-1">{new Date(content.accountDetails.dateOfApplication).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Primary Applicant:</span>
                <p className="font-semibold text-gray-900 mt-1">{content.accountDetails.primaryApplicant}</p>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <span className="text-gray-600 font-medium">Account Purpose:</span>
              <p className="font-semibold text-gray-900 mt-1">{content.accountDetails.accountPurpose}</p>
              {content.accountDetails.purposeDescription && (
                <p className="text-gray-700 text-sm mt-2 italic">{content.accountDetails.purposeDescription}</p>
              )}
            </div>
            <div>
              <span className="text-gray-600 font-medium">Asset Types:</span>
              <p className="font-semibold text-gray-900 mt-1">{content.accountDetails.assetTypes}</p>
            </div>
          </div>
        </div>

        {/* PART 2: Parties to Agreement */}
        <div className="bg-white shadow-sm p-4 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <Users className="w-6 h-6 mr-2 text-blue-600" />
            PART 2 — PARTIES TO AGREEMENT
          </h2>
          <div className="space-y-4">
            {content.parties.map((party: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded-lg p-6 border-l-4 border-blue-600">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="font-bold text-lg text-gray-900">{party.role}</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold whitespace-nowrap">
                    Verified Acredis User ✓
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Full Name:</span>
                    <p className="font-semibold text-gray-900">{party.fullName || party.email?.split('@')[0]}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Email Address:</span>
                    <p className="font-semibold text-gray-900">{party.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PART 3: Financial Profile */}
        <div className="bg-white shadow-sm p-4 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <DollarSign className="w-6 h-6 mr-2 text-blue-600" />
            PART 3 — FINANCIAL PROFILE
          </h2>
          <div className="bg-gray-50 rounded-lg p-6 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span className="text-gray-600 font-medium">Expected Monthly Activity:</span>
                <p className="font-semibold text-gray-900 mt-1">{content.financialProfile.expectedMonthlyActivity}</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Combined Capital Level:</span>
                <p className="font-semibold text-gray-900 mt-1">{content.financialProfile.combinedCapitalLevel}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600 font-medium">Intended Asset Holdings:</span>
                <p className="font-semibold text-gray-900 mt-1">{content.financialProfile.intendedAssetHoldings}</p>
              </div>
            </div>
          </div>
        </div>

        {/* PART 4: Account Permissions & Governance */}
        <div className="bg-white shadow-sm p-4 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <Shield className="w-6 h-6 mr-2 text-blue-600" />
            PART 4 — ACCOUNT PERMISSIONS & GOVERNANCE
          </h2>

          {/* 4.1 Transaction Authorization Model */}
          <div className="mb-6">
            <p className="font-semibold text-gray-900 mb-3">4.1 Transaction Authorization Model</p>
            <p className="text-sm text-gray-700 mb-3">
              The parties have selected the following authorization structure for this Chain Account:
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
              <label className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold ${
                  content.permissions.authorizationModel === 'INDEPENDENT'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-400 text-transparent'
                }`}>✓</span>
                <span className="text-sm text-gray-800">
                  <strong>Independent Authorization</strong> — Any signatory may conduct transactions independently using their unique signature key
                </span>
              </label>
              <label className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold ${
                  content.permissions.authorizationModel === 'THRESHOLD'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-400 text-transparent'
                }`}>✓</span>
                <span className="text-sm text-gray-800">
                  <strong>Threshold Authorization</strong> — Any transaction above{' '}
                  <strong>
                    {content.permissions.authorizationModel === 'THRESHOLD' && content.permissions.thresholdAmount
                      ? `${content.permissions.thresholdCurrency} ${content.permissions.thresholdAmount}`
                      : '$[AMOUNT]'}
                  </strong>{' '}
                  requires approval from all signatories
                </span>
              </label>
              <label className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold ${
                  content.permissions.authorizationModel === 'MAJORITY'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-400 text-transparent'
                }`}>✓</span>
                <span className="text-sm text-gray-800">
                  <strong>Majority Authorization</strong> — Transactions above the set threshold require majority signatory approval
                  {content.permissions.authorizationModel === 'MAJORITY' && content.permissions.thresholdAmount && (
                    <> (threshold: <strong>{content.permissions.thresholdCurrency} {content.permissions.thresholdAmount}</strong>)</>
                  )}
                </span>
              </label>
            </div>
          </div>

          {/* 4.2 Permitted Account Activities */}
          <div className="mb-6">
            <p className="font-semibold text-gray-900 mb-3 flex items-center">
              <Check className="w-5 h-5 mr-2 text-green-600" />
              4.2 Permitted Account Activities
            </p>
            <p className="text-sm text-gray-700 mb-2">
              Each signatory&apos;s unique signature key grants independent authorization for the following:
            </p>
            <div className="bg-gray-50 rounded-lg p-5">
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-1">
                <li>Deposits into the Chain Account</li>
                <li>Withdrawals within the agreed authorization threshold</li>
                <li>Enrollment into Acredis investment plans</li>
                <li>Viewing of full account transaction history and balances</li>
                <li>Initiating internal transfers between Acredis accounts</li>
              </ul>
            </div>
          </div>

          {/* 4.3 Activities Requiring All-Party Consent */}
          <div>
            <p className="font-semibold text-gray-900 mb-3 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
              4.3 Activities Requiring All-Party Consent
            </p>
            <p className="text-sm text-gray-700 mb-2">
              The following actions require written confirmation from all signatories before execution:
            </p>
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-5">
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-1">
                <li>Modification of account permissions or authorization model</li>
                <li>Addition or removal of a signatory</li>
                <li>Closure of the Chain Account</li>
                <li>Withdrawal of the total account balance</li>
                <li>
                  Enrollment in investment plans above{' '}
                  {content.permissions.thresholdAmount
                    ? `${content.permissions.thresholdCurrency} ${content.permissions.thresholdAmount}`
                    : 'the agreed threshold amount'}
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* PART 5: Signature Key Disclosure */}
        <div className="bg-white shadow-sm p-4 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <Key className="w-6 h-6 mr-2 text-blue-600" />
            PART 5 — SIGNATURE KEY DISCLOSURE & ACCESS TOKEN
          </h2>
          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 text-sm text-gray-700 leading-relaxed">
            <p className="mb-3 font-semibold text-blue-900">
              Upon activation of this Chain Account, each signatory will receive a unique cryptographic signature key (access token).
            </p>
            <p className="mb-3">
              This token will be delivered via secure email and in-app notification to their registered Acredis account. It serves
              as your private key to access and operate the Chain Account.
            </p>
            <p className="mb-3 font-semibold text-gray-900">Each party acknowledges and agrees that:</p>
            <ul className="list-disc list-inside space-y-1 ml-3">
              <li>Their signature key is personal and must not be shared with any third party, including other signatories</li>
              <li>Acredis bears no liability for unauthorized transactions resulting from a compromised signature key</li>
              <li>Loss or compromise of a signature key must be reported to Acredis immediately</li>
              <li>A replacement key request requires identity re-verification and confirmation from at least one other signatory</li>
            </ul>
          </div>
        </div>

        {/* PART 6: Terms & Conditions */}
        <div className="bg-white shadow-sm p-4 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <FileCheck className="w-6 h-6 mr-2 text-blue-600" />
            PART 6 — TERMS & CONDITIONS
          </h2>
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">6.1 Governing Law</p>
              <p>
                This agreement is governed under the applicable VARA or FSRA virtual asset regulations.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">6.2 Liability</p>
              <p>
                All parties share equal responsibility for the activity conducted on this Chain Account unless otherwise
                stipulated in a separate legal agreement between the parties.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">6.3 Dispute Resolution</p>
              <p className="mb-2">
                In the event of a dispute between signatories regarding account activity, Acredis will:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-3">
                <li>Temporarily freeze the account pending resolution</li>
                <li>Require written instruction from all parties before resuming activity</li>
                <li>Not arbitrate disputes between parties — parties are advised to seek independent legal counsel</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">6.4 Account Dormancy</p>
              <p>
                If the Chain Account records no activity for <strong>180 consecutive days</strong>, Acredis reserves the right
                to flag the account for review and notify all signatories.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">6.5 Platform Rights</p>
              <p className="mb-2">
                Acredis reserves the right to suspend or close a Chain Account in the event of:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-3">
                <li>Suspected fraudulent or unlawful activity</li>
                <li>Failure to maintain KYC/AML compliance by any signatory</li>
                <li>Breach of platform terms by any party</li>
              </ul>
            </div>
          </div>
        </div>

        {/* PART 7: Signatory Confirmation */}
        <div className="bg-white shadow-sm p-4 sm:p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <CheckCircle className="w-6 h-6 mr-2 text-blue-600" />
            PART 7 — SIGNATORY CONFIRMATION
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            The Chain Account will activate once all parties have reviewed and electronically signed this Memorandum.
          </p>
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="space-y-3">
              {allMembers.map((m, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3 last:border-0">
                  <div>
                    <p className="font-semibold text-gray-900">{m.name || m.email}</p>
                    <p className="text-sm text-gray-600">{m.role.replace('_', ' ')}</p>
                  </div>
                  {m.hasConfirmed ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="w-5 h-5 mr-2 shrink-0" />
                      <div className="sm:text-right">
                        <p className="font-semibold">Confirmed</p>
                        {m.confirmedAt && (
                          <p className="text-xs text-gray-500">
                            {new Date(m.confirmedAt).toLocaleDateString()} at {new Date(m.confirmedAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-yellow-600 font-semibold flex items-center">
                      <Loader2 className="w-4 h-4 mr-2" />
                      Pending Signature
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Declaration & Sign Button */}
        <div className="bg-white shadow-lg border-2 border-blue-600 rounded-lg p-4 sm:p-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 sm:p-6 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-yellow-900 mb-2 text-lg">DECLARATION</h3>
                <p className="text-yellow-800 text-sm leading-relaxed">
                  By clicking <strong>&quot;I Confirm & Sign this Memorandum&quot;</strong> below, you hereby declare that:
                </p>
                <ul className="list-disc list-inside mt-2 text-sm text-yellow-800 space-y-1 ml-3">
                  <li>You have read and fully understood all terms and conditions outlined in this Memorandum</li>
                  <li>You agree to be bound by the governance structure and authorization model specified herein</li>
                  <li>You acknowledge your joint and several liability for all account activity</li>
                  <li>All information provided in the application is true, accurate, and complete</li>
                  <li>This electronic signature constitutes a legally binding commitment</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSign}
              disabled={signing}
              className="px-8 py-4 bg-linear-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-base sm:text-lg font-bold"
            >
              {signing ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  Signing Memorandum...
                </>
              ) : (
                <>
                  <Check className="w-6 h-6 mr-2" />
                  I Confirm & Sign this Memorandum
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Acredis Finance. All rights reserved.</p>
          <p className="mt-1">Document Reference: {memorandum.documentReference} | United Arab Emirates</p>
        </div>
      </div>
    </div>
  );
}

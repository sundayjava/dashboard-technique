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
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Image src="/logo/WG_Gbg_Fin-No-bg.png" alt="Acredis Finance" width={60} height={60} className="w-14 h-14" />
              <div>
                <h1 className="text-2xl font-bold">ACREDIS FINANCE</h1>
                <p className="text-sm text-blue-200">Digital Blockchain Banking & Investment</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">CHAIN ACCOUNT MEMORANDUM</h2>
              <p className="text-sm text-blue-200">UAE Jurisdiction</p>
            </div>
          </div>

          <div className="border-t border-blue-400 pt-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-blue-200 text-xs">Document Reference</p>
                <p className="font-semibold">{memorandum.documentReference}</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs">Date Issued</p>
                <p className="font-semibold">{new Date(memorandum.dateIssued).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs">Document Status</p>
                <p className="font-semibold">PENDING — Awaiting All Signatures</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs">Jurisdiction</p>
                <p className="font-semibold">United Arab Emirates</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* MEMORANDUM TITLE */}
        <div className="bg-white border-b-4 border-yellow-500 shadow-sm p-6 mb-6">
          <h1 className="text-4xl font-bold text-center text-gray-900">
            MEMORANDUM OF AGREEMENT
          </h1>
          <p className="text-center text-yellow-600 font-semibold mt-2 text-lg">
            Chain Account Establishment
          </p>
        </div>

        {/* PREAMBLE */}
        <div className="bg-white shadow-sm p-8 mb-6 border border-gray-200">
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
        <div className="bg-white shadow-sm p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <FileText className="w-6 h-6 mr-2 text-blue-600" />
            PART 1 — ACCOUNT DETAILS
          </h2>
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
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
              <div>
                <span className="text-gray-600 font-medium">Platform Jurisdiction:</span>
                <p className="font-semibold text-gray-900 mt-1">{content.accountDetails.platformJurisdiction}</p>
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
        <div className="bg-white shadow-sm p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <Users className="w-6 h-6 mr-2 text-blue-600" />
            PART 2 — PARTIES TO AGREEMENT
          </h2>
          <div className="space-y-4">
            {content.parties.map((party: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded-lg p-6 border-l-4 border-blue-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg text-gray-900">{party.role}</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                    Verified Acredis User ✓
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Full Name:</span>
                    <p className="font-semibold text-gray-900">{party.fullName}</p>
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
        <div className="bg-white shadow-sm p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <DollarSign className="w-6 h-6 mr-2 text-blue-600" />
            PART 3 — FINANCIAL PROFILE
          </h2>
          <div className="bg-gray-50 rounded-lg p-6 space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
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
        <div className="bg-white shadow-sm p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <Shield className="w-6 h-6 mr-2 text-blue-600" />
            PART 4 — ACCOUNT PERMISSIONS & GOVERNANCE
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
            <div className="flex items-center mb-2">
              <span className="text-gray-700 font-medium">Authorization Model:</span>
              <span className="ml-3 font-bold text-blue-700 text-lg">
                {content.permissions.authorizationModel === 'INDEPENDENT' && 'INDEPENDENT AUTHORIZATION'}
                {content.permissions.authorizationModel === 'THRESHOLD' && 'THRESHOLD AUTHORIZATION (All Must Approve)'}
                {content.permissions.authorizationModel === 'MAJORITY' && 'MAJORITY AUTHORIZATION'}
              </span>
            </div>

            {content.permissions.thresholdAmount && (
              <div className="mt-3 pt-3 border-t border-blue-300">
                <span className="text-gray-700 font-medium">Transaction Threshold:</span>
                <span className="ml-2 font-bold text-gray-900">
                  {content.permissions.thresholdCurrency} {content.permissions.thresholdAmount}
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  Transactions at or above this amount require group approval
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-3 flex items-center">
                <Check className="w-5 h-5 mr-2 text-green-600" />
                Individual Signatory Rights
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-5">
                <li>Deposit funds into the Chain Account</li>
                <li>View full account transaction history and balances</li>
                {content.permissions.authorizationModel === 'INDEPENDENT' && (
                  <>
                    <li>Make withdrawals of any amount</li>
                    <li>Enroll in investment plans of any amount</li>
                  </>
                )}
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-3 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
                Group Approval Required For
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-5">
                <li>Modification of account permissions or settings</li>
                <li>Addition or removal of a signatory</li>
                <li>Closure of the Chain Account (balance must be $0)</li>
                {(content.permissions.authorizationModel === 'THRESHOLD' || content.permissions.authorizationModel === 'MAJORITY') && (
                  <li>Withdrawals and investments at or above the threshold amount</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* PART 5: Signature Key Disclosure */}
        <div className="bg-white shadow-sm p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <Key className="w-6 h-6 mr-2 text-blue-600" />
            PART 5 — SIGNATURE KEY DISCLOSURE & ACCESS TOKEN
          </h2>
          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 text-sm text-gray-700 leading-relaxed">
            <p className="mb-3 font-semibold text-blue-900">
              Upon activation of this Chain Account, each signatory will receive a unique access token.
            </p>
            <p className="mb-3">
              This token will be delivered via secure email and in-app notification. It serves as your private key to access
              and operate the Chain Account.
            </p>
            <p className="mb-3 font-semibold text-gray-900">Each party must:</p>
            <ul className="list-disc list-inside space-y-1 ml-3">
              <li>Keep their access token private and not share it with anyone, including other signatories</li>
              <li>Store it securely and treat it with the same confidentiality as a bank password or PIN</li>
              <li>Report any loss, theft, or suspected compromise to Acredis immediately</li>
              <li>Understand that Acredis bears no liability for unauthorized access resulting from a shared or compromised token</li>
            </ul>
          </div>
        </div>

        {/* PART 6: Terms & Conditions */}
        <div className="bg-white shadow-sm p-8 mb-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center border-b-2 border-blue-600 pb-2">
            <FileCheck className="w-6 h-6 mr-2 text-blue-600" />
            PART 6 — TERMS & CONDITIONS
          </h2>
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">1. Governing Law</p>
              <p>
                This Agreement and the Chain Account are governed by the laws of the United Arab Emirates, including all applicable
                regulations issued by the Virtual Assets Regulatory Authority (VARA) or the Financial Services Regulatory Authority (FSRA)
                as applicable to the jurisdiction in which Acredis Finance operates.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">2. Joint and Several Liability</p>
              <p>
                All parties to this Agreement share equal responsibility for all activity conducted through the Chain Account.
                Each signatory is jointly and severally liable for obligations arising from the account&apos;s use.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">3. Dispute Resolution</p>
              <p className="mb-2">
                In the event of a dispute between parties regarding account activity, governance, or any matter related to this Agreement:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-3">
                <li>Acredis will temporarily freeze the account to prevent further transactions</li>
                <li>The account will remain frozen until Acredis receives written instruction from all parties to resume operations</li>
                <li>Acredis does not arbitrate between parties and bears no responsibility for resolving inter-party disputes</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">4. Account Dormancy</p>
              <p>
                If no deposits, withdrawals, investments, or other account activity occur for <strong>180 consecutive days</strong>,
                Acredis reserves the right to flag the account for review, notify all signatories, and may impose dormancy fees or
                request confirmation of continued intent to maintain the account.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">5. Account Freezing by Platform</p>
              <p className="mb-2">
                Acredis reserves the right to suspend, freeze, or close the Chain Account under the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-3">
                <li>Suspected fraudulent activity or breach of platform Terms of Service</li>
                <li>Failure to comply with Know Your Customer (KYC) or Anti-Money Laundering (AML) requirements</li>
                <li>Legal or regulatory order from competent authorities</li>
                <li>Any activity that violates UAE law or platform policies</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">6. Amendments</p>
              <p>
                Any modification to this Agreement or the account governance structure requires the written consent of all parties
                and must be submitted through the Chain Account modification workflow.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-2">7. Platform Terms</p>
              <p>
                This Memorandum is supplemental to and does not replace the general Acredis Finance Terms of Service. All parties
                remain bound by the platform&apos;s general terms in addition to the specific provisions outlined herein.
              </p>
            </div>
          </div>
        </div>

        {/* PART 7: Signatory Confirmation */}
        <div className="bg-white shadow-sm p-8 mb-6 border border-gray-200">
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
                <div key={index} className="flex items-center justify-between border-b border-gray-200 pb-3 last:border-0">
                  <div>
                    <p className="font-semibold text-gray-900">{m.name || m.email}</p>
                    <p className="text-sm text-gray-600">{m.role.replace('_', ' ')}</p>
                  </div>
                  {m.hasConfirmed ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <div className="text-right">
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
        <div className="bg-white shadow-lg border-2 border-blue-600 rounded-lg p-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 mb-6">
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

          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSign}
              disabled={signing}
              className="px-8 py-4 bg-linear-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-lg font-bold"
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

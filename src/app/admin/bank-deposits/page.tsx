"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authorizationCode: string;
}

interface Bank {
  id: string;
  name: string;
  code: string;
}

interface UserBankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankBranch: string | null;
  bank: Bank;
}

interface BankDeposit {
  id: string;
  amount: number;
  referenceNumber: string;
  proofImage: string | null;
  status: string;
  submittedAt: string;
  processedAt: string | null;
  adminNotes: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  userBankAccount: UserBankAccount;
}

export default function AdminBankDepositsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [filteredDeposits, setFilteredDeposits] = useState<BankDeposit[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [selectedDeposit, setSelectedDeposit] = useState<BankDeposit | null>(
    null,
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    setUser(parsedUser);
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchDeposits();
    }
  }, [user]);

  useEffect(() => {
    if (statusFilter === "ALL") {
      setFilteredDeposits(deposits);
    } else {
      setFilteredDeposits(deposits.filter((d) => d.status === statusFilter));
    }
  }, [statusFilter, deposits]);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/admin/bank-deposits");
      setDeposits(response.data.deposits);
      setFilteredDeposits(response.data.deposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      toast.error("Failed to fetch deposits");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedDeposit || !user) return;

    setProcessing(true);
    try {
      await axios.post("/api/admin/bank-deposits/approve", {
        depositId: selectedDeposit.id,
        adminId: user.id,
        adminNotes,
      });

      toast.success("Bank deposit approved successfully");
      setSelectedDeposit(null);
      setAdminNotes("");
      fetchDeposits();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to approve deposit");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDeposit || !user) return;

    if (!adminNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessing(true);
    try {
      await axios.post("/api/admin/bank-deposits/reject", {
        depositId: selectedDeposit.id,
        adminId: user.id,
        adminNotes,
      });

      toast.success("Bank deposit rejected successfully");
      setSelectedDeposit(null);
      setAdminNotes("");
      fetchDeposits();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to reject deposit");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
    };
    return badges[status as keyof typeof badges] || "bg-gray-100 text-gray-800";
  };

  const getStatusCounts = () => {
    return {
      ALL: deposits.length,
      PENDING: deposits.filter((d) => d.status === "PENDING").length,
      APPROVED: deposits.filter((d) => d.status === "APPROVED").length,
      REJECTED: deposits.filter((d) => d.status === "REJECTED").length,
    };
  };

  const counts = getStatusCounts();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72]"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[#c1ff72] rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 md:w-6 md:h-6 text-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">
              Bank Deposits
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Review and process bank deposit requests
            </p>
          </div>
        </div>
      </div>

          {/* Status Filters */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="grid grid-cols-4 divide-x">
              {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`p-4 text-center transition-colors ${
                      statusFilter === status
                        ? "bg-[#c1ff72] text-black font-semibold"
                        : "hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <div className="text-2xl font-bold">{counts[status]}</div>
                    <div className="text-xs uppercase mt-1">{status}</div>
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Deposits Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72]"></div>
              </div>
            ) : filteredDeposits.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 mx-auto text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-gray-600">No deposits found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Bank
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Reference
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Submitted
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDeposits.map((deposit) => (
                      <tr key={deposit.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {deposit.user.name || "N/A"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {deposit.user.email}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {deposit.userBankAccount.bank.name}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          ${deposit.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {deposit.referenceNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(deposit.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(deposit.status)}`}
                          >
                            {deposit.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setSelectedDeposit(deposit);
                              setAdminNotes(deposit.adminNotes || "");
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

      {/* View/Process Modal */}
      {selectedDeposit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Deposit Details</h2>
                <button
                  onClick={() => {
                    setSelectedDeposit(null);
                    setAdminNotes("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">User Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">
                        {selectedDeposit.user.name || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium">
                        {selectedDeposit.user.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bank Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Bank Account Details</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bank:</span>
                      <span className="font-medium">
                        {selectedDeposit.userBankAccount.bank.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Name:</span>
                      <span className="font-medium">
                        {selectedDeposit.userBankAccount.accountName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Number:</span>
                      <span className="font-medium">
                        {selectedDeposit.userBankAccount.accountNumber}
                      </span>
                    </div>
                    {selectedDeposit.userBankAccount.bankBranch && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Branch:</span>
                        <span className="font-medium">
                          {selectedDeposit.userBankAccount.bankBranch}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deposit Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Deposit Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-bold text-lg">
                        ${selectedDeposit.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reference Number:</span>
                      <span className="font-medium">
                        {selectedDeposit.referenceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedDeposit.status)}`}
                      >
                        {selectedDeposit.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Submitted:</span>
                      <span className="font-medium">
                        {new Date(selectedDeposit.submittedAt).toLocaleString()}
                      </span>
                    </div>
                    {selectedDeposit.processedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Processed:</span>
                        <span className="font-medium">
                          {new Date(
                            selectedDeposit.processedAt,
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Notes */}
                {selectedDeposit.status === "PENDING" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Notes{" "}
                      {selectedDeposit.status === "PENDING" &&
                        "(required for rejection)"}
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes or reason for rejection..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72]"
                    />
                  </div>
                ) : selectedDeposit.adminNotes ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Admin Notes</h3>
                    <p className="text-sm text-gray-700">
                      {selectedDeposit.adminNotes}
                    </p>
                  </div>
                ) : null}

                {/* Actions */}
                {selectedDeposit.status === "PENDING" && (
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleReject}
                      disabled={processing}
                      className="flex-1 bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {processing ? "Processing..." : "Reject"}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={processing}
                      className="flex-1 bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {processing ? "Processing..." : "Approve & Credit"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { JSX } from "react";

export interface SidebarItem {
  label: string;
  href: string;
  icon: JSX.Element;
  subMenu?: Array<{
    label: string;
    href: string;
    notificationKey?: string;
  }>;
  notificationKey?: string;
  requiresTradeKey?: boolean;
}

export const sidebarItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Investment',
    href: '/dashboard/investment',
    requiresTradeKey: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    label: 'Transfer',
    href: '/dashboard/transfer',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    subMenu: [
      { label: 'Acredis to Acredis', href: '/dashboard/transfer/acredis-to-acredis' },
      { label: 'Domestic Transfer', href: '/dashboard/transfer/domestic' },
      { label: 'International Transfer', href: '/dashboard/transfer/international' },
      { label: 'History', href: '/dashboard/transfer/history' },
    ],
  },
  {
    label: 'My Account',
    href: '/dashboard/account',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    subMenu: [
      { label: 'Profile', href: '/dashboard/account/profile' },
      { label: 'Statement', href: '/dashboard/account/statement' },
      { label: 'KYC', href: '/dashboard/account/kyc' },
      { label: 'Change Password', href: '/dashboard/account/change-password' },
      { label: 'Change PIN', href: '/dashboard/account/change-pin' },
      { label: 'Activity Log', href: '/dashboard/account/activity-log' },
    ],
  },
  {
    label: 'Monetary',
    href: '/dashboard/monetary',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    subMenu: [
      { label: 'Digital Deposit', href: '/dashboard/monetary/digital-deposit' },
      { label: 'Bank Deposit', href: '/dashboard/monetary/bank-deposit' },
      { label: 'Cheque Deposit', href: '/dashboard/monetary/cheque-deposit' },
      { label: 'Cards', href: '/dashboard/monetary/cards' },
    ],
  },
  {
    label: 'Loan',
    href: '/dashboard/loan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    subMenu: [
      { label: 'Loan Application', href: '/dashboard/loan/application' },
      { label: 'Loan Status', href: '/dashboard/loan/status' },
    ],
  },
  {
    label: 'Support',
    href: '/dashboard/support',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    subMenu: [
      { label: 'FAQ', href: '/dashboard/support/faq' },
      { label: 'Message', href: '/dashboard/support/message', notificationKey: 'messages' },
    ],
  },
];

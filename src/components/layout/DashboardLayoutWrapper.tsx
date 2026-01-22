'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { TradeKeyModal } from '@/components/modals/TradeKeyModal';
import AcredisPlusModal from '@/components/modals/AcredisPlusModal';
import { sidebarItems } from '@/config/sidebar.config';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface DashboardLayoutWrapperProps {
  children: React.ReactNode;
}

export function DashboardLayoutWrapper({ children }: DashboardLayoutWrapperProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tradeKeyModalOpen, setTradeKeyModalOpen] = useState(false);
  const [showPlusModal, setShowPlusModal] = useState(false);
  const [activatingPlus, setActivatingPlus] = useState(false);

  const handleInvestmentClick = async () => {
    if (!user?.id) return;

    // Always show trade key modal when clicking Investment
    setTradeKeyModalOpen(true);
  };

  const handleActivatePlus = async () => {
    if (!user) return;

    setActivatingPlus(true);
    try {
      const response = await axios.post('/api/acredis-plus/activate', {
        userId: user.id
      });

      if (response.data.message) {
        // Update user state
        const updatedUser = { ...user, isPlusUser: true };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setShowPlusModal(false);
        
        toast.success('🎉 Welcome to Acredis Plus!');
        
        // Reload to update UI
        window.location.reload();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to activate Acredis Plus');
    } finally {
      setActivatingPlus(false);
    }
  };

  const getUserId = () => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          return userData.id;
        } catch (error) {
          console.error('Error parsing stored user:', error);
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      setLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Fetch fresh user data from API to ensure profile is up-to-date
      if (parsedUser?.id) {
        fetchUserProfile(parsedUser);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      setLoading(false);
    }
  }, [router]);

  const fetchUserProfile = async (currentUser: any) => {
    if (!currentUser?.id) return;
    
    try {
      const response = await fetch(`/api/profile?userId=${currentUser.id}`);
      if (response.ok) {
        const data = await response.json();
        // API returns { user: {...} } so we need to extract the user object
        const profileData = data.user || data;
        
        // Merge with current user data and update both state and localStorage
        const updatedUser = { ...currentUser, ...profileData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Keep using cached data if API fails
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#c1ff72] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <DashboardSidebar 
        items={sidebarItems}
        userId={getUserId() || undefined}
        user={user}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        onInvestmentClick={handleInvestmentClick}
        onPlusUpgrade={() => setShowPlusModal(true)}
      />
      
      <TradeKeyModal
        isOpen={tradeKeyModalOpen}
        onClose={() => setTradeKeyModalOpen(false)}
        userId={user.id}
      />
      
      <AcredisPlusModal
        isOpen={showPlusModal}
        onClose={() => setShowPlusModal(false)}
        onActivate={handleActivatePlus}
        isActivating={activatingPlus}
      />
      
      <DashboardTopBar 
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      <main
        className={`pt-24 pb-8 px-4 md:px-6 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        {children}
      </main>
    </div>
  );
}

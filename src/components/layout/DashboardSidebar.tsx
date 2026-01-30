'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';

interface SubMenuItem {
  label: string;
  href: string;
  notificationKey?: string; // For tracking unread items
}

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  subMenu?: SubMenuItem[];
  notificationKey?: string; // For tracking unread items
  requiresTradeKey?: boolean; // New flag for investment
}

interface DashboardSidebarProps {
  items: SidebarItem[];
  isAdmin?: boolean;
  userId?: string; // For fetching unread counts
  user?: any; // User object for checking isPlusUser
  onCollapseChange?: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onInvestmentClick?: () => void; // New callback for investment
  onPlusUpgrade?: () => void; // Callback for opening Plus modal
}

export function DashboardSidebar({ items, isAdmin = false, userId, user, onCollapseChange, isMobileOpen = false, onMobileClose, onInvestmentClick, onPlusUpgrade }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const pathname = usePathname();
  const router = useRouter();

  // Fetch unread counts
  useEffect(() => {
    if (!userId) return;

    const fetchUnreadCounts = async () => {
      try {
        if (isAdmin) {
          // Fetch admin notification counts
          const response = await axios.get('/api/admin/notification-counts');
          if (response.data.success) {
            setUnreadCounts(response.data.counts);
          }
        } else {
          // Fetch user notification counts
          const [messagesRes, notificationsRes] = await Promise.all([
            axios.get(`/api/messages?userId=${userId}`),
            axios.get(`/api/notifications?userId=${userId}`)
          ]);

          setUnreadCounts({
            messages: messagesRes.data.unreadCount || 0,
            notifications: notificationsRes.data.unreadCount || 0
          });
        }
      } catch (error) {
        console.error('Error fetching unread counts:', error);
      }
    };

    fetchUnreadCounts();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [userId, isAdmin]);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapseChange?.(newState);
    // Close all submenus when collapsing sidebar
    if (newState) {
      setExpandedMenus([]);
    }
  };

  const toggleSubmenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) 
        ? [] // Close the submenu if it's already open
        : [label] // Open only this submenu and close all others
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-50 ${
          isCollapsed ? 'w-20' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
      {/* Logo Section */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#c1ff72] rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-lg">Acredis</span>
          </div>
        )}
        
        {/* Close button on mobile */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Collapse button on desktop */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:block p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          {isCollapsed ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        {items.map((item) => {
          const isActive = pathname === item.href;
          const isExpanded = expandedMenus.includes(item.label);
          const hasSubMenu = item.subMenu && item.subMenu.length > 0;
          const isSubMenuActive = hasSubMenu && item.subMenu!.some(sub => pathname === sub.href);
          
          return (
            <div key={item.label}>
              <button
                onClick={() => {
                  // Handle investment click specially
                  if (item.requiresTradeKey) {
                    onInvestmentClick?.();
                    return;
                  }
                  
                  if (hasSubMenu && !isCollapsed) {
                    toggleSubmenu(item.label);
                  } else if (!hasSubMenu) {
                    router.push(item.href);
                    onMobileClose?.(); // Close mobile menu on navigation
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isActive || isSubMenuActive
                    ? 'bg-[#c1ff72] text-black font-medium'
                    : 'hover:bg-gray-800 text-gray-300 hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {/* Show unread count badge */}
                    {item.notificationKey && unreadCounts[item.notificationKey] > 0 && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-semibold">
                        {unreadCounts[item.notificationKey]}
                      </span>
                    )}
                    {hasSubMenu && (
                      <svg
                        className={`w-4 h-4 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </>
                )}
              </button>

              {/* Submenu */}
              {hasSubMenu && !isCollapsed && isExpanded && (
                <div className="mt-1 ml-8 space-y-1">
                  {item.subMenu!.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    return (
                      <button
                        key={subItem.href}
                        onClick={() => {
                          router.push(subItem.href);
                          onMobileClose?.(); // Close mobile menu on navigation
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                          isSubActive
                            ? 'bg-[#c1ff72] text-black font-medium'
                            : 'hover:bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        <span className="flex-1 text-left">{subItem.label}</span>
                        {/* Show unread badge on submenu item */}
                        {subItem.notificationKey && unreadCounts[subItem.notificationKey] > 0 && (
                          <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-semibold">
                            {unreadCounts[subItem.notificationKey]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-800">
          {/* Acredis Plus Upgrade Banner */}
          {user && !user.isPlusUser && onPlusUpgrade && (
            <div className="p-3 border-b border-gray-800">
              <div className="bg-linear-to-r from-purple-600 via-indigo-600 to-purple-700 rounded-lg p-3 cursor-pointer hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 transition-all" onClick={onPlusUpgrade}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <h3 className="text-white font-bold text-xs">Acredis Plus</h3>
                  <span className="text-[10px] bg-yellow-400 text-purple-900 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
                </div>
                <p className="text-purple-100 text-[10px] leading-relaxed mb-2">
                  Unlock unlimited financial planning & priority access
                </p>
                <div className="flex items-center justify-between text-white text-[10px] font-semibold">
                  <span>Learn More</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-4">
            <div className="text-xs text-gray-500 text-center">
              {isAdmin ? 'Admin Panel' : 'User Dashboard'}
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}

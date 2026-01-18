'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import axios from 'axios';
import { sidebarItems } from '@/config/sidebar.config';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authorizationCode: string;
}

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
}

export default function FAQPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    
    // Redirect admin to admin dashboard
    if (parsedUser.role === 'ADMIN') {
      router.push('/admin/dashboard');
      return;
    }

    setUser(parsedUser);
  }, [router]);

  // Fetch FAQs
  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/faqs', {
          params: {
            category: selectedCategory !== 'All' ? selectedCategory : undefined,
            search: searchQuery || undefined,
          },
        });
        setFaqs(response.data.faqs);
        setCategories(['All', ...response.data.categories]);
      } catch (error) {
        console.error('Error fetching FAQs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFAQs();
  }, [selectedCategory, searchQuery]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72]"></div>
      </div>
    );
  }

  const toggleFAQ = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <DashboardSidebar 
        items={sidebarItems} 
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Top Bar */}
      <DashboardTopBar 
        user={user} 
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Content */}
      <main
        className={`pt-24 pb-8 px-6 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >

        {/* Search and Filter */}
        <div className="max-w-4xl mx-auto">

          {/* Category Filters */}
          <div className="mb-8 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-[#c1ff72] text-black'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-[#c1ff72]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72] mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading FAQs...</p>
            </div>
          ) : (
            <>
              {/* FAQ List */}
              <div className="space-y-4">
                {faqs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600 text-lg">No questions found matching your search</p>
              <p className="text-gray-500 text-sm mt-2">Try different keywords or contact support</p>
            </div>
          ) : (
            faqs.map((faq) => (
              <div key={faq.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <span className="text-xs font-medium text-[#c1ff72] bg-black px-2 py-1 rounded mb-2 inline-block">
                      {faq.category}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900">{faq.question}</h3>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 shrink-0 ml-4 transition-transform ${
                      expandedId === faq.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedId === faq.id && (
                  <div className="px-6 pb-4">
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
            </>
          )}

        {/* Contact Support */}
        <div className="mt-12 bg-linear-to-r from-black to-gray-800 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Still have questions?</h2>
          <p className="text-gray-300 mb-6">Our support team is here to help you 24/7</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/dashboard/support/message')}
              className="px-6 py-3 bg-[#c1ff72] text-black font-semibold rounded-lg hover:bg-[#b0ef62] transition-colors"
            >
              Send us a message
            </button>
            <a
              href="mailto:support@acredisfinance.com"
              className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Email Support
            </a>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
}

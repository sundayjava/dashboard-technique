'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Post {
  id: string;
  title: string;
  content: string;
  links: string | null;
  createdAt: string;
}

export default function InvestmentStrategyPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axios.get('/api/admin/posts?published=true');
      setPosts(response.data.posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#c1ff72', borderTopColor: 'transparent' }}></div>
          <p className="text-gray-600">Loading investment strategies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="py-16" style={{ background: 'linear-gradient(to right, #10b981, #c1ff72)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Investment Strategies</h1>
          <p className="text-gray-800">Explore proven strategies to maximize your investment returns</p>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
            <p className="text-gray-500 text-lg">No investment strategies available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  if (post.links) {
                    window.open(post.links, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {post.content}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(post.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}</span>
                    <span className="font-semibold" style={{ color: '#10b981' }}>
                      Read More →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

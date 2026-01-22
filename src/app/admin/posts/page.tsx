'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface Post {
  id: string;
  title: string;
  content: string;
  links: string | null;
  published: boolean;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPostsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [links, setLinks] = useState('');
  const [published, setPublished] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'ADMIN') {
      toast.error('Unauthorized access');
      router.push('/dashboard');
      return;
    }

    setUser(parsedUser);
    fetchPosts();
  }, [router]);

  useEffect(() => {
    if (activeFilter === 'ALL') {
      setFilteredPosts(posts);
    } else if (activeFilter === 'PUBLISHED') {
      setFilteredPosts(posts.filter(post => post.published));
    } else {
      setFilteredPosts(posts.filter(post => !post.published));
    }
  }, [activeFilter, posts]);

  const fetchPosts = async () => {
    try {
      const response = await axios.get('/api/admin/posts');
      setPosts(response.data.posts);
      setFilteredPosts(response.data.posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (post?: Post) => {
    if (post) {
      setIsEditing(true);
      setSelectedPost(post);
      setTitle(post.title);
      setContent(post.content);
      setLinks(post.links || '');
      setPublished(post.published);
    } else {
      setIsEditing(false);
      setSelectedPost(null);
      setTitle('');
      setContent('');
      setLinks('');
      setPublished(false);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPost(null);
    setTitle('');
    setContent('');
    setLinks('');
    setPublished(false);
    setIsEditing(false);
  };

  const handleSavePost = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setIsSaving(true);

    try {
      if (isEditing && selectedPost) {
        await axios.put('/api/admin/posts', {
          id: selectedPost.id,
          title,
          content,
          links: links.trim() || null,
          published
        });
        toast.success('Post updated successfully');
      } else {
        await axios.post('/api/admin/posts', {
          title,
          content,
          links: links.trim() || null,
          published,
          authorId: user.id
        });
        toast.success('Post created successfully');
      }

      handleCloseModal();
      fetchPosts();
    } catch (error: any) {
      console.error('Error saving post:', error);
      toast.error(error.response?.data?.error || 'Failed to save post');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (post: Post) => {
    if (!confirm(`Are you sure you want to delete "${post.title}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await axios.delete(`/api/admin/posts?id=${post.id}`);
      toast.success('Post deleted successfully');
      fetchPosts();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error(error.response?.data?.error || 'Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.published).length,
    draft: posts.filter(p => !p.published).length
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Post Management</h1>
            <p className="text-gray-600 mt-1">Create and manage blog posts</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-[#c1ff72] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Create Post
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-600 mb-1">Total Posts</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
            <p className="text-xs text-green-800 mb-1">Published</p>
            <p className="text-2xl font-bold text-green-900">{stats.published}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-4">
            <p className="text-xs text-yellow-800 mb-1">Drafts</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.draft}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['ALL', 'PUBLISHED', 'DRAFT'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter as any)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                activeFilter === filter
                  ? 'bg-[#c1ff72] text-black'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Posts List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {filteredPosts.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">
              No posts found
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPosts.map((post) => (
                <div key={post.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{post.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          post.published
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {post.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{post.content}</p>
                      {post.links && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1">Link:</p>
                          <a 
                            href={post.links}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline break-all line-clamp-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {post.links}
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Created: {new Date(post.createdAt).toLocaleDateString()}</span>
                        <span>Updated: {new Date(post.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleOpenModal(post)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(post)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Edit Post' : 'Create New Post'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                  placeholder="Enter post title"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                  rows={10}
                  placeholder="Enter post content"
                />
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link URL (Optional)
                </label>
                <input
                  type="url"
                  value={links}
                  onChange={(e) => setLinks(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                  placeholder="https://example.com/article"
                />
              </div>

              {/* Published Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="published"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="w-5 h-5 text-[#c1ff72] border-gray-300 rounded focus:ring-[#c1ff72]"
                />
                <label htmlFor="published" className="text-sm font-medium text-gray-700">
                  Publish immediately
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePost}
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 bg-[#c1ff72] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : isEditing ? 'Update Post' : 'Create Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

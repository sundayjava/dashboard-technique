'use client';

import Image from 'next/image';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const getInitial = () => {
    return name?.charAt(0).toUpperCase() || '?';
  };

  const getBackgroundColor = () => {
    // Generate consistent color based on name
    if (!name) return 'bg-gray-500';
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-teal-500',
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  if (src) {
    return (
      <div className={`relative rounded-full overflow-hidden ${sizeClasses[size]} ${className}`}>
        <Image
          src={src}
          alt={name || 'User avatar'}
          fill
          className="object-cover"
          sizes={size === 'xl' ? '96px' : size === 'lg' ? '64px' : size === 'md' ? '40px' : '32px'}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${getBackgroundColor()} rounded-full flex items-center justify-center text-white font-semibold ${className}`}
    >
      {getInitial()}
    </div>
  );
}

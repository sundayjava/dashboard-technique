'use client';

import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';

interface SliderCaptchaProps {
  onSuccess: () => void;
  onFail?: () => void;
}

export function SliderCaptcha({ onSuccess, onFail }: SliderCaptchaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [puzzleX, setPuzzleX] = useState(0);
  const [puzzleY, setPuzzleY] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const puzzleCanvasRef = useRef<HTMLCanvasElement>(null);

  const maxPosition = trackRef.current?.offsetWidth 
    ? trackRef.current.offsetWidth - 50 
    : 250;

  // Initialize puzzle position
  useEffect(() => {
    resetPuzzle();
  }, []);

  const resetPuzzle = () => {
    const newX = Math.random() * 150 + 100; // Random X between 100-250
    const newY = Math.random() * 80 + 40;   // Random Y between 40-120
    setPuzzleX(newX);
    setPuzzleY(newY);
    setPosition(0);
    setIsVerified(false);
    setIsFailed(false);
    drawBackground();
    drawPuzzlePiece(newX, newY);
  };

  const drawBackground = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 300, 150);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 150);

    // Add some random shapes for visual interest
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 300;
      const y = Math.random() * 150;
      const radius = Math.random() * 20 + 5;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawPuzzlePiece = (x: number, y: number) => {
    const canvas = puzzleCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 300, 150);

    // Draw puzzle piece shadow on main canvas
    const mainCanvas = canvasRef.current;
    const mainCtx = mainCanvas?.getContext('2d');
    if (mainCtx) {
      mainCtx.save();
      mainCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      mainCtx.fillRect(x, y, 50, 50);
      mainCtx.strokeStyle = '#fff';
      mainCtx.lineWidth = 2;
      mainCtx.strokeRect(x, y, 50, 50);
      mainCtx.restore();
    }

    // Draw movable puzzle piece
    ctx.fillStyle = '#c1ff72';
    ctx.fillRect(0, y, 50, 50);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, y, 50, 50);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isVerified) return;
    setIsDragging(true);
    setIsFailed(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isVerified) return;
    setIsDragging(true);
    setIsFailed(false);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !trackRef.current) return;

    const trackRect = trackRef.current.getBoundingClientRect();
    const newPosition = Math.max(0, Math.min(clientX - trackRect.left - 25, maxPosition));
    setPosition(newPosition);

    // Update puzzle piece position
    const canvas = puzzleCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 300, 150);
        ctx.fillStyle = '#c1ff72';
        ctx.fillRect(newPosition, puzzleY, 50, 50);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(newPosition, puzzleY, 50, 50);
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Check if puzzle piece is in correct position (within 5px tolerance)
    if (Math.abs(position - puzzleX) < 5) {
      setIsVerified(true);
      onSuccess();
    } else {
      setIsFailed(true);
      setTimeout(() => {
        resetPuzzle();
        onFail?.();
      }, 800);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, position, puzzleX]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        {/* Instructions */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-600 font-medium">
            {isVerified ? (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Verified successfully
              </span>
            ) : isFailed ? (
              <span className="text-red-600">Try again - slide puzzle to fit</span>
            ) : (
              'Drag the puzzle piece to fit the gap'
            )}
          </p>
          {(isVerified || isFailed) && (
            <button
              onClick={resetPuzzle}
              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
              title="Reset"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>

        {/* Puzzle Canvas */}
        <div className="relative mb-4 rounded-lg overflow-hidden shadow-md border-2 border-gray-300">
          <canvas
            ref={canvasRef}
            width={300}
            height={150}
            className="w-full h-auto"
          />
          <canvas
            ref={puzzleCanvasRef}
            width={300}
            height={150}
            className="absolute top-0 left-0 w-full h-auto pointer-events-none"
          />
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-12 bg-white border-2 border-gray-300 rounded-lg overflow-hidden select-none"
        >
          {/* Progress Fill */}
          <div
            className={`absolute top-0 left-0 bottom-0 transition-all ${
              isVerified
                ? 'bg-green-400'
                : isFailed
                ? 'bg-red-400'
                : 'bg-linear-to-r from-[#c1ff72] to-[#a8e85f]'
            }`}
            style={{ width: `${(position / maxPosition) * 100}%` }}
          />

          {/* Slider Handle */}
          <div
            ref={sliderRef}
            className={`absolute top-0 bottom-0 w-12 flex items-center justify-center cursor-grab transition-all ${
              isDragging ? 'cursor-grabbing scale-105' : ''
            } ${
              isVerified
                ? 'bg-green-500 shadow-lg'
                : isFailed
                ? 'bg-red-500 shadow-lg'
                : 'bg-gray-800 shadow-md hover:shadow-lg'
            }`}
            style={{ left: `${position}px` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {isVerified ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : (
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </div>

          {/* Instruction Text (when not started) */}
          {position === 0 && !isVerified && !isDragging && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-gray-400 text-sm font-medium">
                Drag to slide →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

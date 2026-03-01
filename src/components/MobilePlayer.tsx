import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { CastButton } from './CastButton';
import { cn } from '../lib/utils';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));

interface MobilePlayerProps {
  streamUrl: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  muxPlaybackId?: string;
}

export function MobilePlayer({
  streamUrl,
  title,
  subtitle,
  onBack,
  onNext,
  onPrev,
  onDownload,
  downloading,
  muxPlaybackId,
}: MobilePlayerProps) {
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, [resetHideTimer]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 80 || Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX > 0 && onPrev) {
      onPrev();
    } else if (deltaX < 0 && onNext) {
      onNext();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onClick={resetHideTimer}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Title bar overlay */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent pt-[env(safe-area-inset-top)] px-4 pb-8 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            className="glass glass-hover p-2 rounded-full transition-all duration-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                disabled={downloading}
                className="glass glass-hover p-2 rounded-full transition-all duration-300"
              >
                <Download className={cn('w-5 h-5', downloading && 'animate-bounce text-primary')} />
              </button>
            )}
            <CastButton streamUrl={streamUrl} />
          </div>
        </div>
      </div>

      {/* Player */}
      <div className="flex-1 flex items-center justify-center">
        {muxPlaybackId ? (
          <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />}>
            <MuxPlayer
              streamType="on-demand"
              playbackId={muxPlaybackId}
              metadata={{ video_title: title }}
              className="w-full h-full"
            />
          </Suspense>
        ) : (
          <iframe
            key={streamUrl}
            src={streamUrl}
            className="w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
            referrerPolicy="no-referrer"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            style={{ border: 'none' }}
          />
        )}
      </div>

      {/* Swipe navigation indicators */}
      {showControls && (
        <>
          {onPrev && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 glass glass-hover p-2 rounded-full transition-opacity duration-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {onNext && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 glass glass-hover p-2 rounded-full transition-opacity duration-300"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

import { Airplay, Cast, Monitor, Tv } from 'lucide-react';
import { useCast } from '../hooks/useCast';
import { cn } from '../lib/utils';

interface CastButtonProps {
  streamUrl: string;
  className?: string;
}

export function CastButton({ streamUrl, className }: CastButtonProps) {
  const { isCastAvailable, isCasting, castMethod, startCast, stopCast, castDeviceName } = useCast();

  const handleClick = () => {
    if (isCasting) {
      stopCast();
    } else {
      startCast(streamUrl);
    }
  };

  // Pick icon based on detected method
  const Icon = isCasting
    ? Tv
    : castMethod === 'chromecast'
      ? Cast
      : isCastAvailable
        ? Airplay
        : Monitor;

  const tooltip = isCasting
    ? `Casting to ${castDeviceName || 'TV'} — tap to stop`
    : 'Cast to TV';

  return (
    <button
      onClick={handleClick}
      className={cn(
        'glass glass-hover p-2 rounded-full transition-all duration-300 hover:scale-110 relative group',
        isCasting && 'bg-primary/30 border-primary/50 ring-2 ring-primary/30',
        className
      )}
      title={tooltip}
    >
      <Icon className={cn('w-5 h-5', isCasting && 'text-primary animate-pulse')} />
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap glass px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {tooltip}
      </span>
    </button>
  );
}

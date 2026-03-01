import { Airplay, Monitor } from 'lucide-react';
import { useCast } from '../hooks/useCast';
import { cn } from '../lib/utils';

interface CastButtonProps {
  streamUrl: string;
  className?: string;
}

export function CastButton({ streamUrl, className }: CastButtonProps) {
  const { isCastAvailable, isCasting, startCast, stopCast } = useCast();

  const handleClick = () => {
    if (isCasting) {
      stopCast();
      return;
    }

    if (isCastAvailable) {
      startCast(streamUrl);
    } else {
      window.open(streamUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const Icon = isCastAvailable ? Airplay : Monitor;

  return (
    <button
      onClick={handleClick}
      className={cn(
        'glass glass-hover p-2 rounded-full transition-all duration-300 hover:scale-110 relative group',
        isCasting && 'bg-primary/30 border-primary/50',
        className
      )}
      title="Cast to TV"
    >
      <Icon className={cn('w-5 h-5', isCasting && 'text-primary animate-pulse')} />
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap glass px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Cast to TV
      </span>
    </button>
  );
}

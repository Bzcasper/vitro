import { useState, memo } from 'react';
import { Play, Star, X, Download } from 'lucide-react';
import { tmdbService, type TMDBMedia } from '../services/tmdbService';
import { cn } from '../lib/utils';

interface MediaCardProps {
  media: TMDBMedia;
  onClick: () => void;
  onRemove?: () => void;
  onDownload?: () => void;
  showRemove?: boolean;
}

export const MediaCard = memo(function MediaCard({ media, onClick, onRemove, onDownload, showRemove = false }: MediaCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const posterUrl = tmdbService.getPosterUrl(media.poster_path, 'w500');
  const title = tmdbService.getTitle(media);
  const year = tmdbService.getYear(media);
  const mediaType = media.media_type === 'movie' ? 'Movie' : 'TV Show';

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-105 hover:-translate-y-2"
      onClick={onClick}
    >
      {/* Glass card background */}
      <div className="absolute inset-0 glass glass-hover rounded-2xl" />

      {/* Poster Image */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 animate-pulse" />
        )}

        <img
          src={posterUrl}
          alt={title}
          loading="lazy"
          className={cn(
            "w-full h-full object-cover transition-all duration-700",
            imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-110",
            "group-hover:scale-110 group-hover:brightness-75"
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-16 h-16 rounded-full glass flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          {showRemove && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-8 h-8 rounded-full bg-destructive/90 hover:bg-destructive flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="w-8 h-8 rounded-full glass hover:bg-primary/40 flex items-center justify-center"
              title="Download"
            >
              <Download className="w-4 h-4 text-white" />
            </button>
          )}
        </div>

        {/* Rating badge */}
        {media.vote_average > 0 && (
          <div className="absolute top-2 left-2 glass px-2 py-1 rounded-lg flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-semibold text-white">
              {media.vote_average.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Media Info */}
      <div className="relative p-3 space-y-1">
        <h3 className="font-semibold text-sm line-clamp-2 text-white group-hover:text-primary transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{mediaType}</span>
          <span>•</span>
          <span>{year}</span>
        </div>
      </div>
    </div>
  );
});

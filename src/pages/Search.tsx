import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from '../components/SearchInput';
import { MediaCard } from '../components/MediaCard';
import { tmdbService, type TMDBMedia } from '../services/tmdbService';

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBMedia[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await tmdbService.searchMulti(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleClick = useCallback(
    (media: TMDBMedia) => {
      const type = media.media_type || (media.title ? 'movie' : 'tv');
      navigate(`/watch/${type}/${media.id}`);
    },
    [navigate]
  );

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-display font-bold text-white mb-4">Search</h1>
        <SearchInput
          placeholder="Movies, TV shows..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {results.map((media) => (
            <MediaCard
              key={media.id}
              media={media}
              onClick={() => handleClick(media)}
            />
          ))}
        </div>

        {loading && (
          <div className="flex justify-center mt-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="text-center text-muted-foreground mt-12">No results found</p>
        )}
      </div>
    </div>
  );
}

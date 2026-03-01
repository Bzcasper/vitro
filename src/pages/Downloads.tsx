import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, Play } from 'lucide-react';

interface DownloadedVideo {
  filename: string;
  url: string;
  title: string;
  mediaId: string;
  mediaType: 'movie' | 'tv';
  downloadedAt: number;
}

export default function Downloads() {
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState<DownloadedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('vitro_downloads');
    if (stored) {
      try {
        setDownloads(JSON.parse(stored));
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const removeDownload = (filename: string) => {
    const updated = downloads.filter((d) => d.filename !== filename);
    setDownloads(updated);
    localStorage.setItem('vitro_downloads', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen pb-20 px-4 pt-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Download className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-white">Downloads</h1>
        </div>

        {loading ? (
          <div className="flex justify-center mt-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : downloads.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Download className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground">No downloads yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Videos you download will appear here for offline viewing
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {downloads.map((dl) => (
              <div
                key={dl.filename}
                className="glass rounded-xl p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">
                    {dl.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(dl.downloadedAt).toLocaleDateString()}
                  </p>
                </div>

                <button
                  onClick={() =>
                    navigate(`/watch/${dl.mediaType}/${dl.mediaId}`)
                  }
                  className="glass glass-hover p-2 rounded-full"
                >
                  <Play className="w-4 h-4" />
                </button>

                <button
                  onClick={() => removeDownload(dl.filename)}
                  className="glass glass-hover p-2 rounded-full text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

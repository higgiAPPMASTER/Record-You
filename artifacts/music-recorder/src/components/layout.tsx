import { Link, useLocation } from "wouter";
import { Mic, Library, Disc3, SlidersHorizontal, Guitar } from "lucide-react";
import { useGetSongStats } from "@workspace/api-client-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: stats } = useGetSongStats();

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background dark text-foreground">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col justify-between">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="h-16 flex items-center px-6 border-b border-border">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary tracking-tight">
              <Disc3 className="w-6 h-6 animate-pulse-slow" />
              <span>Track</span>
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2">
            <Link href="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-medium transition-colors ${location === '/' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Library className="w-5 h-5" />
              Library
            </Link>
            <Link href="/record" className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-medium transition-colors ${location === '/record' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Mic className="w-5 h-5" />
              Studio
            </Link>
            <Link href="/mixer" className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-medium transition-colors ${location === '/mixer' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <SlidersHorizontal className="w-5 h-5" />
              Mixer
            </Link>
            <Link href="/tuner" className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-medium transition-colors ${location === '/tuner' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Guitar className="w-5 h-5" />
              Tuner
            </Link>
          </nav>
        </div>

        {/* Stats Bar */}
        <div className="p-6 border-t border-border bg-card/50">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Studio Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tracks</span>
              <span className="font-mono font-medium">{stats?.totalSongs || 0}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Recorded</span>
              <span className="font-mono font-medium">{formatDuration(stats?.totalDuration || 0)}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
        <div className="flex-1 overflow-y-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}

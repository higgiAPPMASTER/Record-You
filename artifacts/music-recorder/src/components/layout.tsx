import { Link, useLocation } from "wouter";
import { Mic, Library, Disc3, SlidersHorizontal, Guitar, BookOpen, Music2, Hash, Globe } from "lucide-react";
import { useGetSongStats } from "@workspace/api-client-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/",        label: "Library",  Icon: Library },
  { href: "/record",  label: "Studio",   Icon: Mic },
  { href: "/mixer",   label: "Mixer",    Icon: SlidersHorizontal },
  { href: "/sessions",label: "Sessions", Icon: Globe },
  { href: "/tuner",   label: "Tuner",    Icon: Guitar },
  { href: "/chords",  label: "Chords",   Icon: BookOpen },
  { href: "/tabs",    label: "Tabs",     Icon: Music2 },
  { href: "/capo",    label: "Capo",     Icon: Hash },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: stats } = useGetSongStats();

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-background dark text-foreground">
        {/* Slim icon-only sidebar */}
        <aside className="w-14 flex-shrink-0 border-r border-border bg-sidebar flex flex-col items-center py-3 gap-1">
          {/* Logo */}
          <Link href="/" className="flex items-center justify-center w-10 h-10 mb-2">
            <Disc3 className="w-6 h-6 text-primary animate-pulse-slow" />
          </Link>

          {/* Nav icons */}
          <nav className="flex flex-col items-center gap-1 flex-1">
            {navItems.map(({ href, label, Icon }) => {
              const active = location === href;
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Stats at bottom */}
          <div className="flex flex-col items-center gap-2 pb-1 border-t border-border pt-3 w-full">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center cursor-default">
                  <span className="font-mono text-sm font-semibold text-foreground leading-none">
                    {stats?.totalSongs ?? 0}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">tracks</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {stats?.totalSongs ?? 0} tracks recorded
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center cursor-default">
                  <span className="font-mono text-xs font-medium text-muted-foreground leading-none">
                    {formatDuration(stats?.totalDuration ?? 0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">total</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {formatDuration(stats?.totalDuration ?? 0)} total recorded
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
          <div className="flex-1 overflow-y-auto relative z-10">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

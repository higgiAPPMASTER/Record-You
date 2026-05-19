import { useState, useMemo, useEffect } from "react";
import { CHORDS, ROOTS, QUALITIES } from "@/lib/chords";
import { ChordDiagramSVG } from "@/components/chord-diagram";
import { Input } from "@/components/ui/input";
import { Search, X, BookOpen, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFavourites, toggleFavourite } from "@/lib/favourites";

const QUALITY_LABELS: Record<string, string> = {
  major: "Major", minor: "Minor", "7": "Dom 7", maj7: "Maj 7", m7: "Min 7",
  sus2: "Sus2", sus4: "Sus4", add9: "Add9", dim: "Dim", aug: "Aug",
  power: "Power", "9": "9th", m9: "Min9", "11": "11th", "13": "13th",
};

type View = "all" | "favourites";

export default function Chords() {
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [activeRoot, setActiveRoot] = useState<string | null>(null);
  const [activeQuality, setActiveQuality] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [favs, setFavs] = useState<string[]>(() => getFavourites());

  const handleFav = (full: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavs(toggleFavourite(full));
  };

  const filtered = useMemo(() => {
    return CHORDS.filter((c) => {
      if (view === "favourites" && !favs.includes(c.full)) return false;
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        c.full.toLowerCase().includes(q) ||
        c.root.toLowerCase().includes(q) ||
        c.quality.toLowerCase().includes(q);
      const matchRoot = !activeRoot || c.root === activeRoot;
      const matchQuality = !activeQuality || c.quality === activeQuality;
      return matchSearch && matchRoot && matchQuality;
    });
  }, [search, activeRoot, activeQuality, view, favs]);

  const selectedChord = CHORDS.find((c) => c.full === selected);

  const clearFilters = () => { setSearch(""); setActiveRoot(null); setActiveQuality(null); };
  const hasFilters = search || activeRoot || activeQuality;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Chord Library</h1>
        </div>
        <p className="text-muted-foreground">
          {CHORDS.length} chords — click any diagram to enlarge it, heart it to save.
        </p>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {([["all", "All Chords"], ["favourites", `Favourites${favs.length > 0 ? ` (${favs.length})` : ""}`]] as [View, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              view === v
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "favourites" && <Heart className={cn("inline w-3.5 h-3.5 mr-1.5 -mt-0.5", favs.length > 0 && "fill-primary text-primary")} />}
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-8">
        {/* Filters sidebar */}
        <aside className="w-44 flex-shrink-0 space-y-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm h-8 bg-card border-border/60"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Root</p>
            <div className="grid grid-cols-3 gap-1">
              {ROOTS.map((r) => (
                <button key={r} onClick={() => setActiveRoot(activeRoot === r ? null : r)}
                  className={cn("text-xs font-mono py-1 rounded border transition-colors",
                    activeRoot === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Type</p>
            <div className="space-y-0.5">
              {QUALITIES.filter((q) => CHORDS.some((c) => c.quality === q)).map((q) => (
                <button key={q} onClick={() => setActiveQuality(activeQuality === q ? null : q)}
                  className={cn("w-full text-left text-xs px-2 py-1.5 rounded transition-colors",
                    activeQuality === q
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                  {QUALITY_LABELS[q] ?? q}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-primary hover:underline">
              Clear filters
            </button>
          )}
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              {view === "favourites" ? (
                <>
                  <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium mb-1">No favourites yet</p>
                  <p className="text-sm">Tap the heart icon on any chord to save it here.</p>
                </>
              ) : (
                <>
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No chords match your search.</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map((chord) => {
                const isFav = favs.includes(chord.full);
                return (
                  <div key={chord.full} className="relative group">
                    <button
                      onClick={() => setSelected(selected === chord.full ? null : chord.full)}
                      className={cn(
                        "w-full flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                        "hover:border-primary/50 hover:bg-accent/10 hover:shadow-md",
                        selected === chord.full
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                          : "border-border/50 bg-card"
                      )}
                    >
                      <ChordDiagramSVG chord={chord} size={0.82} />
                      <span className="text-xs font-semibold font-mono mt-1">{chord.full}</span>
                    </button>
                    {/* Heart button */}
                    <button
                      onClick={(e) => handleFav(chord.full, e)}
                      aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
                      className={cn(
                        "absolute top-1.5 right-1.5 p-1 rounded-full transition-all",
                        "opacity-0 group-hover:opacity-100",
                        isFav && "opacity-100",
                        "hover:bg-primary/10"
                      )}
                    >
                      <Heart className={cn("w-3.5 h-3.5 transition-colors", isFav ? "fill-primary text-primary" : "text-muted-foreground")} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Enlarged modal */}
      {selectedChord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-4xl font-bold font-mono">{selectedChord.full}</h2>
                <span className="text-sm text-muted-foreground capitalize">
                  {QUALITY_LABELS[selectedChord.quality] ?? selectedChord.quality}
                </span>
              </div>
              <button
                onClick={(e) => handleFav(selectedChord.full, e)}
                className="ml-auto p-1.5 rounded-full hover:bg-primary/10 transition-colors"
              >
                <Heart className={cn(
                  "w-5 h-5 transition-colors",
                  favs.includes(selectedChord.full) ? "fill-primary text-primary" : "text-muted-foreground"
                )} />
              </button>
            </div>

            <ChordDiagramSVG chord={selectedChord} size={2} />

            <div className="flex gap-[14px] text-[10px] font-mono text-muted-foreground">
              {["E", "A", "D", "G", "B", "e"].map((s, i) => (
                <span key={i} className="w-4 text-center">{s}</span>
              ))}
            </div>

            <div className="w-full pt-3 border-t border-border">
              <div className="grid grid-cols-6 gap-1 text-center">
                {selectedChord.positions.map((pos, i) => {
                  const f = selectedChord.fingers[i] ?? 0;
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <span className={cn("text-xs font-mono font-bold",
                        pos === -1 ? "text-muted-foreground/40" : "text-foreground")}>
                        {pos === -1 ? "×" : pos === 0 ? "○" : String(pos)}
                      </span>
                      {f > 0 && <span className="text-[9px] text-primary font-semibold">{f}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-6 gap-1 text-center mt-0.5">
                {["E", "A", "D", "G", "B", "e"].map((s) => (
                  <span key={s} className="text-[9px] text-muted-foreground/50 font-mono">{s}</span>
                ))}
              </div>
            </div>

            {selectedChord.barre && (
              <p className="text-xs text-muted-foreground text-center">
                Barre fret {selectedChord.barre.fret} across {selectedChord.barre.to - selectedChord.barre.from + 1} strings
              </p>
            )}

            <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

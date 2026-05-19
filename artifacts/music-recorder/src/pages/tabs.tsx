import { useState, useRef } from "react";
import { getTabs, saveTab, deleteTab, type SavedTab } from "@/lib/tabs-storage";
import { CHORDS } from "@/lib/chords";
import { transposeText, semitoneLabel } from "@/lib/transpose";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChordDiagramSVG } from "@/components/chord-diagram";
import {
  Music2, Plus, Trash2, ChevronDown, ChevronUp, Upload, X,
  ExternalLink, FileText, ArrowUp, ArrowDown, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TAB_LINE_RE = /^[EADGBe]\|/;

function isTabLine(line: string) {
  return TAB_LINE_RE.test(line.trim());
}

function TabRenderer({ content, semitones }: { content: string; semitones: number }) {
  const [hoveredChord, setHoveredChord] = useState<string | null>(null);
  const transposed = transposeText(content, semitones);
  const lines = transposed.split("\n");

  return (
    <div className="font-mono text-sm leading-6 whitespace-pre relative">
      {lines.map((line, i) => {
        if (isTabLine(line)) {
          return <div key={i} className="text-primary/90 tracking-wide">{line}</div>;
        }

        const trimmed = line.trim();
        const isChordLine =
          trimmed.length > 0 &&
          !trimmed.startsWith("#") &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("[") &&
          trimmed.split(/\s+/).every((token) =>
            /^[A-G][#b]?(?:maj7|maj|min|m7|m9|sus[24]?|add9?|dim|aug|m|[79]|11|13)?$/.test(token)
          );

        if (isChordLine) {
          return (
            <div key={i} className="text-orange-400 font-semibold">
              {trimmed.split(/(\s+)/).map((token, j) => {
                if (/^\s+$/.test(token)) return <span key={j}>{token}</span>;
                const chord = CHORDS.find((c) => c.full === token || c.name === token);
                return (
                  <span
                    key={j}
                    className={cn("cursor-pointer", chord && "hover:underline text-primary")}
                    onMouseEnter={() => chord && setHoveredChord(token)}
                    onMouseLeave={() => setHoveredChord(null)}
                  >
                    {token}
                  </span>
                );
              })}
            </div>
          );
        }

        if (trimmed.startsWith("#") || trimmed.startsWith("[")) {
          return <div key={i} className="text-muted-foreground/60 italic">{line}</div>;
        }

        return <div key={i} className="text-foreground/80">{line}</div>;
      })}

      {hoveredChord && (() => {
        const chord = CHORDS.find((c) => c.full === hoveredChord || c.name === hoveredChord);
        if (!chord) return null;
        return (
          <div className="fixed z-50 pointer-events-none" style={{ bottom: "2rem", right: "2rem" }}>
            <div className="bg-card border border-primary/30 rounded-xl p-4 shadow-xl flex flex-col items-center gap-2">
              <span className="text-sm font-bold font-mono">{chord.full}</span>
              <ChordDiagramSVG chord={chord} size={1.2} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function TransposeControl({
  semitones,
  onChange,
}: {
  semitones: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Transpose</span>
      <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-1 py-0.5 border border-border/50">
        <button
          onClick={() => onChange(semitones - 1)}
          className="p-1 rounded hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={semitones <= -11}
          title="Down 1 semitone"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
        <span
          className={cn(
            "text-xs font-mono w-20 text-center font-semibold transition-colors",
            semitones === 0 ? "text-muted-foreground" : "text-primary"
          )}
        >
          {semitoneLabel(semitones)}
        </span>
        <button
          onClick={() => onChange(semitones + 1)}
          className="p-1 rounded hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={semitones >= 11}
          title="Up 1 semitone"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
      </div>
      {semitones !== 0 && (
        <button
          onClick={() => onChange(0)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Reset to original key"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      )}
    </div>
  );
}

function TabCard({ tab, onDelete }: { tab: SavedTab; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [semitones, setSemitones] = useState(0);

  return (
    <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{tab.title || "Untitled"}</p>
          {tab.artist && (
            <p className="text-xs text-muted-foreground truncate">{tab.artist}</p>
          )}
        </div>
        {semitones !== 0 && (
          <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
            {semitones > 0 ? "+" : ""}{semitones}st
          </span>
        )}
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {new Date(tab.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/50 bg-background/30">
          {/* Transpose bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-card/40">
            <TransposeControl semitones={semitones} onChange={setSemitones} />
            {semitones !== 0 && (
              <span className="text-[10px] text-muted-foreground">
                Tab lines stay unchanged — only chord names shift
              </span>
            )}
          </div>
          {/* Tab content */}
          <div className="px-4 py-4 overflow-x-auto">
            <TabRenderer content={tab.content} semitones={semitones} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Tabs() {
  const { toast } = useToast();
  const [tabs, setTabs] = useState<SavedTab[]>(() => getTabs());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [previewSemitones] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setTabs(getTabs());

  const handleSave = () => {
    if (!content.trim()) {
      toast({ title: "Paste some tab content first", variant: "destructive" });
      return;
    }
    saveTab({ title: title.trim() || "Untitled", artist: artist.trim(), content: content.trim() });
    refresh();
    setTitle("");
    setArtist("");
    setContent("");
    setPreview(false);
    setShowForm(false);
    toast({ title: "Tab saved" });
  };

  const handleDelete = (id: string) => {
    deleteTab(id);
    refresh();
    toast({ title: "Tab deleted" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setContent(text);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      setShowForm(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Music2 className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">My Tabs</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Paste tabs from Ultimate Guitar. Transpose any tab up or down instantly.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a
            href="https://www.ultimate-guitar.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border/60 rounded-lg px-3 py-2 hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ultimate Guitar
          </a>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Upload .txt
          </Button>
          <input ref={fileRef} type="file" accept=".txt,.tab" className="hidden" onChange={handleFileUpload} />
          <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5">
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? "Cancel" : "Add Tab"}
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 border border-primary/20 rounded-xl bg-card p-5 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">New Tab</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Song title</label>
              <Input
                placeholder="e.g. Wonderwall"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Artist</label>
              <Input
                placeholder="e.g. Oasis"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">
                Tab content — paste from Ultimate Guitar
              </label>
              {content && (
                <button
                  onClick={() => setPreview((v) => !v)}
                  className="text-xs text-primary hover:underline"
                >
                  {preview ? "Edit" : "Preview"}
                </button>
              )}
            </div>
            {preview && content ? (
              <div className="min-h-40 max-h-96 overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-4">
                <TabRenderer content={content} semitones={previewSemitones} />
              </div>
            ) : (
              <Textarea
                placeholder={"Paste tab text here...\n\nExample:\nem  G  C  D\nToday is gonna be the day...\n\ne|--0--3--0--2--|\nB|--0--0--1--3--|\n..."}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-40 font-mono text-xs resize-y bg-background/40"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setContent(""); setTitle(""); setArtist(""); }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!content.trim()}>
              Save Tab
            </Button>
          </div>
        </div>
      )}

      {/* Saved tabs */}
      {tabs.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <Music2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium mb-1">No tabs saved yet</p>
          <p className="text-sm">
            Paste a tab from Ultimate Guitar or upload a .txt file to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tabs.map((tab) => (
            <TabCard key={tab.id} tab={tab} onDelete={() => handleDelete(tab.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

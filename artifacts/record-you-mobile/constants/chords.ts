export interface ChordDiagram {
  name: string;
  full: string;
  root: string;
  quality: string;
  positions: number[];
  fingers: number[];
  barre?: { fret: number; from: number; to: number };
  baseFret: number;
}

export const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const QUALITIES = ["major", "minor", "7", "maj7", "m7", "sus2", "sus4", "add9", "dim", "aug", "power"];

export const CHORDS: ChordDiagram[] = [
  // ──── C ────
  { name: "C",     full: "C",     root: "C",  quality: "major", positions: [-1,3,2,0,1,0], fingers: [0,3,2,0,1,0], baseFret: 1 },
  { name: "Cm",    full: "Cm",    root: "C",  quality: "minor", positions: [-1,3,5,5,4,3], fingers: [0,1,3,4,2,1], barre: { fret: 3, from: 0, to: 5 }, baseFret: 1 },
  { name: "Cmaj7", full: "Cmaj7", root: "C",  quality: "maj7",  positions: [-1,3,2,0,0,0], fingers: [0,3,2,0,0,0], baseFret: 1 },
  { name: "C7",    full: "C7",    root: "C",  quality: "7",     positions: [-1,3,2,3,1,0], fingers: [0,3,2,4,1,0], baseFret: 1 },
  { name: "Cm7",   full: "Cm7",   root: "C",  quality: "m7",    positions: [-1,3,5,3,4,3], fingers: [0,1,3,1,2,1], barre: { fret: 3, from: 0, to: 5 }, baseFret: 1 },
  { name: "Csus2", full: "Csus2", root: "C",  quality: "sus2",  positions: [-1,3,0,0,3,3], fingers: [0,2,0,0,3,4], baseFret: 1 },
  { name: "Csus4", full: "Csus4", root: "C",  quality: "sus4",  positions: [-1,3,3,0,1,1], fingers: [0,2,3,0,1,1], baseFret: 1 },
  { name: "Cadd9", full: "Cadd9", root: "C",  quality: "add9",  positions: [-1,3,2,0,3,3], fingers: [0,2,1,0,3,4], baseFret: 1 },

  // ──── D ────
  { name: "D",     full: "D",     root: "D",  quality: "major", positions: [-1,-1,0,2,3,2], fingers: [0,0,0,1,3,2], baseFret: 1 },
  { name: "Dm",    full: "Dm",    root: "D",  quality: "minor", positions: [-1,-1,0,2,3,1], fingers: [0,0,0,2,3,1], baseFret: 1 },
  { name: "Dmaj7", full: "Dmaj7", root: "D",  quality: "maj7",  positions: [-1,-1,0,2,2,2], fingers: [0,0,0,1,2,3], baseFret: 1 },
  { name: "D7",    full: "D7",    root: "D",  quality: "7",     positions: [-1,-1,0,2,1,2], fingers: [0,0,0,2,1,3], baseFret: 1 },
  { name: "Dm7",   full: "Dm7",   root: "D",  quality: "m7",    positions: [-1,-1,0,2,1,1], fingers: [0,0,0,2,1,1], baseFret: 1 },
  { name: "Dsus2", full: "Dsus2", root: "D",  quality: "sus2",  positions: [-1,-1,0,2,3,0], fingers: [0,0,0,1,3,0], baseFret: 1 },
  { name: "Dsus4", full: "Dsus4", root: "D",  quality: "sus4",  positions: [-1,-1,0,2,3,3], fingers: [0,0,0,1,3,4], baseFret: 1 },
  { name: "Dadd9", full: "Dadd9", root: "D",  quality: "add9",  positions: [-1,-1,0,2,3,0], fingers: [0,0,0,1,2,0], baseFret: 1 },
  { name: "Ddim",  full: "Ddim",  root: "D",  quality: "dim",   positions: [-1,-1,0,1,0,1], fingers: [0,0,0,1,0,2], baseFret: 1 },

  // ──── E ────
  { name: "E",     full: "E",     root: "E",  quality: "major", positions: [0,2,2,1,0,0], fingers: [0,2,3,1,0,0], baseFret: 1 },
  { name: "Em",    full: "Em",    root: "E",  quality: "minor", positions: [0,2,2,0,0,0], fingers: [0,2,3,0,0,0], baseFret: 1 },
  { name: "Emaj7", full: "Emaj7", root: "E",  quality: "maj7",  positions: [0,2,1,1,0,0], fingers: [0,2,1,1,0,0], baseFret: 1 },
  { name: "E7",    full: "E7",    root: "E",  quality: "7",     positions: [0,2,0,1,0,0], fingers: [0,2,0,1,0,0], baseFret: 1 },
  { name: "Em7",   full: "Em7",   root: "E",  quality: "m7",    positions: [0,2,0,0,0,0], fingers: [0,2,0,0,0,0], baseFret: 1 },
  { name: "Esus4", full: "Esus4", root: "E",  quality: "sus4",  positions: [0,2,2,2,0,0], fingers: [0,2,3,4,0,0], baseFret: 1 },
  { name: "Eaug",  full: "Eaug",  root: "E",  quality: "aug",   positions: [0,3,2,1,1,0], fingers: [0,3,2,1,1,0], baseFret: 1 },
  { name: "E5",    full: "E5",    root: "E",  quality: "power", positions: [0,2,2,-1,-1,-1], fingers: [0,1,2,0,0,0], baseFret: 1 },

  // ──── F ────
  { name: "F",     full: "F",     root: "F",  quality: "major", positions: [1,1,2,3,3,1], fingers: [1,1,2,3,4,1], barre: { fret: 1, from: 0, to: 5 }, baseFret: 1 },
  { name: "Fm",    full: "Fm",    root: "F",  quality: "minor", positions: [1,1,3,3,2,1], fingers: [1,1,3,4,2,1], barre: { fret: 1, from: 0, to: 5 }, baseFret: 1 },
  { name: "Fmaj7", full: "Fmaj7", root: "F",  quality: "maj7",  positions: [-1,-1,3,2,1,0], fingers: [0,0,3,2,1,0], baseFret: 1 },
  { name: "F7",    full: "F7",    root: "F",  quality: "7",     positions: [1,1,2,1,1,1], fingers: [1,1,2,1,1,1], barre: { fret: 1, from: 0, to: 5 }, baseFret: 1 },
  { name: "Fm7",   full: "Fm7",   root: "F",  quality: "m7",    positions: [1,1,3,1,2,1], fingers: [1,1,3,1,2,1], barre: { fret: 1, from: 0, to: 5 }, baseFret: 1 },
  { name: "F5",    full: "F5",    root: "F",  quality: "power", positions: [1,3,3,-1,-1,-1], fingers: [1,3,4,0,0,0], baseFret: 1 },

  // ──── G ────
  { name: "G",     full: "G",     root: "G",  quality: "major", positions: [3,2,0,0,0,3], fingers: [2,1,0,0,0,3], baseFret: 1 },
  { name: "Gm",    full: "Gm",    root: "G",  quality: "minor", positions: [3,5,5,3,3,3], fingers: [1,3,4,1,1,1], barre: { fret: 3, from: 0, to: 5 }, baseFret: 1 },
  { name: "Gmaj7", full: "Gmaj7", root: "G",  quality: "maj7",  positions: [3,2,0,0,0,2], fingers: [3,2,0,0,0,1], baseFret: 1 },
  { name: "G7",    full: "G7",    root: "G",  quality: "7",     positions: [3,2,0,0,0,1], fingers: [3,2,0,0,0,1], baseFret: 1 },
  { name: "Gm7",   full: "Gm7",   root: "G",  quality: "m7",    positions: [3,5,3,3,3,3], fingers: [1,3,1,1,1,1], barre: { fret: 3, from: 0, to: 5 }, baseFret: 1 },
  { name: "Gsus2", full: "Gsus2", root: "G",  quality: "sus2",  positions: [3,0,0,0,3,3], fingers: [2,0,0,0,3,4], baseFret: 1 },
  { name: "Gsus4", full: "Gsus4", root: "G",  quality: "sus4",  positions: [3,3,0,0,1,3], fingers: [2,3,0,0,1,4], baseFret: 1 },
  { name: "Gadd9", full: "Gadd9", root: "G",  quality: "add9",  positions: [3,2,0,2,0,3], fingers: [2,1,0,3,0,4], baseFret: 1 },
  { name: "G5",    full: "G5",    root: "G",  quality: "power", positions: [3,5,5,-1,-1,-1], fingers: [1,3,4,0,0,0], baseFret: 3 },

  // ──── A ────
  { name: "A",     full: "A",     root: "A",  quality: "major", positions: [-1,0,2,2,2,0], fingers: [0,0,1,2,3,0], baseFret: 1 },
  { name: "Am",    full: "Am",    root: "A",  quality: "minor", positions: [-1,0,2,2,1,0], fingers: [0,0,2,3,1,0], baseFret: 1 },
  { name: "Amaj7", full: "Amaj7", root: "A",  quality: "maj7",  positions: [-1,0,2,1,2,0], fingers: [0,0,2,1,3,0], baseFret: 1 },
  { name: "A7",    full: "A7",    root: "A",  quality: "7",     positions: [-1,0,2,0,2,0], fingers: [0,0,2,0,3,0], baseFret: 1 },
  { name: "Am7",   full: "Am7",   root: "A",  quality: "m7",    positions: [-1,0,2,0,1,0], fingers: [0,0,2,0,1,0], baseFret: 1 },
  { name: "Asus2", full: "Asus2", root: "A",  quality: "sus2",  positions: [-1,0,2,2,0,0], fingers: [0,0,1,2,0,0], baseFret: 1 },
  { name: "Asus4", full: "Asus4", root: "A",  quality: "sus4",  positions: [-1,0,2,2,3,0], fingers: [0,0,1,2,3,0], baseFret: 1 },
  { name: "Aadd9", full: "Aadd9", root: "A",  quality: "add9",  positions: [-1,0,2,4,2,0], fingers: [0,0,1,3,2,0], baseFret: 1 },
  { name: "Adim",  full: "Adim",  root: "A",  quality: "dim",   positions: [-1,0,1,2,1,2], fingers: [0,0,1,3,2,4], baseFret: 1 },
  { name: "Aaug",  full: "Aaug",  root: "A",  quality: "aug",   positions: [-1,0,3,2,2,1], fingers: [0,0,3,2,1,1], baseFret: 1 },
  { name: "A5",    full: "A5",    root: "A",  quality: "power", positions: [-1,0,2,2,-1,-1], fingers: [0,0,1,2,0,0], baseFret: 1 },

  // ──── B ────
  { name: "B",     full: "B",     root: "B",  quality: "major", positions: [-1,2,4,4,4,2], fingers: [0,1,2,3,4,1], barre: { fret: 2, from: 1, to: 5 }, baseFret: 1 },
  { name: "Bm",    full: "Bm",    root: "B",  quality: "minor", positions: [-1,2,4,4,3,2], fingers: [0,1,3,4,2,1], barre: { fret: 2, from: 1, to: 5 }, baseFret: 1 },
  { name: "B7",    full: "B7",    root: "B",  quality: "7",     positions: [-1,2,1,2,0,2], fingers: [0,2,1,3,0,4], baseFret: 1 },
  { name: "Bm7",   full: "Bm7",   root: "B",  quality: "m7",    positions: [-1,2,4,2,3,2], fingers: [0,1,3,1,2,1], barre: { fret: 2, from: 1, to: 5 }, baseFret: 1 },
  { name: "Bmaj7", full: "Bmaj7", root: "B",  quality: "maj7",  positions: [-1,2,4,3,4,2], fingers: [0,1,3,2,4,1], barre: { fret: 2, from: 1, to: 5 }, baseFret: 1 },
  { name: "Bsus4", full: "Bsus4", root: "B",  quality: "sus4",  positions: [-1,2,4,4,5,2], fingers: [0,1,2,3,4,1], barre: { fret: 2, from: 1, to: 5 }, baseFret: 1 },
  { name: "Bdim",  full: "Bdim",  root: "B",  quality: "dim",   positions: [-1,2,3,4,3,-1], fingers: [0,1,2,4,3,0], baseFret: 1 },

  // ──── C# ────
  { name: "C#",    full: "C#",    root: "C#", quality: "major", positions: [-1,4,6,6,6,4], fingers: [0,1,2,3,4,1], barre: { fret: 4, from: 1, to: 5 }, baseFret: 4 },
  { name: "C#m",   full: "C#m",   root: "C#", quality: "minor", positions: [-1,4,6,6,5,4], fingers: [0,1,3,4,2,1], barre: { fret: 4, from: 1, to: 5 }, baseFret: 4 },
  { name: "C#7",   full: "C#7",   root: "C#", quality: "7",     positions: [-1,4,3,4,2,4], fingers: [0,2,1,3,1,4], baseFret: 3 },
  { name: "C#m7",  full: "C#m7",  root: "C#", quality: "m7",    positions: [-1,4,6,4,5,4], fingers: [0,1,3,1,2,1], barre: { fret: 4, from: 1, to: 5 }, baseFret: 4 },

  // ──── D# ────
  { name: "D#",    full: "D#",    root: "D#", quality: "major", positions: [-1,6,8,8,8,6], fingers: [0,1,2,3,4,1], barre: { fret: 6, from: 1, to: 5 }, baseFret: 6 },
  { name: "D#m",   full: "D#m",   root: "D#", quality: "minor", positions: [-1,6,8,8,7,6], fingers: [0,1,3,4,2,1], barre: { fret: 6, from: 1, to: 5 }, baseFret: 6 },
  { name: "D#7",   full: "D#7",   root: "D#", quality: "7",     positions: [-1,6,5,6,4,6], fingers: [0,2,1,3,1,4], baseFret: 4 },
  { name: "D#m7",  full: "D#m7",  root: "D#", quality: "m7",    positions: [-1,6,8,6,7,6], fingers: [0,1,3,1,2,1], barre: { fret: 6, from: 1, to: 5 }, baseFret: 6 },

  // ──── F# ────
  { name: "F#",    full: "F#",    root: "F#", quality: "major", positions: [2,4,4,3,2,2], fingers: [1,3,4,2,1,1], barre: { fret: 2, from: 0, to: 5 }, baseFret: 2 },
  { name: "F#m",   full: "F#m",   root: "F#", quality: "minor", positions: [2,4,4,2,2,2], fingers: [1,3,4,1,1,1], barre: { fret: 2, from: 0, to: 5 }, baseFret: 2 },
  { name: "F#7",   full: "F#7",   root: "F#", quality: "7",     positions: [2,4,2,3,2,2], fingers: [1,3,1,2,1,1], barre: { fret: 2, from: 0, to: 5 }, baseFret: 2 },
  { name: "F#m7",  full: "F#m7",  root: "F#", quality: "m7",    positions: [2,4,2,2,2,2], fingers: [1,3,1,1,1,1], barre: { fret: 2, from: 0, to: 5 }, baseFret: 2 },

  // ──── G# ────
  { name: "G#",    full: "G#",    root: "G#", quality: "major", positions: [4,6,6,5,4,4], fingers: [1,3,4,2,1,1], barre: { fret: 4, from: 0, to: 5 }, baseFret: 4 },
  { name: "G#m",   full: "G#m",   root: "G#", quality: "minor", positions: [4,6,6,4,4,4], fingers: [1,3,4,1,1,1], barre: { fret: 4, from: 0, to: 5 }, baseFret: 4 },
  { name: "G#7",   full: "G#7",   root: "G#", quality: "7",     positions: [4,6,4,5,4,4], fingers: [1,3,1,2,1,1], barre: { fret: 4, from: 0, to: 5 }, baseFret: 4 },
  { name: "G#m7",  full: "G#m7",  root: "G#", quality: "m7",    positions: [4,6,4,4,4,4], fingers: [1,3,1,1,1,1], barre: { fret: 4, from: 0, to: 5 }, baseFret: 4 },

  // ──── A# ────
  { name: "A#",    full: "A#",    root: "A#", quality: "major", positions: [-1,1,3,3,3,1], fingers: [0,1,2,3,4,1], barre: { fret: 1, from: 1, to: 5 }, baseFret: 1 },
  { name: "A#m",   full: "A#m",   root: "A#", quality: "minor", positions: [-1,1,3,3,2,1], fingers: [0,1,3,4,2,1], barre: { fret: 1, from: 1, to: 5 }, baseFret: 1 },
  { name: "A#7",   full: "A#7",   root: "A#", quality: "7",     positions: [-1,1,3,1,3,1], fingers: [0,1,3,1,4,1], barre: { fret: 1, from: 1, to: 5 }, baseFret: 1 },
  { name: "A#m7",  full: "A#m7",  root: "A#", quality: "m7",    positions: [-1,1,3,1,2,1], fingers: [0,1,3,1,2,1], barre: { fret: 1, from: 1, to: 5 }, baseFret: 1 },
];

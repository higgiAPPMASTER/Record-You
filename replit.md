# Record You

A personal music recording web app where musicians can record songs, manage a library, mix tracks, and use tools like a metronome, chromatic tuner, and chord library.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/music-recorder/` — React + Vite web frontend (port 22278, path `/`)
- `artifacts/api-server/` — Express 5 API (port 8080, path `/api`)
- `artifacts/record-you-mobile/` — Expo React Native mobile app (port 22215, path `/record-you-mobile`)
- `lib/db/` — Drizzle ORM schema, source of truth: `lib/db/src/schema.ts`
- `lib/api-spec/openapi.yaml` — OpenAPI spec, source of truth for all API contracts
- `lib/api-client-react/` — Generated React Query hooks (auto-generated, do not edit)
- `lib/api-zod/` — Generated Zod schemas (auto-generated, do not edit)

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

### Record You — App Description

**Record You** is a personal music recording studio for songwriters, instrumentalists, and anyone who gets ideas at 2am and needs to capture them fast. It runs in the browser with no downloads required, and has a companion mobile app for recording on the go.

---

#### Recording Studio
Hit **New Recording** and your browser mic is live. Record a take, give it a name, add tags and notes (lyrics, chord progressions, whatever), and it's saved to your library instantly. Recordings are stored in the cloud so they're always there when you come back.

#### Song Library
Every recording lives in your **Library** — searchable, organized by date, with duration at a glance. Tap any song to get a full player with a scrubber, adjustable playback speed (0.5× to 2×), and download to save the file locally.

#### Mixer
The **Mixer** lets you layer multiple recordings into a single arrangement. Per-track controls include volume, left/right panning, fade in/out, and a start offset so you can line up parts. A live VU meter shows levels while it plays. Great for building up a rough demo from separate takes — bass idea on one track, melody on another.

#### Chromatic Tuner
Open the **Tuner**, hold your phone or laptop near your instrument, play a note, and it tells you the note name, octave, exact frequency in Hz, and how many cents sharp or flat you are. The needle swings green when you're in tune. Works on guitar, bass, ukulele, violin — any pitched instrument your mic can pick up.

#### Metronome
A clean **Metronome** from 40 to 240 BPM. Use the +/- buttons or tap the tempo button to dial in your feel. On mobile it taps your phone's haptic engine on every beat.

#### Chord Library
The **Chord Library** covers every common chord shape on guitar — major, minor, 7th, sus2, sus4, augmented, diminished, and more across all 12 keys. Each chord shows a neck diagram with finger positions, fret numbers, and which strings to skip.

#### Tab Viewer
The **Tabs** page lets you write, paste, or look up guitar tablature. A clean mono-font display keeps your tab readable on any screen size.

#### Capo Calculator
Enter what key you wrote a song in and what key you want to sing it in — the **Capo** tool tells you which fret to put the capo on and what chord shapes to use. Useful when you're working out a new song and need to match a vocalist's range.

#### Open Sessions (Public Collaboration)
The best feature for when you've got a great rhythm but need a lead player, a vocalist, or a picking part. Go to any song in your library, click **Post to Open Sessions**, type what you're looking for ("lead guitar", "slide", "harmony vocals", anything), and your song goes live on the **Open Sessions** board.

Any musician can browse Open Sessions, preview your recording, and hit **Collab** — they're taken to a page where they hear your track playing while they record their part over it. When they hit Send, their recording lands in the **Collaborations** panel on your song. You listen, decide if you like it, and reach back out if you do.

#### Private Collaboration
Don't want to post publicly? Use **Share for Collab** to get a private link you send directly to one person. Same flow — they hear you, record their part, send it back.

---

### Platform Summary

| | Web App | Mobile App |
|---|---|---|
| Recording | Yes | Yes |
| Library | Yes | Yes |
| Mixer | Yes | — |
| Tuner | Yes | — |
| Metronome | Yes | Yes |
| Chord Library | Yes | — |
| Tab Viewer | Yes | — |
| Capo Calculator | Yes | — |
| Open Sessions | Yes | — |
| Private Collab | Yes | — |

The **web app** is the full experience. The **mobile app** (built in Expo/React Native) currently covers recording, library management, and the metronome — it's a solid capture tool for getting ideas down when you're away from a desk.

## User preferences

- Pittsburgh Pirates color scheme: primary gold `#FDB827` (hsl 43 97%), pure black backgrounds. Always maintain this theme.
- User has strong melodic/rhythmic ideas but wants collaborative features so other musicians can fill in lead parts, picking, etc.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

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

- **ScriptProcessorNode capture (not MediaRecorder)**: MediaRecorder + Web Audio streams is broken on iOS Safari. We capture raw PCM via ScriptProcessorNode → encode as WAV — works on every browser including iOS.
- **Synthetic reverb impulse**: Reverb is generated with `createImpulse()` (random noise × exponential decay) in the AudioContext — no external IR files needed.
- **Array-based N-track hook**: `useAudioMixer` accepts 2–4 `TrackInfo` objects and maintains parallel arrays of AudioNodes + TrackState, keeping the graph fully dynamic.
- **Web Audio click track**: Precise oscillator scheduling via 25ms look-ahead loop — captures cleanly into the mix WAV if click is enabled during recording.
- **Per-track offset**: Track A is always the time reference (offset = 0); Tracks B/C/D have an adjustable time offset applied at playback start via `setTimeout`.

## Product

- **Song Library**: Record, upload, tag, and browse songs with waveform display and cloud sync.
- **Mixer**: Layer 2–4 tracks with per-track volume, pan, EQ (bass/treble shelving), reverb (wet knob), timing offset, mute/solo, fade in/out, loop, and an audio click track. Records the mix to a WAV file.
- **Trim Page**: Drag start/end handles on a waveform to crop any song; preview the trimmed section; save to library.
- **Tools**: Chromatic tuner, metronome, chord library, capo calculator, tab viewer.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

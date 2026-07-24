# Leaderboard & High Scores — Roadmap

Living doc for the high-score / leaderboard feature: seeds, decisions, and the
tiered plan. Branch: `feat/leaderboard`.

## Goal

A high-score board that eventually shows players' **custom faces + names** —
including a public global board. Get there in tiers so each step ships on its
own and nothing gets thrown away.

## Guiding decisions (locked)

- **No backend yet.** Tier 0 ships fully on GitHub Pages with `localStorage`.
- **Build for the swap, not the SDK.** `leaderboard.ts` exposes `async`
  `submitRun()` / `fetchTop()` from day one, backed by `localStorage`. Swapping
  in a `fetch` backend later touches one file; no callers change.
- **Provider-neutral until forced.** Keep these four things portable so the
  Tier 1 backend choice (Supabase / Cloudflare / etc.) stays open:
  1. `leaderboard.ts` is plain `async` + `fetch` — no SDK shapes leak to callers.
  2. Avatar stored **inline as base64** in the record (no storage bucket).
  3. Run summary is **flat, JSON-serializable, small** (no `Map`/`Uint8Array`/`Date` objects).
  4. Player identity is a **UUID we generate**, not a provider auth ID.
- **Keep the thumbnail tiny.** 64×64 WebP (~2–4 KB) so inline-in-a-row is viable
  everywhere. Letting it creep to 256×256 silently commits us to object storage.
- **The score is client-side and cheatable.** Accepted for Tier 0. Anti-cheat is
  a Tier 1+ conversation, and how much we care is the deciding input for backend.

## The run summary shape (the thing everything reuses)

This is the local record **and** the eventual POST body **and** the anti-cheat
validation input. Get it right once.

```ts
interface RunSummary {
  name: string;
  score: number;
  kills: number;          // total, and consider by-enemy-type for validation
  maxCombo: number;
  framesSurvived: number;
  difficulty: number;     // max difficulty reached
  avatarThumb: string;    // 64×64 WebP as base64 data URL
  playerToken: string;    // localStorage UUID
  ts: number;             // epoch ms
}
```

## Tiers

### Tier 0 — local best (no infra) ← we are here
- [x] Extract the 3 duplicated score-bump blocks in `game.ts` into `recordKill()`
      (pure refactor; where kill telemetry hooks in).
- [x] Extend `GameState` (`types.ts`) with `kills` + `maxCombo` telemetry
      (`framesSurvived` is already tracked as `state.frame`; the summary builder reads it).
- [x] Generate 64×64 WebP thumbnail (`makeThumbnail` in `leaderboard.ts`).
- [x] `src/leaderboard.ts`: async `submitRun()` / `fetchTop()` backed by `localStorage`.
- [x] Player-token UUID in `localStorage`.
- [x] Show `PERSONAL BEST` in `drawGameOver()` and on the upload screen.
- [x] Board render: rows of tiny heads + rank; #1 head fires lasers.
      (Rank rendered in Roboto Mono, not pixelfont — pixelfont has no digit
      glyphs yet; see parking lot.)
- [x] Local top board (top 5 shown), deduped to one best row per player token.

### Tier 1 — global board, names only (needs backend)
- [ ] Pick backend (Supabase = least effort; Cloudflare Workers if we want
      server-side validation logic). Decide based on how much we care about cheating.
- [ ] Swap `leaderboard.ts` local store for `fetch` backend.
- [ ] Name entry + moderation: length/charset whitelist, blocklist.
- [ ] Cheap anti-cheat: validate run-summary invariants server-side
      (e.g. `spawnInterval` floors at 300ms → hard cap on enemies/sec;
      `score ≤ Σ(kills × points × 8)`; `lives lost ≤ 3`).

### Tier 2 — faces on the public board
- [ ] Explicit opt-in checkbox to show face; default to silhouette.
- [ ] Delete path + admin approve queue (can just be the DB dashboard).
- [ ] (EXIF/GPS already stripped for free via `toDataURL()` re-encode.)

### Tier 3 — provable anti-cheat (stretch)
- [ ] Seed RNG, frame-lock the sim, record input stream, re-simulate server-side.
- [ ] Split VERIFIED vs UNVERIFIED boards.

## Seeds / ideas parking lot

- Daily seeded challenge (fixed RNG seed per day).
- Weekly reset / seasons.
- Canvas-generated share card (the screenshot people post).
- Race the #1 player's "ghost".
- 3-letter arcade `AAA` name entry — but `pixelfont.ts` only has 16 glyphs today
  (`L A S E R H D C O N T G M V I F`); needs ~14 more + digits, or fall back to
  Roboto Mono canvas text like the score line.

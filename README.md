# DeutschDeck

A free, offline-first German vocabulary trainer: flashcards with Leitner spaced repetition, a der/die/das article quiz, and a word list you manage yourself — all stored locally in your browser.

**Live demo:** https://ronalisen.github.io/deutsch-deck/

[![CI](https://github.com/RonaliSen/deutsch-deck/actions/workflows/ci.yml/badge.svg)](https://github.com/RonaliSen/deutsch-deck/actions/workflows/ci.yml)

## Screenshots

<!-- Drop PNGs/GIFs into docs/screenshots/ and reference them below. -->

| Home | Study | Quiz | Words |
| --- | --- | --- | --- |
| ![Home](docs/screenshots/home.png) | ![Study](docs/screenshots/study.png) | ![Quiz](docs/screenshots/quiz.png) | ![Words](docs/screenshots/words.png) |

## Features

- **Study mode** — flashcards with a Leitner box algorithm: words you know move up a box and come back less often, words you miss drop back to box 1.
- **Quiz mode** — guess the article (der/die/das) for a noun, filterable by level, with a wrong-answer review at the end.
- **Word list** — add, edit, delete, search, and filter your own vocabulary, with undo on delete.
- **Home dashboard** — due-word count, recent activity, and quick links into Study/Quiz.
- **Dark/light theme**, keyboard-accessible throughout, works fully offline after first load.

## Tech stack

- Angular 22 (standalone components, signals, `@defer`)
- `@ngrx/signals` (SignalStore) for state
- Dexie (IndexedDB) for local persistence
- Angular Material
- Vitest for unit tests

## Architecture decisions

- **SignalStore per feature** (`words.store.ts`, `theme.store.ts`, `progress.store.ts`, plus session stores for Study/Quiz) keeps state, derived signals, and mutations colocated instead of spreading them across services and components.
- **Pure utility functions for the Leitner algorithm** (`core/utils/leitner.ts`) — box/due-date math has no Angular or Dexie dependency, so it's tested as plain input → output with no mocking.
- **Dexie + `liveQuery`** (`core/data/live-queries.ts`) — components reactively read IndexedDB changes without manually re-fetching after every write.
- **Injectable DB (`providedIn: 'root'`)** rather than a module-level singleton — lets tests swap in a fake via Angular's `TestBed` instead of mocking a relative import, which the Angular unit-test builder doesn't support.
- **Self-hosted body font (`@fontsource/inter`)** instead of a Google Fonts `<link>` — avoids sending visitor IPs to Google on every page load for the main typeface. (The Material Symbols icon font is still loaded from `fonts.googleapis.com` — a known gap, see Roadmap.)
- **Accessibility as a default, not a pass** — visible focus rings, logical heading order, labelled icon buttons, `lang="de"` on every German word/phrase so screen readers switch pronunciation correctly, and contrast-checked colors in both themes.

## Running locally

```bash
npm install
npm start
```

Open http://localhost:4200.

## Running tests

```bash
npm test
```

Runs once and exits (no watch, no browser) — safe for CI.

## Roadmap (Version 2)

- Stats page (accuracy over time, per-topic breakdown)
- Settings (daily goal, box intervals, data export/import)
- PWA / offline install + background sync
- Self-host the Material Symbols icon font to drop the remaining Google Fonts request

## Why I built this

I'm learning German in Munich — A2 done, B1 in progress — and kept losing track of der/die/das and the words I'd actually seen in class. Existing apps either cost money or wanted my data in the cloud, so I built a small offline one for myself.

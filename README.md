# Los Santos Radio

GTA V's radio stations in the browser, with no server: a Vite + React app that plays the game's
audio files straight from static hosting. Every device works out the same broadcast from its own
clock, so tuning in at a given moment plays the same thing everywhere, like the in-game radio.

```
stations/<id>/station.json ─► schedule (seeded by station + UTC day) ─► clock ─► <audio> decks
```

The station files in [`stations/`](stations/) are a copy of
[RegalTerritory/GTA-V-Radio-Stations](https://github.com/RegalTerritory/GTA-V-Radio-Stations)
(commit `b08529c`). They're about 2.7 GB and are served as-is; nothing is transcoded.

## Running

```sh
pnpm install
pnpm dev
```

The dev server serves `stations/` itself, with Range requests so the browser can seek into a song.

`pnpm build` writes the app to `dist/`. Deploy it together with `stations/` next to it (it isn't
copied into `dist/`), on any static host that answers Range requests — Cloudflare Pages, Netlify,
Caddy's `file_server`, nginx and S3 all do. Or host the station files elsewhere and point the app
at them with `VITE_STATIONS_URL` (see [`.env.example`](.env.example)). `BASE_PATH` sets the path
the site is served from, if it isn't the root.

### GitHub Pages

Every push to `main` deploys the app to GitHub Pages through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Pages caps a site at 1 GB, so the
station files aren't part of it: the deployed app loads them from this repository's raw files
(`raw.githubusercontent.com`) at the deployed commit. To enable it, set the repository's Pages
source to *GitHub Actions* (Settings → Pages).

## How a station plays

The schedule is built in [`src/schedule.ts`](src/schedule.ts) from each station's `station.json`
and the shared ads and news in `radio.json`, following the same rules as the server's Liquidsoap
script:

| Station type | Examples | Playback |
| --- | --- | --- |
| `"type": "static"` | Blonded, Soulwax FM, The Lab | Pre-mixed parts looped end to end since the Unix epoch |
| no type (music) | Non-Stop-Pop, Radio Los Santos | Planned one UTC day at a time, see below |
| `"type": "talkshow"` | West Coast Talk Radio | As music stations, with shows instead of songs |

A music station's day is generated from a random sequence seeded by the station id and the day,
so every device builds the same one: songs in shuffled order (no repeats until all have played),
and after each song an ad break, the news, a station ID, a DJ monologue or nothing. The DJ may talk
over a song's intro (a line recorded for that song, a general one, or a morning/evening line for
the listener's local time) and lead into ads or news over its outro. The last minutes before
midnight are filled with short programmes so nothing is cut off at the day change.

The chances of each are at the top of `src/schedule.ts` (`RULES`). Changing them, or the station
files, changes the schedule for everyone, so all devices must run the same version.

[`src/player.ts`](src/player.ts) follows the clock with two `<audio>` decks — the item on air and
the next one, preloaded 20 s ahead — plus a third for the DJ's lines over the music. Playback is
nudged back into place if it drifts more than a second from the schedule.

## Debugging

Set `VITE_DEBUG=true` in `.env` to show a panel with the position in the schedule, and buttons
to move the clock (±30 s to +1 day) to test other moments of the broadcast.

## Layout

| Path | Purpose |
| --- | --- |
| `src/schedule.ts` | Builds each station's timeline from its files; finds what's on at a time |
| `src/player.ts` | Plays the timeline: decks, preloading, DJ lines, drift correction |
| `src/clock.ts` | The broadcast clock (device time, shiftable for debugging) |
| `src/schedules.ts` | Loads and caches each station's `station.json` |
| `src/useRadio.ts` | React hook: tuning, status, volume, media session |
| `src/stations.ts` | The stations in the deck, and where their files are |
| `src/components/` | The station deck, player island, station badges and debug panel |
| `src/assets/logos/` | Station logos, by station id |
| `stations/` | Station files: `radio.json`, `<id>/station.json` and the audio |
| `vite.config.ts` | Serves `stations/` in development with Range support |

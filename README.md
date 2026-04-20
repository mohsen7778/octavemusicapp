# Octave — Premium Audio Experience
### The Ultimate Client-Side Music Interface

![License](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2F%20HTML%20%2F%20CSS-blue?style=flat-square)
![Backend](https://img.shields.io/badge/Backend-None-orange?style=flat-square)
![Deploy](https://img.shields.io/badge/Deploy-Cloudflare%20Pages%20%2F%20GitHub%20Pages-F38020?style=flat-square)

---

Octave is a high-performance, client-side web music player built for the modern user. It connects directly to decentralized public audio APIs and delivers a premium, distraction-free listening experience in your browser. No login. No backend. No tracking. Just music.

If you are tired of bloated streaming apps and want something that feels fast, private, and actually yours, this is it.

---

## What it does

Octave sits between you and public audio APIs. It does not host or store any media. Instead, it queries open Invidious instances in real time and serves the audio directly to your browser. Everything else — your playlists, liked songs, history, and preferences — lives in your own browser storage. Nobody else can see it. Not even the developer.

---

## Features

**Glassmorphism UI**
A liquid ambient background engine extracts the dominant color from the current album art and bleeds it across the entire player. The interface shifts tone with every track.

**Mobile-First Design**
Built specifically for phone screens. Zero-scroll layouts, thumb-reachable controls, and hardware-accelerated animations. Feels native, runs in a browser tab.

**Privacy by Architecture**
There is no backend. There is no telemetry. All data is stored in your device's `localStorage`. Closing the app does not mean your data goes anywhere. Clearing your browser cache is the only way to wipe it.

**API Integration**
Invidious handles search and audio. LRCLIB handles lyrics. TheAudioDB and Wikipedia handle artist bios. Everything is open-source and public-facing with no authentication required.

**Sleep Timer**
Set a timer for 15, 30, or 60 minutes. The player stops itself. Useful if you fall asleep to music and hate waking up to autoplay noise three hours later.

**Smart Shuffle**
Not random. Tracks are weighted by your personal play statistics. Songs you have actually listened to more rise to the top. The algorithm also pulls from your liked songs and recent history to avoid loops.

**Vault System**
Export your entire data profile as a single JSON file. Import it on any device or browser. Your library goes where you go.

**Auto-DJ Discover Mix**
Seeds recommendations from your liked songs and recent play history. Runs a multi-node recommendation graph across Invidious and builds an extended queue of fresh tracks without you doing anything.

---

## Background Play

> Octave only supports reliable background audio in **Brave Browser**.

Chrome and most other mobile browsers aggressively kill audio when the tab is backgrounded. Brave handles this correctly. If background listening matters to you, use Brave. It is free, available on Android and iOS, and takes about two minutes to set up.

Download Brave: [brave.com](https://brave.com)

---

## How it works

Octave is a static web application. There is no build step, no Node.js server, no database, no API keys, no accounts.

When you search for a track, Octave cycles through a pool of public Invidious API instances and returns results. Audio is streamed directly from the selected instance through a hidden YouTube IFrame player. The IFrame API handles playback state and Octave reads from it to drive the UI.

All state management is synchronous and in-memory during a session. On actions that matter, state is flushed to `localStorage`. On load, state is read back. That is the entire data layer.

```
User Input
    |
    v
Octave (Client)
    |
    +-- Search    --> Invidious API (public instance pool)
    +-- Playback  --> YouTube IFrame API (embedded, hidden)
    +-- Lyrics    --> LRCLIB / Lyrics.ovh
    +-- Artist    --> TheAudioDB / Wikipedia REST API
    +-- Storage   --> Browser localStorage (device only)
```

No data ever touches a server controlled by this project.

---

## Deploy Your Own

Octave is a folder of static files. Any platform that can serve HTML will work.

### GitHub Pages

1. Fork this repository.
2. Go to Settings, then Pages.
3. Select your branch (main or master) and click Save.
4. Your app will be live at `https://yourusername.github.io/octave/` within a few minutes.

### Cloudflare Pages

1. Create a new project on [pages.cloudflare.com](https://pages.cloudflare.com).
2. Connect your GitHub repository.
3. Leave all build settings at their defaults. There is no build command and no output directory to configure.
4. Click Deploy. Done.

### Netlify

Same process as Cloudflare Pages. Connect the repo, leave build settings blank, deploy.

---

## Project Structure

```
octave/
    index.html          Main app shell
    contact.html        Support contact page
    terms.html          Terms and conditions
    css/
        style.css       Full design system and component styles
    js/
        player.js       Audio engine, state management, API layer
        app.js          UI routing, views, modals, event binding
    README.md
```

---

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International** license.

You may fork this repository, deploy it for yourself, and use it for personal or educational purposes. You may not sell it, monetize it, or distribute modified versions for commercial gain without explicit written permission from the author.

Full license text: [creativecommons.org/licenses/by-nc-nd/4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)

---

## Legal Notice

Octave does not host, store, cache, or distribute any copyrighted audio or media. It is a client-side interface that queries third-party public APIs. The developer holds no liability for the content served by those APIs, for any copyright disputes arising from personal deployment, or for interruptions caused by third-party services going offline.

By deploying or using this application, you accept full responsibility for ensuring your usage complies with the laws and platform terms of service in your jurisdiction.

This software is provided as-is, without warranty of any kind.

---

## Contact

For bug reports, feature requests, or general questions, reach out on Telegram: [@ucvezw](https://t.me/ucvezw)

---

`#MusicPlayer` `#SpotifyAlternative` `#OpenSource` `#WebAudio` `#SongPlayer` `#ClientSide` `#FrontendDevelopment` `#WebPlayer` `#MusicStreaming` `#NoBackend` `#Glassmorphism` `#APIIntegration`

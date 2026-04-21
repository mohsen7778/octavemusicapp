// ============================================================
// player.js — Octave IFrame Audio Engine
// Restored pure client-side YouTube IFrame for instant loading.
// 10-point tracking, Wikipedia fallback, and Liquid Shadows preserved.
// Use Brave Browser for background playback.
// ============================================================

window.escapeHTML = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

window.OCTAVE = {
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    liked: {},
    playlists: {},
    recentPlayed: [],
    recentSearches: [],
    playStats: {}, 
    activeTrackForOptions: null,
    dailyRecs: { timestamp: 0, tracks: [] },
    trendingData: { timestamp: 0, tracks: [] },
    artistCache: {},
    selectedFont: localStorage.getItem('octave_font') || 'Plus Jakarta Sans',
    sessionHistory: [], 
    trackStartTime: 0,
    isNextTrackManual: true, 
    activeTrackViewed: false
};

window.initTrackStats = (videoId) => {
    if (!window.OCTAVE.playStats[videoId]) {
        window.OCTAVE.playStats[videoId] = {
            plays: 0, skips: 0, completes: 0,
            manual: 0, activeViews: 0, lastPlayedTimeOfDay: ''
        };
    }
};

window.saveCache = () => {
    localStorage.setItem('octave_data', JSON.stringify({
        liked: window.OCTAVE.liked,
        playlists: window.OCTAVE.playlists,
        recentPlayed: window.OCTAVE.recentPlayed.slice(0, 30),
        recentSearches: window.OCTAVE.recentSearches.slice(0, 30),
        playStats: window.OCTAVE.playStats, 
        queue: window.OCTAVE.queue,
        currentIndex: window.OCTAVE.currentIndex,
        dailyRecs: window.OCTAVE.dailyRecs,
        trendingData: window.OCTAVE.trendingData,
        artistCache: window.OCTAVE.artistCache
    }));
};

function loadCache() {
    const data = localStorage.getItem('octave_data');
    if (data) {
        const parsed = JSON.parse(data);
        window.OCTAVE.liked = parsed.liked || {};
        window.OCTAVE.playlists = parsed.playlists || {};
        window.OCTAVE.recentPlayed = parsed.recentPlayed || [];
        window.OCTAVE.recentSearches = parsed.recentSearches || [];
        
        window.OCTAVE.playStats = parsed.playStats || {};
        Object.keys(window.OCTAVE.playStats).forEach(key => {
            if (typeof window.OCTAVE.playStats[key] === 'number') {
                window.OCTAVE.playStats[key] = { plays: window.OCTAVE.playStats[key], skips: 0, completes: 0, manual: 0, activeViews: 0, lastPlayedTimeOfDay: '' };
            }
        });

        window.OCTAVE.queue = parsed.queue || [];
        window.OCTAVE.currentIndex = parsed.currentIndex || -1;
        window.OCTAVE.dailyRecs = parsed.dailyRecs || { timestamp: 0, tracks: [] };
        window.OCTAVE.trendingData = parsed.trendingData || { timestamp: 0, tracks: [] };
        window.OCTAVE.artistCache = parsed.artistCache || {};
    }
}
loadCache();

window.exportVault = () => {
    const data = localStorage.getItem('octave_data') || "{}";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Octave_Data_Vault.json";
    a.click();
    URL.revokeObjectURL(url);
};

window.importVault = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (json.playlists || json.liked) {
                localStorage.setItem('octave_data', e.target.result);
                alert('Data Vault Restored! Reloading app.');
                location.reload();
            }
        } catch (err) {
            alert('Invalid Vault Backup File.');
        }
    };
    reader.readAsText(file);
};

window.INVIDIOUS = [
    'https://inv.nadeko.net',
    'https://invidious.privacyredirect.com',
    'https://invidious.nerdvpn.de',
    'https://iv.melmac.space',
    'https://invidious.io.lol',
    'https://invidious.lunar.icu'
];

fetch('https://api.invidious.io/instances.json?sort_by=health')
    .then(res => res.json())
    .then(data => {
        const healthy = data
            .filter(inst => inst[1].type === 'https' && inst[1].api === true)
            .map(inst => inst[1].uri);
        if (healthy.length > 0) window.INVIDIOUS = [...new Set([...healthy, ...window.INVIDIOUS])];
    })
    .catch(() => console.warn('Using fallback instances'));

window.invIdx = Math.floor(Math.random() * window.INVIDIOUS.length);

// ─── SILENT KEEPALIVE ENGINE ──────────────────────────────────────────────────
// Holds the browser audio session open via Web Audio API so the YouTube iframe
// continues playing in the background on Chrome Android / mobile browsers.
let _audioCtx = null;
let _silentNode = null;

function startSilentKeepAlive() {
    if (_silentNode) return; // already running
    try {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Rule: if the browser ever suspends this context, resume it immediately.
        // This keeps our audio session alive permanently — no retries, no fighting.
        _audioCtx.onstatechange = () => {
            if (_audioCtx && _audioCtx.state === 'suspended') {
                _audioCtx.resume();
            }
        };

        const buffer = _audioCtx.createBuffer(1, _audioCtx.sampleRate, _audioCtx.sampleRate);
        const source = _audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(_audioCtx.destination);
        source.start(0);
        _silentNode = source;
    } catch (e) {
        console.warn('Silent keepalive failed to start:', e);
    }
}

function stopSilentKeepAlive() {
    try {
        if (_audioCtx) _audioCtx.onstatechange = null;
        if (_silentNode) { _silentNode.stop(); _silentNode = null; }
        if (_audioCtx) { _audioCtx.close(); _audioCtx = null; }
    } catch (e) {}
}

// Web Audio Context must be resumed after a user gesture (browser policy).
// We hook into the first real play action to activate it.
function resumeAudioContext() {
    if (_audioCtx && _audioCtx.state === 'suspended') {
        _audioCtx.resume();
    }
}

// ─── IFRAME ENGINE ────────────────────────────────────────────────────────────
let YTP = null,
    ytReady = false,
    progressTimer = null,
    sleepTimerId = null;

const script = document.createElement('script');
script.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(script);

window.onYouTubeIframeAPIReady = () => {
    const container = document.createElement('div');
    container.id = 'yt-hidden-frame';
    container.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;right:0;opacity:0;pointer-events:none;';
    document.body.appendChild(container);

    YTP = new YT.Player('yt-hidden-frame', {
        height: '1',
        width: '1',
        playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
        events: {
            onReady: e => {
                ytReady = true;
                e.target.setVolume(100);
                // Restores last played track UI and audio cue on startup
                if (window.OCTAVE.currentIndex >= 0 && window.OCTAVE.queue.length > 0) {
                    const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
                    updatePlayerUI(track);
                    YTP.cueVideoById({ videoId: track.videoId });
                    updateMediaSession(track);
                }
            },
            onStateChange: onYTS
        }
    });
};

function onYTS(e) {
    if (e.data === YT.PlayerState.PLAYING) {
        window.OCTAVE.isPlaying = true;
        updatePlayIcons('fa-solid fa-pause');
        startProgressTracking();
        startSilentKeepAlive();   // 🔇 hold audio session open for background play
        resumeAudioContext();
        syncMediaSessionPosition();
    } else if (e.data === YT.PlayerState.PAUSED) {
        window.OCTAVE.isPlaying = false;
        updatePlayIcons('fa-solid fa-play');
        clearInterval(progressTimer);
        stopSilentKeepAlive();    // 🔇 release audio session when paused
    } else if (e.data === YT.PlayerState.ENDED) {
        window.OCTAVE.isPlaying = false;
        
        if (window.OCTAVE.currentIndex >= 0) {
            const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
            window.initTrackStats(track.videoId);
            window.OCTAVE.playStats[track.videoId].completes++;
            window.saveCache();
        }

        if (window.playNextLogic) window.playNextLogic();
    }
}

function updatePlayIcons(iconClass) {
    const mini = document.querySelector('.play-btn-mini i');
    const fp = document.querySelector('#fp-play i');
    if (mini) mini.className = iconClass;
    if (fp) fp.className = iconClass;
}

window.togglePlay = () => {
    if (!YTP || window.OCTAVE.currentIndex === -1) return;
    resumeAudioContext(); // ensure AudioContext is live on user gesture
    window.OCTAVE.isPlaying ? YTP.pauseVideo() : YTP.playVideo();
};

function startProgressTracking() {
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
        if (YTP && window.OCTAVE.isPlaying) {
            const current = YTP.getCurrentTime();
            const total = YTP.getDuration();
            if (total > 0) {
                const percent = (current / total) * 100;
                const miniProg = document.getElementById('mini-progress');
                const fpProg = document.getElementById('fp-progress-fill');
                const currTime = document.getElementById('fp-time-current');
                const totTime = document.getElementById('fp-time-total');
                if (miniProg) miniProg.style.width = `${percent}%`;
                if (fpProg) fpProg.style.width = `${percent}%`;
                if (currTime) currTime.textContent = formatTime(current);
                if (totTime) totTime.textContent = formatTime(total);
            }
        }
    }, 100);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.author,
        artwork: [
            { src: track.thumb, sizes: '96x96', type: 'image/jpeg' },
            { src: track.thumb, sizes: '128x128', type: 'image/jpeg' },
            { src: track.thumb, sizes: '192x192', type: 'image/jpeg' },
            { src: track.thumb, sizes: '256x256', type: 'image/jpeg' },
            { src: track.thumb, sizes: '384x384', type: 'image/jpeg' },
            { src: track.thumb, sizes: '512x512', type: 'image/jpeg' }
        ]
    });

    navigator.mediaSession.setActionHandler('play', () => { window.togglePlay(); });
    navigator.mediaSession.setActionHandler('pause', () => { window.togglePlay(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { document.getElementById('fp-next')?.click(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { window.playPrev(); });

    try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (YTP && typeof YTP.seekTo === 'function') {
                YTP.seekTo(details.seekTime, true);
                syncMediaSessionPosition();
            }
        });
    } catch (e) {}
}

function syncMediaSessionPosition() {
    if ('mediaSession' in navigator && YTP && typeof YTP.getDuration === 'function') {
        try {
            const duration = YTP.getDuration();
            const position = YTP.getCurrentTime();
            if (duration > 0) {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackRate: 1,
                    position: position
                });
            }
        } catch (e) {}
    }
}

window.playTrackByIndex = (index) => {
    if (index < 0 || index >= window.OCTAVE.queue.length) return;
    const track = window.OCTAVE.queue[index];
    
    const hour = new Date().getHours();
    let tod = 'night';
    if (hour >= 5 && hour < 12) tod = 'morning';
    else if (hour >= 12 && hour < 17) tod = 'afternoon';

    window.initTrackStats(track.videoId);
    window.OCTAVE.playStats[track.videoId].plays++;
    window.OCTAVE.playStats[track.videoId].lastPlayedTimeOfDay = tod;
    
    if (window.OCTAVE.isNextTrackManual) {
        window.OCTAVE.playStats[track.videoId].manual++;
    }

    window.OCTAVE.trackStartTime = Date.now();
    window.OCTAVE.activeTrackViewed = false;
    window.OCTAVE.currentIndex = index;

    if (!window.OCTAVE.sessionHistory.includes(track.videoId)) {
        window.OCTAVE.sessionHistory.push(track.videoId);
    }
    
    window.OCTAVE.recentPlayed = [track, ...window.OCTAVE.recentPlayed.filter(t => t.videoId !== track.videoId)];
    window.saveCache();

    updatePlayerUI(track);
    if (ytReady && YTP) YTP.loadVideoById({ videoId: track.videoId });
    updateMediaSession(track);
};

window.playTrack = (track) => {
    window.OCTAVE.isNextTrackManual = true; 
    window.OCTAVE.recentSearches = [track, ...window.OCTAVE.recentSearches.filter(t => t.videoId !== track.videoId)];
    const existIdx = window.OCTAVE.queue.findIndex(t => t.videoId === track.videoId);
    if (existIdx >= 0) {
        window.playTrackByIndex(existIdx);
    } else {
        window.OCTAVE.queue.push(track);
        window.playTrackByIndex(window.OCTAVE.queue.length - 1);
    }
};

window.playPrev = () => {
    if (YTP && YTP.getCurrentTime() > 3) {
        YTP.seekTo(0);
    } else if (window.OCTAVE.currentIndex > 0) {
        window.OCTAVE.isNextTrackManual = true;
        window.playTrackByIndex(window.OCTAVE.currentIndex - 1);
    }
};

window.playPlaylist = (plName) => {
    const pl = window.OCTAVE.playlists[plName];
    if (pl && pl.length > 0) {
        window.OCTAVE.isNextTrackManual = true;
        window.OCTAVE.queue = [...pl];
        window.playTrackByIndex(0);
    }
};

window.deletePlaylist = (plName) => {
    if (confirm(`Are you sure you want to permanently delete "${plName}"?`)) {
        delete window.OCTAVE.playlists[plName];
        window.saveCache();
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) activeNav.click();
    }
};

window.removeFromPlaylist = (plName, index) => {
    window.OCTAVE.playlists[plName].splice(index, 1);
    window.saveCache();
    if (window.renderPlaylistDetail) window.renderPlaylistDetail(plName);
};

window.removeFromLiked = (videoId) => {
    delete window.OCTAVE.liked[videoId];
    window.saveCache();
    if (window.renderLikedSongs) window.renderLikedSongs();
};

window.applyLiquidShadow = (imageSrc) => {
    if (!document.getElementById('liquid-keyframes')) {
        const style = document.createElement('style');
        style.id = 'liquid-keyframes';
        style.innerHTML = `
            @keyframes liquidFlow {
                0% { background-position: 0% 0%; }
                50% { background-position: 100% 100%; }
                100% { background-position: 0% 0%; }
            }
        `;
        document.head.appendChild(style);
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        try {
            const cx = Math.floor(img.width / 2);
            const cy = Math.floor(img.height / 2);
            const sampleSize = 5;
            const startX = Math.max(0, cx - 2);
            const startY = Math.max(0, cy - 2);
            const imageData = ctx.getImageData(startX, startY, sampleSize, sampleSize).data;
            
            let r = 0, g = 0, b = 0, count = 0;
            for(let i=0; i < imageData.length; i+=4) {
                if(imageData[i] > 10 || imageData[i+1] > 10 || imageData[i+2] > 10) {
                    r += imageData[i];
                    g += imageData[i+1];
                    b += imageData[i+2];
                    count++;
                }
            }
            
            if(count === 0) {
                r = imageData[0]; g = imageData[1]; b = imageData[2];
            } else {
                r = Math.floor(r/count); g = Math.floor(g/count); b = Math.floor(b/count);
            }

            const fpPlayer = document.getElementById('full-player');
            if (fpPlayer) {
                fpPlayer.style.background = `
                    radial-gradient(circle at 10% 20%, rgba(${r}, ${g}, ${b}, 0.8) 0%, transparent 40%),
                    radial-gradient(circle at 90% 80%, rgba(${r}, ${g}, ${b}, 0.7) 0%, transparent 40%),
                    radial-gradient(circle at 50% 50%, rgba(${r}, ${g}, ${b}, 0.6) 0%, transparent 50%),
                    var(--bg-deep)
                `;
                fpPlayer.style.backgroundSize = "200% 200%";
                fpPlayer.style.animation = "liquidFlow 15s ease-in-out infinite";
            }

            const fpArt = document.getElementById('fp-art');
            if (fpArt) {
                fpArt.style.boxShadow = `0 15px 30px rgba(0,0,0,0.5), 0 0 10px rgba(${r}, ${g}, ${b}, 1), 0 0 15px rgba(${r}, ${g}, ${b}, 0.8)`;
            }

            const mini = document.querySelector('.mini-player');
            if (mini) {
                mini.style.background = `radial-gradient(circle at 0% 50%, rgba(${r}, ${g}, ${b}, 0.3) 0%, transparent 70%), var(--glass-bg)`;
                mini.style.boxShadow = `0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(${r}, ${g}, ${b}, 0.3)`;
            }
        } catch (e) {
            console.error("Liquid Shadow Sampling Failed", e);
        }
    };
    img.src = imageSrc;
};

function updatePlayerUI(track) {
    const els = {
        mT: document.getElementById('mini-title-el'),
        mA: document.getElementById('mini-artist-el'),
        mArt: document.getElementById('mini-art-el'),
        fT: document.getElementById('fp-title'),
        fA: document.getElementById('fp-artist'),
        fArt: document.getElementById('fp-art'),
        mL: document.getElementById('mini-like-btn'),
        fL: document.getElementById('fp-like')
    };

    if (els.mT) els.mT.textContent = track.title;
    if (els.mA) els.mA.textContent = track.author;
    if (els.mArt) {
        els.mArt.style.backgroundImage = `url(${track.thumb})`;
        els.mArt.style.backgroundSize = 'cover';
    }
    if (els.fT) els.fT.textContent = track.title;
    if (els.fA) els.fA.innerHTML = `${window.escapeHTML(track.author)} <i class="fa-solid fa-chevron-right" style="font-size: 10px; margin-left: 4px;"></i>`;
    if (els.fArt) {
        els.fArt.src = track.thumb;
        els.fArt.style.display = 'block';
    }

    window.applyLiquidShadow(track.thumb);

    const isLiked = !!window.OCTAVE.liked[track.videoId];
    const likeHTML = isLiked ? '<i class="fa-solid fa-heart" style="color:var(--accent);"></i>' : '<i class="fa-regular fa-heart"></i>';
    if (els.mL) els.mL.innerHTML = likeHTML;
    if (els.fL) els.fL.innerHTML = likeHTML;

    if (document.getElementById('playlist-detail-list')) {
        const activeNav = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
        if (activeNav === 'home' || activeNav === 'library') window.renderHome();
    }
}

window.toggleLike = (track) => {
    if (window.OCTAVE.liked[track.videoId]) {
        delete window.OCTAVE.liked[track.videoId];
    } else {
        window.OCTAVE.liked[track.videoId] = track;
    }
    window.saveCache();
    updatePlayerUI(track);
    if (window.renderHome) window.renderHome();
};

function seekToPosition(e, containerElement) {
    if (!YTP || window.OCTAVE.currentIndex === -1 || !containerElement) return;
    const rect = containerElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const totalTime = YTP.getDuration();
    if (totalTime > 0) {
        YTP.seekTo(totalTime * percentage, true);
        const fpFill = document.getElementById('fp-progress-fill');
        const miniFill = document.getElementById('mini-progress');
        if (fpFill) fpFill.style.width = `${percentage * 100}%`;
        if (miniFill) miniFill.style.width = `${percentage * 100}%`;

        syncMediaSessionPosition();
    }
}

window.performSearch = async (query) => {
    for (let i = 0; i < window.INVIDIOUS.length; i++) {
        const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        try {
            const r = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,videoThumbnails,lengthSeconds`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!r.ok) continue;
            const d = await r.json();
            window.invIdx = (window.invIdx + i) % window.INVIDIOUS.length;
            return d.filter(item => item.lengthSeconds && item.lengthSeconds < 600).map(item => ({
                videoId: item.videoId,
                title: item.title,
                author: item.author,
                thumb: (item.videoThumbnails && item.videoThumbnails.length > 0) ? item.videoThumbnails[0].url : ''
            }));
        } catch (e) {
            continue;
        }
    }
    return [];
};

window.setSleepTimer = (minutes) => {
    if (sleepTimerId) clearTimeout(sleepTimerId);
    if (minutes === 0) {
        alert('Sleep timer cancelled.');
        document.getElementById('timer-modal')?.classList.remove('active');
        return;
    }
    alert(`Sleep timer set. Audio will pause in ${minutes} minutes.`);
    document.getElementById('timer-modal')?.classList.remove('active');
    sleepTimerId = setTimeout(() => {
        if (window.OCTAVE.isPlaying) window.togglePlay();
    }, minutes * 60000);
};

window.fetchLyrics = async (artist, title) => {
    const cleanTitle = title
        .replace(/[\(\[【].*?[\)\]】]/g, '')
        .replace(/(feat\.|ft\.|remix|official|video|music video|lyric|audio|live).*/gi, '')
        .replace(/["']/g, '')
        .trim();

    const cleanArtist = artist
        .replace(/ - Topic/gi, '')
        .replace(/VEVO/gi, '')
        .split(/,|&| ft\.| feat\.| x | with /i)[0]
        .trim();

    try {
        const query = `${cleanArtist} ${cleanTitle}`;
        const r1 = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
        if (r1.ok) {
            const data = await r1.json();
            if (data && data.length > 0) {
                const bestMatch = data.find(item =>
                    item.trackName.toLowerCase().includes(cleanTitle.toLowerCase())
                ) || data[0];

                const rawLyrics = bestMatch.syncedLyrics || bestMatch.plainLyrics || "";
                if (rawLyrics) {
                    const cleanLines = rawLyrics
                        .replace(/\[\d+:\d+\.\d+\]/g, '')
                        .split('\n')
                        .filter(l => l.trim() !== "");

                    let html = `<div style="padding: 20px 0 160px 0; font-family: '${window.OCTAVE.selectedFont}', sans-serif; display: flex; flex-direction: column; gap: 16px;">`;
                    cleanLines.forEach(line => {
                        html += `<div class="lyric-line">${window.escapeHTML(line)}</div>`;
                    });
                    html += '</div>';
                    return html;
                }
            }
        }
    } catch (e) {}
    return `<div style="text-align:center; padding: 40px; color: var(--text-secondary);">Lyrics not found for this track.</div>`;
};

window.fetchFullArtistProfile = async (artist) => {
    const cleanArtist = artist
        .replace(/ - Topic/gi, '')
        .replace(/VEVO/gi, '')
        .split(/,|&| ft\.| feat\.| x | with /i)[0]
        .trim();
    
    if (window.OCTAVE.artistCache && window.OCTAVE.artistCache[cleanArtist]) {
        if (window.OCTAVE.artistCache[cleanArtist].bio !== "Artist biography not available.") {
            return window.OCTAVE.artistCache[cleanArtist];
        } else {
            delete window.OCTAVE.artistCache[cleanArtist];
        }
    }

    let profile = {
        name: cleanArtist,
        bio: "Artist biography not available.",
        banner: "",
        tracks: []
    };

    try {
        const r1 = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(cleanArtist)}`);
        if (r1.ok) {
            const data = await r1.json();
            if (data.artists && data.artists[0]) {
                const art = data.artists[0];
                if (art.strBiographyEN) profile.bio = art.strBiographyEN.substring(0, 1000) + "...";
                if (art.strArtistFanart) profile.banner = art.strArtistFanart;
                else if (art.strArtistThumb) profile.banner = art.strArtistThumb;
            }
        }
    } catch (e) {}
    
    if (profile.bio === "Artist biography not available.") {
        try {
            const w1 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanArtist)}`);
            if (w1.ok) {
                const d1 = await w1.json();
                if (d1.extract && !d1.extract.includes("may refer to")) {
                    profile.bio = d1.extract;
                }
            }
            
            if (profile.bio === "Artist biography not available.") {
                const w2 = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(cleanArtist)}&origin=*`);
                if (w2.ok) {
                    const d2 = await w2.json();
                    const pages = d2.query.pages;
                    const pageId = Object.keys(pages)[0];
                    if (pageId !== "-1" && pages[pageId].extract && !pages[pageId].extract.includes("may refer to")) {
                        profile.bio = pages[pageId].extract;
                    }
                }
            }
        } catch (e) {}
    }

    for (let i = 0; i < window.INVIDIOUS.length; i++) {
        const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        try {
            const r3 = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(cleanArtist)}&type=video&sort_by=view_count&fields=videoId,title,author,videoThumbnails,lengthSeconds`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (r3.ok) {
                const d = await r3.json();
                if (d && d.length > 0) {
                    profile.tracks = d.filter(item => item.lengthSeconds && item.lengthSeconds < 600).slice(0, 10).map(item => ({
                        videoId: item.videoId,
                        title: item.title,
                        author: item.author,
                        thumb: (item.videoThumbnails && item.videoThumbnails.length > 0) ? item.videoThumbnails[0].url : ''
                    }));
                    window.invIdx = (window.invIdx + i) % window.INVIDIOUS.length;
                    break;
                }
            }
        } catch (e) {
            continue;
        }
    }
    
    if (!window.OCTAVE.artistCache) window.OCTAVE.artistCache = {};
    window.OCTAVE.artistCache[cleanArtist] = profile;
    window.saveCache();

    return profile;
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.mini-player')?.addEventListener('click', (e) => {
        const rect = document.querySelector('.mini-player').getBoundingClientRect();
        if (e.clientY - rect.top <= 10) {
            e.stopPropagation();
            seekToPosition(e, document.querySelector('.mini-player'));
        } else {
            if(window.OCTAVE.currentIndex >= 0 && !window.OCTAVE.activeTrackViewed) {
                const id = window.OCTAVE.queue[window.OCTAVE.currentIndex].videoId;
                window.initTrackStats(id);
                window.OCTAVE.playStats[id].activeViews++;
                window.OCTAVE.activeTrackViewed = true;
                window.saveCache();
            }
        }
    });

    document.querySelector('.play-btn-mini')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.togglePlay();
    });
    
    document.getElementById('fp-play')?.addEventListener('click', window.togglePlay);
    
    document.getElementById('fp-next')?.addEventListener('click', () => {
        if (window.OCTAVE.currentIndex >= 0) {
            const timeListened = Date.now() - window.OCTAVE.trackStartTime;
            if (timeListened < 15000) { 
                const id = window.OCTAVE.queue[window.OCTAVE.currentIndex].videoId;
                window.initTrackStats(id);
                window.OCTAVE.playStats[id].skips++;
                window.saveCache();
            }
        }
        window.OCTAVE.isNextTrackManual = true;
        if (window.playNextLogic) window.playNextLogic();
    });
    
    document.getElementById('fp-prev')?.addEventListener('click', window.playPrev);
    
    document.getElementById('mini-like-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.OCTAVE.currentIndex >= 0) window.toggleLike(window.OCTAVE.queue[window.OCTAVE.currentIndex]);
    });
    
    document.getElementById('fp-like')?.addEventListener('click', () => {
        if (window.OCTAVE.currentIndex >= 0) window.toggleLike(window.OCTAVE.queue[window.OCTAVE.currentIndex]);
    });
    
    document.getElementById('fp-progress-container')?.addEventListener('click', (e) => seekToPosition(e, document.getElementById('fp-progress-container')));
});

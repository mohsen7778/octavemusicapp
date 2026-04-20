window.OCTAVE = {
    queue: [], currentIndex: -1, isPlaying: false,
    liked: {}, playlists: {}, recentPlayed: [], recentSearches: [],
    playStats: {}, activeTrackForOptions: null
};

function saveCache() {
    localStorage.setItem('octave_data', JSON.stringify({
        liked: window.OCTAVE.liked, playlists: window.OCTAVE.playlists,
        recentPlayed: window.OCTAVE.recentPlayed.slice(0, 30),
        recentSearches: window.OCTAVE.recentSearches.slice(0, 30),
        playStats: window.OCTAVE.playStats, queue: window.OCTAVE.queue,
        currentIndex: window.OCTAVE.currentIndex
    }));
}

function loadCache() {
    const data = localStorage.getItem('octave_data');
    if (data) {
        const parsed = JSON.parse(data);
        window.OCTAVE.liked = parsed.liked || {};
        window.OCTAVE.playlists = parsed.playlists || {};
        window.OCTAVE.recentPlayed = parsed.recentPlayed || [];
        window.OCTAVE.recentSearches = parsed.recentSearches || [];
        window.OCTAVE.playStats = parsed.playStats || {};
        window.OCTAVE.queue = parsed.queue || [];
        window.OCTAVE.currentIndex = parsed.currentIndex || -1;
    }
}
loadCache();

window.exportVault = () => {
    const data = localStorage.getItem('octave_data') || "{}";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "Octave_Data_Vault.json"; a.click();
    URL.revokeObjectURL(url);
};

window.importVault = (event) => {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if(json.playlists || json.liked) {
                localStorage.setItem('octave_data', e.target.result);
                alert('Data Vault Restored! Reloading app.');
                location.reload();
            }
        } catch(err) { alert('Invalid Vault Backup File.'); }
    };
    reader.readAsText(file);
};

const INVIDIOUS = [
    'https://inv.nadeko.net', 'https://invidious.privacyredirect.com',
    'https://invidious.nerdvpn.de', 'https://iv.melmac.space', 'https://invidious.io.lol'
];
let invIdx = 0;
let YTP = null, ytReady = false, progressTimer = null, sleepTimerId = null;

const script = document.createElement('script');
script.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(script);

window.onYouTubeIframeAPIReady = () => {
    const container = document.createElement('div');
    container.id = 'yt-hidden-frame';
    container.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;right:0;opacity:0;pointer-events:none;';
    document.body.appendChild(container);

    YTP = new YT.Player('yt-hidden-frame', {
        height: '1', width: '1',
        playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
        events: {
            onReady: e => { 
                ytReady = true; e.target.setVolume(100);
                if (window.OCTAVE.currentIndex >= 0 && window.OCTAVE.queue.length > 0) {
                    updatePlayerUI(window.OCTAVE.queue[window.OCTAVE.currentIndex]);
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
    } else if (e.data === YT.PlayerState.PAUSED) {
        window.OCTAVE.isPlaying = false;
        updatePlayIcons('fa-solid fa-play');
        clearInterval(progressTimer);
    } else if (e.data === YT.PlayerState.ENDED) {
        window.OCTAVE.isPlaying = false;
        playNextLogic();
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
                if(miniProg) miniProg.style.width = `${percent}%`;
                if(fpProg) fpProg.style.width = `${percent}%`;
                if(currTime) currTime.textContent = formatTime(current);
                if(totTime) totTime.textContent = formatTime(total);
            }
        }
    }, 500);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

window.playTrackByIndex = (index) => {
    if (index < 0 || index >= window.OCTAVE.queue.length) return;
    window.OCTAVE.currentIndex = index;
    const track = window.OCTAVE.queue[index];
    
    window.OCTAVE.playStats[track.videoId] = (window.OCTAVE.playStats[track.videoId] || 0) + 1;
    window.OCTAVE.recentPlayed = [track, ...window.OCTAVE.recentPlayed.filter(t => t.videoId !== track.videoId)];
    saveCache();
    
    updatePlayerUI(track);
    if (ytReady && YTP) YTP.loadVideoById({ videoId: track.videoId });

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title, artist: track.author,
            artwork: [{ src: track.thumb, sizes: '512x512', type: 'image/jpeg' }]
        });
        navigator.mediaSession.setActionHandler('play', () => YTP.playVideo());
        navigator.mediaSession.setActionHandler('pause', () => YTP.pauseVideo());
        navigator.mediaSession.setActionHandler('nexttrack', playNextLogic);
        navigator.mediaSession.setActionHandler('previoustrack', window.playPrev);
    }
};

window.playTrack = (track) => {
    window.OCTAVE.recentSearches = [track, ...window.OCTAVE.recentSearches.filter(t => t.videoId !== track.videoId)];
    const existIdx = window.OCTAVE.queue.findIndex(t => t.videoId === track.videoId);
    if (existIdx >= 0) { window.playTrackByIndex(existIdx); } 
    else { window.OCTAVE.queue.push(track); window.playTrackByIndex(window.OCTAVE.queue.length - 1); }
};

window.playPrev = () => {
    if (YTP && YTP.getCurrentTime() > 3) { YTP.seekTo(0); } 
    else if (window.OCTAVE.currentIndex > 0) { window.playTrackByIndex(window.OCTAVE.currentIndex - 1); }
};

async function playNextLogic() {
    if (window.OCTAVE.currentIndex < window.OCTAVE.queue.length - 1) {
        window.playTrackByIndex(window.OCTAVE.currentIndex + 1);
    } else {
        const currentTrack = window.OCTAVE.queue[window.OCTAVE.currentIndex];
        if (!currentTrack) return;
        
        for (let i = 0; i < INVIDIOUS.length; i++) {
            const base = INVIDIOUS[(invIdx + i) % INVIDIOUS.length];
            try {
                const r = await fetch(`${base}/api/v1/videos/${currentTrack.videoId}?fields=recommendedVideos`, { signal: AbortSignal.timeout(5000) });
                if (r.ok) {
                    const d = await r.json();
                    if (d.recommendedVideos && d.recommendedVideos.length > 0) {
                        const rec = d.recommendedVideos[0];
                        const nextTrack = {
                            videoId: rec.videoId, title: rec.title, author: rec.author,
                            thumb: (rec.videoThumbnails && rec.videoThumbnails.length > 0) ? rec.videoThumbnails[0].url : ''
                        };
                        window.OCTAVE.queue.push(nextTrack);
                        window.playTrackByIndex(window.OCTAVE.queue.length - 1);
                        return;
                    }
                }
            } catch(e) { continue; }
        }
    }
}
window.playNext = playNextLogic;

window.playPlaylist = (plName) => {
    const pl = window.OCTAVE.playlists[plName];
    if (pl && pl.length > 0) { window.OCTAVE.queue = [...pl]; window.playTrackByIndex(0); }
};

window.smartShufflePlaylist = (plName) => {
    const pl = window.OCTAVE.playlists[plName];
    if (pl && pl.length > 0) {
        let sorted = [...pl].sort((a, b) => {
            const countA = window.OCTAVE.playStats[a.videoId] || 0;
            const countB = window.OCTAVE.playStats[b.videoId] || 0;
            if (countB !== countA) return countB - countA;
            return 0.5 - Math.random(); 
        });
        window.OCTAVE.queue = sorted; window.playTrackByIndex(0);
    }
};

window.removeFromPlaylist = (plName, index) => {
    window.OCTAVE.playlists[plName].splice(index, 1);
    saveCache();
    if(window.renderPlaylistDetail) window.renderPlaylistDetail(plName);
};

window.removeFromLiked = (videoId) => {
    delete window.OCTAVE.liked[videoId];
    saveCache();
    if(window.renderLikedSongs) window.renderLikedSongs();
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

    if(els.mT) els.mT.textContent = track.title;
    if(els.mA) els.mA.textContent = track.author;
    if(els.mArt) { els.mArt.style.backgroundImage = `url(${track.thumb})`; els.mArt.style.backgroundSize = 'cover'; }
    if(els.fT) els.fT.textContent = track.title;
    if(els.fA) els.fA.innerHTML = `${track.author} <i class="fa-solid fa-chevron-right" style="font-size: 10px; margin-left: 4px;"></i>`;
    if(els.fArt) { els.fArt.src = track.thumb; els.fArt.style.display = 'block'; }
    
    // Ambient Background Update
    const ambientBg = document.getElementById('fp-ambient-bg');
    if(ambientBg) ambientBg.style.backgroundImage = `url(${track.thumb})`;

    const isLiked = !!window.OCTAVE.liked[track.videoId];
    const likeHTML = isLiked ? '<i class="fa-solid fa-heart" style="color:var(--accent);"></i>' : '<i class="fa-regular fa-heart"></i>';
    if(els.mL) els.mL.innerHTML = likeHTML;
    if(els.fL) els.fL.innerHTML = likeHTML;
    
    if(document.getElementById('playlist-detail-list')) {
        const activeNav = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
        if (activeNav === 'home' || activeNav === 'library') window.renderHome(); 
    }
}

window.toggleLike = (track) => {
    if (window.OCTAVE.liked[track.videoId]) { delete window.OCTAVE.liked[track.videoId]; } 
    else { window.OCTAVE.liked[track.videoId] = track; }
    saveCache(); updatePlayerUI(track);
    if(window.renderHome) window.renderHome();
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
        if(fpFill) fpFill.style.width = `${percentage * 100}%`;
        if(miniFill) miniFill.style.width = `${percentage * 100}%`;
    }
}

window.performSearch = async (query) => {
    for (let i = 0; i < INVIDIOUS.length; i++) {
        const base = INVIDIOUS[(invIdx + i) % INVIDIOUS.length];
        try {
            const r = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,videoThumbnails`, { signal: AbortSignal.timeout(7000) });
            if (!r.ok) continue;
            const d = await r.json(); 
            invIdx = (invIdx + i) % INVIDIOUS.length;
            return d.map(item => ({
                videoId: item.videoId, title: item.title, author: item.author,
                thumb: (item.videoThumbnails && item.videoThumbnails.length > 0) ? item.videoThumbnails[0].url : ''
            }));
        } catch(e) { continue; }
    }
    return [];
};

window.setSleepTimer = (minutes) => {
    if(sleepTimerId) clearTimeout(sleepTimerId);
    if(minutes === 0) { 
        alert('Sleep timer cancelled.'); 
        document.getElementById('timer-modal')?.classList.remove('active');
        return; 
    }
    alert(`Sleep timer set. Audio will pause in ${minutes} minutes.`);
    document.getElementById('timer-modal')?.classList.remove('active');
    sleepTimerId = setTimeout(() => {
        if(window.OCTAVE.isPlaying) window.togglePlay();
    }, minutes * 60000);
};

window.fetchLyrics = async (artist, title) => {
    const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').split('-')[0].trim();
    const cleanArtist = artist.replace(/ - Topic/g, '').replace(/VEVO/i, '').trim();
    try {
        const query = `${cleanArtist} ${cleanTitle}`;
        const r1 = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
        if (r1.ok) {
            const data = await r1.json();
            if (data && data.length > 0 && data[0].plainLyrics) return data[0].plainLyrics;
        }
    } catch(e) { console.warn("LRCLIB fallback triggered"); }
    try {
        const r2 = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
        if (r2.ok) {
            const data = await r2.json();
            if (data.lyrics) return data.lyrics;
        }
    } catch(e) { console.warn("Lyrics.ovh fallback triggered"); }
    return "Lyrics not available in open-source databases.";
};

window.fetchArtistBio = async (artist) => {
    const cleanArtist = artist.replace(/ - Topic/g, '').replace(/VEVO/i, '').trim();
    try {
        const r1 = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(cleanArtist)}`);
        if (r1.ok) {
            const data = await r1.json();
            if (data.artists && data.artists[0].strBiographyEN) {
                let bio = data.artists[0].strBiographyEN;
                if(bio.length > 1000) bio = bio.substring(0, 1000) + "...";
                return bio;
            }
        }
    } catch(e) {}
    try {
        const r2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanArtist)}`);
        if (r2.ok) {
            const data = await r2.json();
            if (data.extract) return data.extract;
        }
    } catch(e) {}
    return "Artist biography not available in databases.";
};

// SAFETY WRAPPER: Attach all click listeners ONLY when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Basic Controls
    document.querySelector('.play-btn-mini')?.addEventListener('click', (e) => { e.stopPropagation(); window.togglePlay(); });
    document.getElementById('fp-play')?.addEventListener('click', window.togglePlay);
    document.getElementById('fp-next')?.addEventListener('click', playNextLogic);
    document.getElementById('fp-prev')?.addEventListener('click', window.playPrev);
    
    // Likes
    document.getElementById('mini-like-btn')?.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        if(window.OCTAVE.currentIndex >= 0) window.toggleLike(window.OCTAVE.queue[window.OCTAVE.currentIndex]); 
    });
    document.getElementById('fp-like')?.addEventListener('click', () => { 
        if(window.OCTAVE.currentIndex >= 0) window.toggleLike(window.OCTAVE.queue[window.OCTAVE.currentIndex]); 
    });

    // Seeking
    document.getElementById('fp-progress-container')?.addEventListener('click', (e) => seekToPosition(e, document.getElementById('fp-progress-container')));
    document.querySelector('.mini-player')?.addEventListener('click', (e) => {
        const rect = document.querySelector('.mini-player').getBoundingClientRect();
        if (e.clientY - rect.top <= 10) { e.stopPropagation(); seekToPosition(e, document.querySelector('.mini-player')); }
    });

    // --- NEW: BINDINGS FOR LYRICS, BIO, QUEUE, TIMER ---
    const fpPanel = document.getElementById('fp-overlay-panel');
    const fpContent = document.getElementById('fp-overlay-content');
    const fpTitle = document.getElementById('fp-overlay-title');
    
    document.getElementById('fp-lyrics-btn')?.addEventListener('click', async () => {
        if(window.OCTAVE.currentIndex < 0) return;
        fpTitle.innerText = 'Lyrics';
        fpContent.innerHTML = '<div style="text-align:center; margin-top: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--accent);"></i></div>';
        fpPanel.classList.add('active');
        const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
        const lyrics = await window.fetchLyrics(track.author, track.title);
        fpContent.innerHTML = `<div id="lyrics-content">${lyrics}</div>`;
    });

    document.getElementById('fp-artist')?.addEventListener('click', async () => {
        if(window.OCTAVE.currentIndex < 0) return;
        fpTitle.innerText = 'Artist Bio';
        fpContent.innerHTML = '<div style="text-align:center; margin-top: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--accent);"></i></div>';
        fpPanel.classList.add('active');
        const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
        const bio = await window.fetchArtistBio(track.author);
        fpContent.innerHTML = `<div style="color: var(--text-primary); font-size: 15px; line-height: 1.8;">${bio}</div>`;
    });

    document.getElementById('fp-queue-btn')?.addEventListener('click', () => {
        if(window.OCTAVE.currentIndex < 0) return;
        fpTitle.innerText = 'Up Next';
        fpContent.innerHTML = '';
        fpPanel.classList.add('active');
        const q = window.OCTAVE.queue;
        const curr = window.OCTAVE.currentIndex;
        for(let i = curr; i < q.length; i++) {
            const track = q[i];
            const isPlaying = i === curr;
            const el = document.createElement('div');
            el.style.cssText = `display: flex; align-items: center; gap: 14px; padding: 12px; background: ${isPlaying ? 'rgba(30,215,96,0.1)' : 'var(--bg-surface)'}; border-radius: 8px; margin-bottom: 12px; border: ${isPlaying ? '1px solid var(--accent)' : '1px solid transparent'};`;
            el.innerHTML = `<img src="${track.thumb}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;"><div style="flex: 1; min-width: 0;"><div style="font-size: 14px; font-weight: 600; color: ${isPlaying ? 'var(--accent)' : 'var(--text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.title}</div><div style="font-size: 12px; color: var(--text-secondary);">${track.author}</div></div>${isPlaying ? '<i class="fa-solid fa-volume-high" style="color: var(--accent);"></i>' : ''}`;
            fpContent.appendChild(el);
        }
    });

    document.getElementById('close-fp-overlay')?.addEventListener('click', () => fpPanel.classList.remove('active'));
    document.getElementById('opt-sleep-timer')?.addEventListener('click', () => {
        document.getElementById('track-options-modal')?.classList.remove('active');
        document.getElementById('timer-modal')?.classList.add('active');
    });
    document.getElementById('close-timer')?.addEventListener('click', () => document.getElementById('timer-modal')?.classList.remove('active'));
});

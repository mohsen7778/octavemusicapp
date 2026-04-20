window.OCTAVE = {
    queue: [], currentIndex: -1, isPlaying: false,
    liked: {}, playlists: {}, recentPlayed: [], recentSearches: [],
    playStats: {}, activeTrackForOptions: null
};

function saveCache() {
    try { localStorage.setItem('octave_data', JSON.stringify({ liked: window.OCTAVE.liked, playlists: window.OCTAVE.playlists, recentPlayed: window.OCTAVE.recentPlayed, recentSearches: window.OCTAVE.recentSearches, playStats: window.OCTAVE.playStats, queue: window.OCTAVE.queue, currentIndex: window.OCTAVE.currentIndex })); } catch(e){}
}

function loadCache() {
    try { const data = localStorage.getItem('octave_data'); if (data) { const parsed = JSON.parse(data); Object.assign(window.OCTAVE, parsed); } } catch(e) { localStorage.removeItem('octave_data'); }
}
loadCache();

window.exportVault = () => { const data = localStorage.getItem('octave_data') || "{}"; const blob = new Blob([data], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = "Octave_Data_Vault.json"; a.click(); URL.revokeObjectURL(url); };
window.importVault = (event) => { const file = event.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (e) => { try { localStorage.setItem('octave_data', e.target.result); location.reload(); } catch(err) { alert('Invalid File.'); } }; reader.readAsText(file); };

const INVIDIOUS = ['https://inv.nadeko.net', 'https://invidious.privacyredirect.com', 'https://invidious.nerdvpn.de', 'https://iv.melmac.space'];
let YTP = null, ytReady = false, progressTimer = null, sleepTimerId = null;

const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(script);

window.onYouTubeIframeAPIReady = () => {
    YTP = new YT.Player('yt-hidden-frame', { height: '1', width: '1', events: { onReady: e => { ytReady = true; if (window.OCTAVE.queue[window.OCTAVE.currentIndex]) updatePlayerUI(window.OCTAVE.queue[window.OCTAVE.currentIndex]); }, onStateChange: onYTS } });
};

function onYTS(e) {
    if (e.data === 1) { window.OCTAVE.isPlaying = true; updatePlayIcons('fa-solid fa-pause'); }
    else if (e.data === 2) { window.OCTAVE.isPlaying = false; updatePlayIcons('fa-solid fa-play'); }
    else if (e.data === 0) { playNextLogic(); }
}

function updatePlayIcons(iconClass) {
    document.querySelector('.play-btn-mini i')?.setAttribute('class', iconClass);
    document.querySelector('#fp-play i')?.setAttribute('class', iconClass);
}

window.togglePlay = () => { if (YTP) window.OCTAVE.isPlaying ? YTP.pauseVideo() : YTP.playVideo(); };

window.playTrackByIndex = (index) => {
    if (index < 0 || index >= window.OCTAVE.queue.length) return;
    window.OCTAVE.currentIndex = index;
    const track = window.OCTAVE.queue[index];
    window.OCTAVE.playStats[track.videoId] = (window.OCTAVE.playStats[track.videoId] || 0) + 1;
    saveCache();
    updatePlayerUI(track);
    if (ytReady && YTP) YTP.loadVideoById({ videoId: track.videoId });
};

window.playTrack = (track) => {
    const existIdx = window.OCTAVE.queue.findIndex(t => t.videoId === track.videoId);
    if (existIdx >= 0) window.playTrackByIndex(existIdx);
    else { window.OCTAVE.queue.push(track); window.playTrackByIndex(window.OCTAVE.queue.length - 1); }
};

window.playPrev = () => { if (YTP && YTP.getCurrentTime() > 3) YTP.seekTo(0); else if (window.OCTAVE.currentIndex > 0) window.playTrackByIndex(window.OCTAVE.currentIndex - 1); };

async function playNextLogic() {
    if (window.OCTAVE.currentIndex < window.OCTAVE.queue.length - 1) window.playTrackByIndex(window.OCTAVE.currentIndex + 1);
}
window.playNext = playNextLogic;

function updatePlayerUI(track) {
    const els = { mT: document.getElementById('mini-title-el'), mA: document.getElementById('mini-artist-el'), mArt: document.getElementById('mini-art-el'), fT: document.getElementById('fp-title'), fA: document.getElementById('fp-artist'), fArt: document.getElementById('fp-art'), mL: document.getElementById('mini-like-btn'), fL: document.getElementById('fp-like') };
    if(els.mT) els.mT.textContent = track.title;
    if(els.mA) els.mA.textContent = track.author;
    if(els.mArt) els.mArt.style.backgroundImage = `url(${track.thumb})`;
    if(els.fT) els.fT.textContent = track.title;
    if(els.fA) els.fA.innerHTML = `${track.author} <i class="fa-solid fa-chevron-right" style="font-size: 10px;"></i>`;
    if(els.fArt) els.fArt.src = track.thumb;
    document.getElementById('fp-ambient-bg') && (document.getElementById('fp-ambient-bg').style.backgroundImage = `url(${track.thumb})`);

    const isLiked = !!window.OCTAVE.liked[track.videoId];
    const likeHTML = isLiked ? '<i class="fa-solid fa-heart" style="color:var(--accent);"></i>' : '<i class="fa-regular fa-heart"></i>';
    if(els.mL) els.mL.innerHTML = likeHTML;
    if(els.fL) els.fL.innerHTML = likeHTML;
}

window.toggleLike = (track) => {
    if (window.OCTAVE.liked[track.videoId]) delete window.OCTAVE.liked[track.videoId];
    else window.OCTAVE.liked[track.videoId] = track;
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

window.setSleepTimer = (minutes) => {
    if(sleepTimerId) clearTimeout(sleepTimerId);
    if(minutes > 0) sleepTimerId = setTimeout(() => { if(window.OCTAVE.isPlaying) window.togglePlay(); }, minutes * 60000);
};

window.fetchLyrics = async (artist, title) => {
    const cleanTitle = title.replace(/\(.*?\)/g, '').split('-')[0].trim();
    const cleanArtist = artist.replace(/ - Topic/g, '').trim();
    try {
        const r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanArtist + ' ' + cleanTitle)}`);
        const data = await r.json();
        return (data && data[0]?.plainLyrics) ? data[0].plainLyrics : "Lyrics not found.";
    } catch(e) { return "Lyrics Error."; }
};

window.fetchArtistBio = async (artist) => {
    try {
        const r = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artist)}`);
        const data = await r.json();
        return (data.artists && data.artists[0].strBiographyEN) ? data.artists[0].strBiographyEN.substring(0, 500) + "..." : "No bio found.";
    } catch(e) { return "Bio Error."; }
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.play-btn-mini')?.addEventListener('click', (e) => { e.stopPropagation(); window.togglePlay(); });
    document.getElementById('fp-play')?.addEventListener('click', window.togglePlay);
    document.getElementById('fp-next')?.addEventListener('click', playNextLogic);
    document.getElementById('fp-prev')?.addEventListener('click', window.playPrev);
    document.getElementById('mini-like-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if(window.OCTAVE.currentIndex >= 0) window.toggleLike(window.OCTAVE.queue[window.OCTAVE.currentIndex]); });
    document.getElementById('fp-like')?.addEventListener('click', () => { if(window.OCTAVE.currentIndex >= 0) window.toggleLike(window.OCTAVE.queue[window.OCTAVE.currentIndex]); });
    document.getElementById('fp-progress-container')?.addEventListener('click', (e) => seekToPosition(e, document.getElementById('fp-progress-container')));
    
    // Bind Overlays
    document.getElementById('fp-lyrics-btn')?.addEventListener('click', async () => {
        const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
        document.getElementById('fp-overlay-title').innerText = 'Lyrics';
        document.getElementById('fp-overlay-panel').classList.add('active');
        document.getElementById('fp-overlay-content').innerText = await window.fetchLyrics(track.author, track.title);
    });
    document.getElementById('fp-artist')?.addEventListener('click', async () => {
        const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
        document.getElementById('fp-overlay-title').innerText = 'Artist Bio';
        document.getElementById('fp-overlay-panel').classList.add('active');
        document.getElementById('fp-overlay-content').innerText = await window.fetchArtistBio(track.author);
    });
});

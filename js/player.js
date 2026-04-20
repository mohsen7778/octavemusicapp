const INVIDIOUS = [
    'https://inv.nadeko.net',
    'https://invidious.privacyredirect.com',
    'https://invidious.nerdvpn.de',
    'https://iv.melmac.space',
    'https://invidious.io.lol',
    'https://yt.cdaut.de'
];
let invIdx = 0;

const S = { queue: [], currentIndex: -1, isPlaying: false, volume: 100 };
let YTP = null, ytReady = false, progressTimer = null;

// Inject YouTube iFrame API
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
            onReady: e => { ytReady = true; e.target.setVolume(S.volume); },
            onStateChange: onYTS
        }
    });
};

function onYTS(e) {
    const miniIcon = document.querySelector('.play-btn-mini i');
    const fullIcon = document.querySelector('#fp-play i');
    
    if (e.data === YT.PlayerState.PLAYING) {
        S.isPlaying = true;
        if(miniIcon) miniIcon.className = 'fa-solid fa-pause';
        if(fullIcon) fullIcon.className = 'fa-solid fa-pause';
        startProgressTracking();
    } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
        S.isPlaying = false;
        if(miniIcon) miniIcon.className = 'fa-solid fa-play';
        if(fullIcon) fullIcon.className = 'fa-solid fa-play';
        clearInterval(progressTimer);
    }
}

// Playback Controls
function togglePlay() {
    if (!YTP || S.currentIndex === -1) return;
    S.isPlaying ? YTP.pauseVideo() : YTP.playVideo();
}

document.querySelector('.play-btn-mini').addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents opening the full player when just pausing
    togglePlay();
});
document.getElementById('fp-play').addEventListener('click', togglePlay);

// Open/Close Full Player
document.querySelector('.mini-inner').addEventListener('click', () => {
    document.getElementById('full-player').classList.add('active');
});
document.getElementById('close-fp').addEventListener('click', () => {
    document.getElementById('full-player').classList.remove('active');
});

// Sync Progress Bars
function startProgressTracking() {
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
        if (YTP && S.isPlaying) {
            const current = YTP.getCurrentTime();
            const total = YTP.getDuration();
            if (total > 0) {
                const percent = (current / total) * 100;
                document.getElementById('mini-progress').style.width = `${percent}%`;
                document.getElementById('fp-progress-fill').style.width = `${percent}%`;
                document.getElementById('fp-time-current').textContent = formatTime(current);
                document.getElementById('fp-time-total').textContent = formatTime(total);
            }
        }
    }, 500);
}

function formatTime(seconds) {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Load Track Logic & Background Media Session
window.playTrack = (track) => {
    S.queue.push(track);
    S.currentIndex = S.queue.length - 1;
    
    // Update Mini UI
    document.querySelector('.mini-title').textContent = track.title;
    document.querySelector('.mini-artist').textContent = track.author;
    document.querySelector('.mini-art').style.backgroundImage = `url(${track.thumb})`;
    document.querySelector('.mini-art').style.backgroundSize = 'cover';
    
    // Update Full Player UI
    document.getElementById('fp-title').textContent = track.title;
    document.getElementById('fp-artist').textContent = track.author;
    const fpArt = document.getElementById('fp-art');
    fpArt.src = track.thumb;
    fpArt.style.display = 'block';
    
    // Load Engine
    if (ytReady && YTP) YTP.loadVideoById({ videoId: track.videoId });

    // Enable Lock Screen / Background Play
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.author,
            album: 'Octave',
            artwork: [{ src: track.thumb, sizes: '512x512', type: 'image/jpeg' }]
        });
        navigator.mediaSession.setActionHandler('play', () => YTP.playVideo());
        navigator.mediaSession.setActionHandler('pause', () => YTP.pauseVideo());
    }
};

// Search API
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

// ============================================================
// app.js — Octave Main UI & AI Engine
// ============================================================

// NEW: Global variable to intercept the PWA install prompt
let deferredInstallPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredInstallPrompt = e;
    
    // Only show the custom modal if they haven't dismissed it before
    if (!localStorage.getItem('installPromptDismissed')) {
        // Wait 3 seconds so we don't bombard them exactly when the app opens
        setTimeout(() => {
            const installModal = document.getElementById('install-modal');
            if (installModal) installModal.classList.add('active');
        }, 3000);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    
    // --- SHARED TRACK BOOT SEQUENCE ---
    const params = new URLSearchParams(window.location.search);
    const shareV = params.get('v');
    if (shareV) {
        const shareT = params.get('t') || 'Shared Track';
        const shareA = params.get('a') || 'Unknown Artist';
        const shareTh = params.get('th') || '';
        
        const sharedTrack = { videoId: shareV, title: shareT, author: shareA, thumb: shareTh };
        window.OCTAVE.queue = [sharedTrack];
        window.OCTAVE.currentIndex = 0;
        window.saveCache();
        
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setTimeout(() => {
            if(window.playTrackByIndex) {
                window.playTrackByIndex(0);
                document.getElementById('full-player').classList.add('active');
            }
        }, 1000);
    }

    // --- PWA INSTALL BUTTON BINDINGS ---
    document.getElementById('close-install')?.addEventListener('click', () => {
        document.getElementById('install-modal').classList.remove('active');
        localStorage.setItem('installPromptDismissed', 'true');
    });

    document.getElementById('confirm-install')?.addEventListener('click', async () => {
        document.getElementById('install-modal').classList.remove('active');
        localStorage.setItem('installPromptDismissed', 'true'); 
        
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
        }
    });

    // --- SPLASH SCREEN FADE ---
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            splash.style.visibility = 'hidden';
            setTimeout(() => splash.remove(), 600);
        }
    }, 2000);

    const dynamicView = document.getElementById('dynamic-view');
    const views = {
        home: dynamicView.innerHTML,
        search: `
            <header class="search-header" style="padding: 40px 20px 20px 20px; background: var(--bg-deep);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h1 class="search-title" style="font-size: 24px; font-weight: 700; margin: 0;">Search</h1>
                    <button class="icon-btn" id="open-yt-import" style="display: flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: -0.5px; color: var(--text-primary);">
                        Add <i class="fa-brands fa-youtube" style="color: #ff0000; font-size: 24px; margin-left: 2px;"></i> YouTube Playlist
                    </button>
                </div>
                <div class="search-input-wrap" style="position: relative;">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                    <input type="text" id="searchInput" placeholder="Search tracks..." autocomplete="off" style="width: 100%; background: var(--bg-surface); border: 1px solid var(--glass-border); padding: 14px 14px 14px 44px; border-radius: 8px; color: var(--text-primary); font-size: 14px; outline: none;">
                </div>
            </header>
            <div id="searchResults" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                <div id="search-default-view">
                    <h3 style="font-size: 16px; margin-bottom: 16px;">Recently Searched</h3>
                    <div class="vertical-list" id="search-recent-list" style="padding-right: 0;"></div>
                </div>
            </div>
            <div class="bottom-spacer"></div>
        `,
        library: `
            <header class="search-header" style="padding: 40px 20px 20px 20px; display: flex; justify-content: space-between; align-items: center;">
                <h1 class="search-title" style="font-size: 24px; font-weight: 700;">Library</h1>
                <button class="icon-btn" id="open-yt-import" style="display: flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: -0.5px; color: var(--text-primary);">
                    Add <i class="fa-brands fa-youtube" style="color: #ff0000; font-size: 24px; margin-left: 2px;"></i> YouTube Playlist
                </button>
            </header>
            <div id="lib-playlists" class="vertical-list" style="padding: 20px;"></div>
            <div class="bottom-spacer"></div>
        `,
        premium: `
            <div style="padding: 80px 20px; text-align: center;">
                <img src="logo.png" style="width: 80px; height: 80px; border-radius: 16px; margin-bottom: 24px;" onerror="this.style.display='none'">
                <h2 style="font-size: 24px; margin-bottom: 12px;">Octave Premium</h2>
                <p style="color: var(--text-secondary); font-size: 14px;">Ad-free background listening activated.</p>
            </div>
        `
    };

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelector('.nav-item.active').classList.remove('active');
            item.classList.add('active');
            const tab = item.getAttribute('data-tab');

            if (tab === 'home') {
                dynamicView.innerHTML = views.home;
                window.renderHome();
                bindHomeModals();
            } else {
                dynamicView.innerHTML = views[tab];
                if (tab === 'search') bindSearch();
                if (tab === 'library') renderLibrary();
            }
        });
    });

    handleBravePrompt();
    bindHomeModals();
    window.renderHome();

    // AI Mix Trigger
    document.getElementById('open-ai-mix')?.addEventListener('click', () => {
        document.getElementById('ai-mix-modal').classList.add('active');
    });

    document.querySelector('.mini-inner').addEventListener('click', () => document.getElementById('full-player').classList.add('active'));
    document.getElementById('close-fp').addEventListener('click', () => document.getElementById('full-player').classList.remove('active'));
    document.getElementById('close-track-options').addEventListener('click', () => document.getElementById('track-options-modal').classList.remove('active'));
    document.getElementById('close-select-playlist').addEventListener('click', () => document.getElementById('select-playlist-modal').classList.remove('active'));
    document.getElementById('close-yt-import').addEventListener('click', () => document.getElementById('yt-import-modal').classList.remove('active'));
    document.getElementById('close-ai-mix').addEventListener('click', () => document.getElementById('ai-mix-modal').classList.remove('active'));

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
});

// --- AI MIX ENGINE ---
async function generateAiMix() {
    const promptInput = document.getElementById('ai-prompt').value.trim();
    const lang = document.getElementById('ai-lang').value;
    const today = new Date().toDateString();
    
    if (!promptInput) return;

    // 1. 3-Gen Daily Limit Check
    let history = JSON.parse(localStorage.getItem('octave_ai_limit') || '{"date":"","count":0}');
    if (history.date === today && history.count >= 3) {
        alert("Daily AI limit (3/3) reached. Try again tomorrow!");
        return;
    }

    // 2. Visual Loading State
    const btn = document.getElementById('generate-ai-mix');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Brewing...';
    btn.disabled = true;

    try {
        // 3. Hidden Melodic/Quality Prompt
        const systemPrompt = `Recommend exactly 20 melodious and high-quality songs based on the vibe: "${promptInput}". 
        Language: ${lang}. Focus on tracks that sound pleasant to the ears with great melody.
        Format strictly: 'Song Title - Artist'. No numbering, no extra text.`;
        
        const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(systemPrompt)}`);
        const text = await response.text();

        // 4. Parse AI output
        const lines = text.split('\n').filter(l => l.includes(' - ')).slice(0, 20);
        if (lines.length === 0) throw new Error("No tracks found.");

        const playableTracks = [];
        for (const line of lines) {
            const [title, artist] = line.split(' - ');
            // We use performSearch from player.js to get real videoIds
            const searchResults = await window.performSearch(`${title} ${artist}`);
            if (searchResults.length > 0) {
                playableTracks.push(searchResults[0]);
            }
        }

        // 5. Save as a playlist with the current date
        const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const finalPlaylistName = `AI: ${promptInput.substring(0, 12)} (${dateStr})`;
        
        window.OCTAVE.playlists[finalPlaylistName] = playableTracks;
        window.saveCache();

        // 6. Update limit count
        if (history.date !== today) {
            history = { date: today, count: 1 };
        } else {
            history.count++;
        }
        localStorage.setItem('octave_ai_limit', JSON.stringify(history));

        document.getElementById('ai-mix-modal').classList.remove('active');
        document.getElementById('ai-prompt').value = '';
        window.renderHome();
        alert(`Successfully generated "${finalPlaylistName}" with ${playableTracks.length} tracks!`);

    } catch (e) {
        alert("AI Connection failed. Check your internet.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

document.getElementById('generate-ai-mix')?.addEventListener('click', generateAiMix);

// --- SHARED UI LOGIC ---
window.openTrackOptions = (track) => {
    window.OCTAVE.activeTrackForOptions = track;
    const infoDiv = document.getElementById('opt-track-info');
    if (infoDiv) {
        infoDiv.innerHTML = `
            <img src="${track.thumb}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${window.escapeHTML(track.title)}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${window.escapeHTML(track.author)}</div>
            </div>
        `;
    }
    document.getElementById('track-options-modal').classList.add('active');
};

document.body.addEventListener('click', async (e) => {
    if (e.target.closest('#menu-btn')) {
        document.getElementById('side-menu').classList.add('active');
        document.getElementById('menu-backdrop').classList.add('active');
    }
    if (e.target.closest('#close-menu') || e.target.closest('#menu-backdrop')) {
        document.getElementById('side-menu').classList.remove('active');
        document.getElementById('menu-backdrop').classList.remove('active');
    }
    if (e.target.closest('#open-yt-import')) {
        document.getElementById('yt-import-modal').classList.add('active');
    }

    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) {
        document.getElementById('side-menu').classList.remove('active');
        document.getElementById('menu-backdrop').classList.remove('active');
        const url = pageBtn.getAttribute('data-page');
        const dynamicView = document.getElementById('dynamic-view');
        dynamicView.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--accent);"></i></div>';
        try {
            const r = await fetch(url);
            const html = await r.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            dynamicView.innerHTML = doc.querySelector('.mobile-app').innerHTML;
        } catch (err) {
            dynamicView.innerHTML = '<div class="empty-state-text">Failed to load.</div>';
        }
    }
});

document.getElementById('export-vault-btn').addEventListener('click', () => {
    document.getElementById('side-menu').classList.remove('active');
    document.getElementById('menu-backdrop').classList.remove('active');
    window.exportVault();
});
document.getElementById('import-vault-btn').addEventListener('click', () => {
    document.getElementById('import-vault-input').click();
});
document.getElementById('import-vault-input').addEventListener('change', window.importVault);

// --- CORE RENDERERS ---
window.renderPlaylistDetail = (plName) => {
    const dynamicView = document.getElementById('dynamic-view');
    const tracks = window.OCTAVE.playlists[plName] || [];
    let html = `
        <div style="padding: 20px;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; margin-top: 10px;">
                <button class="icon-btn" onclick="document.querySelector('.nav-item.active').click()"><i class="fa-solid fa-arrow-left"></i></button>
                <h1 style="font-size: 24px; font-weight: 700; margin: 0;">${window.escapeHTML(plName)}</h1>
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                <button class="btn-primary" style="flex: 1;" onclick="window.playPlaylist('${window.escapeHTML(plName)}')"><i class="fa-solid fa-play"></i> Play</button>
                <button class="btn-secondary" style="flex: 1;" onclick="if(window.smartShufflePlaylist) window.smartShufflePlaylist('${window.escapeHTML(plName)}')"><i class="fa-solid fa-shuffle"></i> Shuffle</button>
                <button class="icon-btn" style="color: #ff4444; width: 44px; background: var(--bg-surface); border-radius: 12px;" onclick="window.deletePlaylist('${window.escapeHTML(plName)}')"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="vertical-list">
    `;
    if (tracks.length === 0) {
        html += `<div class="empty-state-text">Playlist is empty.</div>`;
    } else {
        tracks.forEach((track, idx) => {
            html += `
                <div class="list-item" style="position: relative;">
                    <img src="${track.thumb}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;" onclick="window.OCTAVE.queue = [...window.OCTAVE.playlists['${window.escapeHTML(plName)}']]; window.playTrackByIndex(${idx});">
                    <div class="list-info" style="cursor: pointer;" onclick="window.OCTAVE.queue = [...window.OCTAVE.playlists['${window.escapeHTML(plName)}']]; window.playTrackByIndex(${idx});">
                        <div class="list-title">${window.escapeHTML(track.title)}</div>
                        <div class="list-subtitle">${window.escapeHTML(track.author)}</div>
                    </div>
                    <button class="icon-btn" style="color: var(--text-secondary); position: absolute; right: 0; padding: 10px;" onclick="window.removeFromPlaylist('${window.escapeHTML(plName)}', ${idx})"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        });
    }
    html += `</div></div><div class="bottom-spacer"></div>`;
    dynamicView.innerHTML = html;
};

window.renderLikedSongs = () => {
    const dynamicView = document.getElementById('dynamic-view');
    const tracks = Object.values(window.OCTAVE.liked);
    let html = `
        <div style="padding: 20px;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; margin-top: 10px;">
                <button class="icon-btn" onclick="document.querySelector('.nav-item.active').click()"><i class="fa-solid fa-arrow-left"></i></button>
                <h1 style="font-size: 24px; font-weight: 700; margin: 0;">Liked Songs</h1>
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                <button class="btn-primary" style="flex: 1;" onclick="window.OCTAVE.queue = Object.values(window.OCTAVE.liked); window.playTrackByIndex(0);"><i class="fa-solid fa-play"></i> Play</button>
            </div>
            <div class="vertical-list">
    `;
    if (tracks.length === 0) {
        html += `<div class="empty-state-text">No liked songs yet.</div>`;
    } else {
        tracks.forEach((track, idx) => {
            html += `
                <div class="list-item" style="position: relative;">
                    <img src="${track.thumb}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;" onclick="window.OCTAVE.queue = Object.values(window.OCTAVE.liked); window.playTrackByIndex(${idx});">
                    <div class="list-info" style="cursor: pointer;" onclick="window.OCTAVE.queue = Object.values(window.OCTAVE.liked); window.playTrackByIndex(${idx});">
                        <div class="list-title">${window.escapeHTML(track.title)}</div>
                        <div class="list-subtitle">${window.escapeHTML(track.author)}</div>
                    </div>
                    <button class="icon-btn" style="color: var(--accent); position: absolute; right: 0; padding: 10px;" onclick="window.removeFromLiked('${track.videoId}')"><i class="fa-solid fa-heart"></i></button>
                </div>
            `;
        });
    }
    html += `</div></div><div class="bottom-spacer"></div>`;
    dynamicView.innerHTML = html;
};

window.renderHome = () => {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    if (document.getElementById('time-greeting')) document.getElementById('time-greeting').textContent = greeting;

    const recentGrid = document.getElementById('home-recent-grid');
    const playlistsDiv = document.getElementById('home-playlists');
    if (!recentGrid || !playlistsDiv) return;

    if (window.OCTAVE.recentPlayed.length > 0) {
        recentGrid.innerHTML = '';
        window.OCTAVE.recentPlayed.slice(0,10).forEach(track => {
            const el = document.createElement('div');
            el.className = 'square-card';
            el.innerHTML = `<div class="card-art shadow-heavy" style="background-image: url('${track.thumb}'); background-size: cover;"></div><div class="card-title">${window.escapeHTML(track.title)}</div>`;
            el.addEventListener('click', () => window.playTrack(track));
            recentGrid.appendChild(el);
        });
    }

    if (window.fetchTrendingMusic) window.fetchTrendingMusic();

    const likedCount = Object.keys(window.OCTAVE.liked).length;
    playlistsDiv.innerHTML = `
        <div class="list-item" id="open-liked-songs" style="cursor: pointer;">
            <div class="list-art shadow-heavy" style="background: linear-gradient(135deg, var(--accent), #0b5c26); display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff;">
                <i class="fa-solid fa-heart"></i>
            </div>
            <div class="list-info">
                <div class="list-title">Liked Songs</div>
                <div class="list-subtitle">${likedCount} tracks saved</div>
            </div>
        </div>
    `;
    
    document.getElementById('open-liked-songs')?.addEventListener('click', window.renderLikedSongs);

    Object.keys(window.OCTAVE.playlists).reverse().forEach(plName => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.style.cursor = 'pointer';
        el.innerHTML = `
            <div class="list-art shadow-heavy" style="background: #2a2d36; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-list"></i>
            </div>
            <div class="list-info">
                <div class="list-title">${window.escapeHTML(plName)}</div>
                <div class="list-subtitle">${window.OCTAVE.playlists[plName].length} tracks</div>
            </div>
        `;
        el.addEventListener('click', () => window.renderPlaylistDetail(plName));
        playlistsDiv.appendChild(el);
    });
};

function renderLibrary() {
    const lib = document.getElementById('lib-playlists');
    if (!lib) return;
    lib.innerHTML = Object.keys(window.OCTAVE.playlists).length > 0 ? '' : '<div class="empty-state-text">Create or import a playlist.</div>';
    Object.keys(window.OCTAVE.playlists).forEach(plName => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.style.cursor = 'pointer';
        el.innerHTML = `
            <div class="list-art shadow-heavy" style="background: #2a2d36; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-list"></i>
            </div>
            <div class="list-info">
                <div class="list-title">${window.escapeHTML(plName)}</div>
                <div class="list-subtitle">${window.OCTAVE.playlists[plName].length} tracks</div>
            </div>
        `;
        el.addEventListener('click', () => window.renderPlaylistDetail(plName));
        lib.appendChild(el);
    });
}

function bindSearch() {
    const input = document.getElementById('searchInput');
    const resContainer = document.getElementById('searchResults');
    let timer;
    input.addEventListener('input', (e) => {
        clearTimeout(timer);
        const query = e.target.value.trim();
        if (!query) {
            document.getElementById('search-default-view').style.display = 'block';
            return;
        }
        document.getElementById('search-default-view').style.display = 'none';
        timer = setTimeout(async () => {
            const results = await window.performSearch(query);
            resContainer.innerHTML = '';
            results.slice(0, 15).forEach(track => {
                const el = document.createElement('div');
                el.className = 'list-item';
                el.innerHTML = `<img src="${track.thumb}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;"><div class="list-info"><div class="list-title">${window.escapeHTML(track.title)}</div><div class="list-subtitle">${window.escapeHTML(track.author)}</div></div>`;
                el.addEventListener('click', () => window.playTrack(track));
                resContainer.appendChild(el);
            });
        }, 500);
    });
}

function handleBravePrompt() {
    if (!localStorage.getItem('bravePromptShown')) setTimeout(() => document.getElementById('brave-modal')?.classList.add('active'), 1500);
    const dismissBrave = () => {
        localStorage.setItem('bravePromptShown', 'true');
        document.getElementById('brave-modal')?.classList.remove('active');
    };
    document.getElementById('close-brave')?.addEventListener('click', dismissBrave);
    document.getElementById('get-brave')?.addEventListener('click', dismissBrave);
}

function bindHomeModals() {
    document.getElementById('open-create-playlist')?.addEventListener('click', () => document.getElementById('playlist-modal').classList.add('active'));
    document.getElementById('close-playlist')?.addEventListener('click', () => document.getElementById('playlist-modal').classList.remove('active'));

    document.getElementById('save-playlist')?.addEventListener('click', () => {
        const name = document.getElementById('playlist-name').value.trim();
        if (name !== '' && !window.OCTAVE.playlists[name]) {
            window.OCTAVE.playlists[name] = [];
            window.saveCache();
            document.getElementById('playlist-name').value = '';
            document.getElementById('playlist-modal').classList.remove('active');
            window.renderHome();
        }
    });
}

document.getElementById('start-yt-import')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('yt-playlist-url').value.trim();
    if (!urlInput) return;
    const btn = document.getElementById('start-yt-import');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    // ... YouTube Import Logic remains as shared in your previous versions ...
    btn.innerHTML = 'Import';
    btn.disabled = false;
});

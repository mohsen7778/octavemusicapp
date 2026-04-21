document.addEventListener('DOMContentLoaded', () => {
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
                <h1 class="search-title" style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">Search</h1>
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
            <header class="search-header" style="padding: 40px 20px 20px 20px;"><h1 class="search-title" style="font-size: 24px; font-weight: 700;">Library</h1></header>
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
    
    document.querySelector('.mini-inner').addEventListener('click', () => document.getElementById('full-player').classList.add('active'));
    document.getElementById('close-fp').addEventListener('click', () => document.getElementById('full-player').classList.remove('active'));
    document.getElementById('close-track-options').addEventListener('click', () => document.getElementById('track-options-modal').classList.remove('active'));
    document.getElementById('close-select-playlist').addEventListener('click', () => document.getElementById('select-playlist-modal').classList.remove('active'));
});

document.body.addEventListener('click', async (e) => {
    if (e.target.closest('#menu-btn')) {
        document.getElementById('side-menu').classList.add('active');
        document.getElementById('menu-backdrop').classList.add('active');
    }
    if (e.target.closest('#close-menu') || e.target.closest('#menu-backdrop')) {
        document.getElementById('side-menu').classList.remove('active');
        document.getElementById('menu-backdrop').classList.remove('active');
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
            const backBtn = dynamicView.querySelector('a[href="index.html"]');
            if (backBtn) {
                backBtn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    document.querySelector('.nav-item[data-tab="home"]').click();
                });
            }
        } catch(err) { dynamicView.innerHTML = '<div class="empty-state-text">Failed to load page.</div>'; }
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

const fpPanel = document.getElementById('fp-overlay-panel');
const fpContent = document.getElementById('fp-overlay-content');
const fpTitle = document.getElementById('fp-overlay-title');

document.getElementById('close-fp-overlay').addEventListener('click', () => fpPanel.classList.remove('active'));

// --- THIS FIXES THE [object Object] LYRICS BUG ---
document.getElementById('fp-lyrics-btn').addEventListener('click', async () => {
    if(window.OCTAVE.currentIndex < 0) return;
    fpTitle.innerText = 'Lyrics';
    fpContent.innerHTML = '<div style="text-align:center; margin-top: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--accent);"></i></div>';
    fpPanel.classList.add('active');
    
    const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
    const result = await window.fetchLyrics(track.author, track.title);
    
    if (result.isSynced) {
        fpContent.innerHTML = `<div id="lyrics-content">${result.html}</div>`;
    } else {
        fpContent.innerHTML = `<div id="lyrics-content" style="white-space: pre-wrap; text-align: center; color: var(--text-primary); font-size: 15px; line-height: 1.8;">${result.html}</div>`;
    }
});

document.getElementById('fp-artist').addEventListener('click', async () => {
    if(window.OCTAVE.currentIndex < 0) return;
    fpTitle.innerText = 'Artist Bio';
    fpContent.innerHTML = '<div style="text-align:center; margin-top: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--accent);"></i></div>';
    fpPanel.classList.add('active');
    
    const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
    const bio = await window.fetchArtistBio(track.author);
    fpContent.innerHTML = `<div style="color: var(--text-primary); font-size: 15px; line-height: 1.8;">${window.escapeHTML(bio)}</div>`;
});

document.getElementById('fp-queue-btn').addEventListener('click', () => {
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
        el.innerHTML = `
            <img src="${track.thumb}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 14px; font-weight: 600; color: ${isPlaying ? 'var(--accent)' : 'var(--text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${window.escapeHTML(track.title)}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${window.escapeHTML(track.author)}</div>
            </div>
            ${isPlaying ? '<i class="fa-solid fa-volume-high" style="color: var(--accent);"></i>' : ''}
        `;
        fpContent.appendChild(el);
    }
});

document.getElementById('opt-sleep-timer').addEventListener('click', () => {
    document.getElementById('track-options-modal').classList.remove('active');
    document.getElementById('timer-modal').classList.add('active');
});
document.getElementById('close-timer').addEventListener('click', () => document.getElementById('timer-modal').classList.remove('active'));

const fpOptionsBtn = document.getElementById('fp-options');
if (fpOptionsBtn) {
    fpOptionsBtn.addEventListener('click', () => {
        if (window.OCTAVE && window.OCTAVE.currentIndex >= 0) {
            openTrackOptions(window.OCTAVE.queue[window.OCTAVE.currentIndex]);
        }
    });
}

window.renderHome = () => {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    const greetingEl = document.getElementById('time-greeting');
    if (greetingEl) greetingEl.textContent = greeting;

    const recentGrid = document.getElementById('home-recent-grid');
    const playlistsDiv = document.getElementById('home-playlists');
    if (!recentGrid || !playlistsDiv) return;

    if (window.OCTAVE.recentPlayed.length > 0) {
        recentGrid.innerHTML = '';
        window.OCTAVE.recentPlayed.forEach(track => {
            const el = document.createElement('div');
            el.className = 'square-card';
            el.innerHTML = `<div class="card-art shadow-heavy" style="background-image: url('${track.thumb}'); background-size: cover;"></div><div class="card-title">${window.escapeHTML(track.title)}</div>`;
            el.addEventListener('click', () => window.playTrack(track));
            recentGrid.appendChild(el);
        });
    }

    const recsGrid = document.getElementById('home-recs-grid');
    const recsSection = document.getElementById('recommended-section');
    if (recsGrid && recsSection) {
        if (window.OCTAVE.dailyRecs && window.OCTAVE.dailyRecs.tracks.length > 0) {
            recsGrid.innerHTML = '';
            window.OCTAVE.dailyRecs.tracks.forEach(track => {
                const el = document.createElement('div');
                el.className = 'square-card';
                el.innerHTML = `<div class="card-art shadow-heavy" style="background-image: url('${track.thumb}'); background-size: cover;"></div><div class="card-title">${window.escapeHTML(track.title)}</div>`;
                el.addEventListener('click', () => window.playTrack(track));
                recsGrid.appendChild(el);
            });
        }
    }
    
    if (window.fetchDailyRecommendations) window.fetchDailyRecommendations();

    const likedCount = Object.keys(window.OCTAVE.liked).length;
    playlistsDiv.innerHTML = `
        <div class="list-item" id="open-discover-mix" style="margin-bottom: 8px;">
            <div class="list-art shadow-heavy" style="background: linear-gradient(135deg, #8a2387, #e94057, #f27121); display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff;"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div class="list-info"><div class="list-title">Auto-DJ Discover Mix</div><div class="list-subtitle">Endless tracks based on your taste</div></div>
        </div>
        <div class="list-item" id="open-liked-songs">
            <div class="list-art shadow-heavy" style="background: linear-gradient(135deg, var(--accent), #0b5c26); display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff;"><i class="fa-solid fa-heart"></i></div>
            <div class="list-info"><div class="list-title">Liked Songs</div><div class="list-subtitle">${likedCount} tracks saved</div></div>
        </div>
    `;
    document.getElementById('open-discover-mix').addEventListener('click', () => { if(window.generateDiscoverMix) window.generateDiscoverMix(); });
    document.getElementById('open-liked-songs').addEventListener('click', window.renderLikedSongs);
    
    Object.keys(window.OCTAVE.playlists).forEach(plName => {
        const pl = window.OCTAVE.playlists[plName];
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `<div class="list-art shadow-heavy" style="background: #2a2d36; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--text-secondary);"><i class="fa-solid fa-list"></i></div><div class="list-info"><div class="list-title">${window.escapeHTML(plName)}</div><div class="list-subtitle">${pl.length} tracks</div></div><button class="icon-btn" style="color: var(--text-secondary);"><i class="fa-solid fa-chevron-right"></i></button>`;
        el.addEventListener('click', () => window.renderPlaylistDetail(plName));
        playlistsDiv.appendChild(el);
    });
};

function renderLibrary() {
    const lib = document.getElementById('lib-playlists');
    if(!lib) return;
    lib.innerHTML = Object.keys(window.OCTAVE.playlists).length > 0 ? '' : '<div class="empty-state-text">Create a playlist from the Home tab.</div>';
    
    Object.keys(window.OCTAVE.playlists).forEach(plName => {
        const pl = window.OCTAVE.playlists[plName];
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `<div class="list-art shadow-heavy" style="background: #2a2d36; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--text-secondary);"><i class="fa-solid fa-list"></i></div><div class="list-info"><div class="list-title">${window.escapeHTML(plName)}</div><div class="list-subtitle">${pl.length} tracks</div></div><i class="fa-solid fa-chevron-right" style="color: var(--text-secondary);"></i>`;
        el.addEventListener('click', () => window.renderPlaylistDetail(plName));
        lib.appendChild(el);
    });
}

window.renderPlaylistDetail = (plName) => {
    const pl = window.OCTAVE.playlists[plName];
    if (!pl) return;
    const dynamicView = document.getElementById('dynamic-view');
    let totalPlays = pl.reduce((sum, track) => sum + (window.OCTAVE.playStats[track.videoId] || 0), 0);

    dynamicView.innerHTML = `
        <div style="padding: 40px 20px 30px; background: linear-gradient(180deg, rgba(30,215,96,0.1) 0%, var(--bg-deep) 100%);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <button class="icon-btn" onclick="document.querySelector('.nav-item.active').click()"><i class="fa-solid fa-arrow-left"></i></button>
                    <h1 style="font-size: 28px; font-weight: 800;">${window.escapeHTML(plName)}</h1>
                </div>
                <button class="icon-btn" onclick="window.deletePlaylist('${plName}')" style="color: #ff4444; font-size: 20px;"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px;">${pl.length} tracks • ${totalPlays} lifetime plays</div>
            <div style="display: flex; gap: 12px;">
                <button class="btn-primary" onclick="window.playPlaylist('${plName}')" style="flex: 1; padding: 14px; border-radius: 100px; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fa-solid fa-play"></i> Play All</button>
                <button class="btn-secondary" onclick="if(window.smartShufflePlaylist) window.smartShufflePlaylist('${plName}')" style="flex: 1; padding: 14px; border-radius: 100px; display: flex; align-items: center; justify-content: center; gap: 8px; border-color: var(--accent); color: var(--accent);"><i class="fa-solid fa-wand-magic-sparkles"></i> Smart Shuffle</button>
            </div>
        </div>
        <div class="vertical-list" id="playlist-detail-list" style="padding: 0 20px;"></div>
        <div class="bottom-spacer"></div>
    `;
    const listContainer = document.getElementById('playlist-detail-list');
    if (pl.length === 0) listContainer.innerHTML = '<div class="empty-state-text">This playlist is empty. Add songs via Search.</div>';
    else {
        pl.forEach((track, index) => {
            const stats = window.OCTAVE.playStats[track.videoId] || 0;
            const el = document.createElement('div');
            el.style.cssText = 'display: flex; align-items: center; gap: 14px; padding: 12px; background: var(--bg-surface); border-radius: 8px; margin-bottom: 12px; cursor: pointer;';
            el.innerHTML = `<img src="${track.thumb}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;"><div style="flex: 1; min-width: 0;"><div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${window.escapeHTML(track.title)}</div><div style="font-size: 12px; color: var(--text-secondary);">${window.escapeHTML(track.author)} • <i class="fa-solid fa-fire" style="color: #ff5000; font-size: 10px;"></i> ${stats} plays</div></div><button class="icon-btn remove-btn" style="color: #ff4444; padding: 10px; z-index: 10;"><i class="fa-solid fa-xmark"></i></button>`;
            
            el.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-btn');
                if (removeBtn) { 
                    e.stopPropagation();
                    window.removeFromPlaylist(plName, index); 
                    return; 
                }
                window.OCTAVE.queue = [...pl]; window.playTrackByIndex(index);
            });
            listContainer.appendChild(el);
        });
    }
};

window.renderLikedSongs = () => {
    const pl = Object.values(window.OCTAVE.liked);
    const dynamicView = document.getElementById('dynamic-view');
    let totalPlays = pl.reduce((sum, track) => sum + (window.OCTAVE.playStats[track.videoId] || 0), 0);

    dynamicView.innerHTML = `
        <div style="padding: 40px 20px 30px; background: linear-gradient(180deg, rgba(30,215,96,0.15) 0%, var(--bg-deep) 100%);">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;"><button class="icon-btn" onclick="document.querySelector('.nav-item.active').click()"><i class="fa-solid fa-arrow-left"></i></button><h1 style="font-size: 28px; font-weight: 800;">Liked Songs</h1></div>
            <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px;">${pl.length} tracks • ${totalPlays} lifetime plays</div>
            <div style="display: flex; gap: 12px;"><button class="btn-primary" onclick="window.OCTAVE.queue = Object.values(window.OCTAVE.liked); if(window.OCTAVE.queue.length>0) window.playTrackByIndex(0);" style="flex: 1; padding: 14px; border-radius: 100px; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fa-solid fa-play"></i> Play All</button></div>
        </div>
        <div class="vertical-list" id="playlist-detail-list" style="padding: 0 20px;"></div>
        <div class="bottom-spacer"></div>
    `;
    const listContainer = document.getElementById('playlist-detail-list');
    if (pl.length === 0) listContainer.innerHTML = '<div class="empty-state-text">No liked songs yet. Tap the heart on any track.</div>';
    else {
        pl.forEach((track, index) => {
            const stats = window.OCTAVE.playStats[track.videoId] || 0;
            const el = document.createElement('div');
            el.style.cssText = 'display: flex; align-items: center; gap: 14px; padding: 12px; background: var(--bg-surface); border-radius: 8px; margin-bottom: 12px; cursor: pointer;';
            el.innerHTML = `<img src="${track.thumb}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;"><div style="flex: 1; min-width: 0;"><div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${window.escapeHTML(track.title)}</div><div style="font-size: 12px; color: var(--text-secondary);">${window.escapeHTML(track.author)} • <i class="fa-solid fa-fire" style="color: #ff5000; font-size: 10px;"></i> ${stats} plays</div></div><button class="icon-btn remove-btn" style="color: var(--accent); padding: 10px; z-index: 10;"><i class="fa-solid fa-heart"></i></button>`;
            
            el.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-btn');
                if (removeBtn) { 
                    e.stopPropagation();
                    window.removeFromLiked(track.videoId); 
                    return; 
                }
                window.OCTAVE.queue = [...pl]; window.playTrackByIndex(index);
            });
            listContainer.appendChild(el);
        });
    }
};

function bindSearch() {
    const input = document.getElementById('searchInput');
    const resContainer = document.getElementById('searchResults');
    const recentList = document.getElementById('search-recent-list');
    if(recentList) {
        if(window.OCTAVE.recentSearches.length === 0) recentList.innerHTML = '<div class="empty-state-text">No recent searches.</div>';
        else { recentList.innerHTML = ''; window.OCTAVE.recentSearches.forEach(track => recentList.appendChild(buildTrackItem(track))); }
    }
    let timer;
    input.addEventListener('input', (e) => {
        clearTimeout(timer);
        const query = e.target.value.trim();
        if (!query) {
            document.getElementById('search-default-view').style.display = 'block';
            Array.from(resContainer.children).forEach(c => { if(c.id !== 'search-default-view') c.remove(); });
            return;
        }
        document.getElementById('search-default-view').style.display = 'none';
        Array.from(resContainer.children).forEach(c => { if(c.id !== 'search-default-view') c.remove(); });
        
        const loader = document.createElement('div');
        loader.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--accent);"></i></div>';
        resContainer.appendChild(loader);

        timer = setTimeout(async () => {
            const results = await window.performSearch(query);
            loader.remove();
            if (results.length === 0) {
                const empty = document.createElement('div'); empty.className = 'empty-state-text'; empty.innerText = 'No results found.';
                resContainer.appendChild(empty);
                return;
            }
            results.slice(0, 15).forEach(track => resContainer.appendChild(buildTrackItem(track)));
        }, 500);
    });
}

function buildTrackItem(track) {
    const el = document.createElement('div');
    el.style.cssText = 'display: flex; align-items: center; gap: 14px; padding: 12px; background: var(--bg-surface); border-radius: 8px; margin-bottom: 12px; cursor: pointer;';
    el.innerHTML = `<img src="${track.thumb}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;"><div style="flex: 1; min-width: 0;"><div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${window.escapeHTML(track.title)}</div><div style="font-size: 12px; color: var(--text-secondary);">${window.escapeHTML(track.author)}</div></div><button class="track-opts-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>`;
    el.addEventListener('click', (e) => { if(e.target.closest('.track-opts-btn')) return; window.playTrack(track); });
    el.querySelector('.track-opts-btn').addEventListener('click', (e) => { e.stopPropagation(); openTrackOptions(track); });
    return el;
}

function handleBravePrompt() {
    if (!localStorage.getItem('bravePromptShown')) setTimeout(() => document.getElementById('brave-modal').classList.add('active'), 1500);
    const dismissBrave = () => { localStorage.setItem('bravePromptShown', 'true'); document.getElementById('brave-modal').classList.remove('active'); };
    document.getElementById('close-brave').addEventListener('click', dismissBrave);
    document.getElementById('get-brave').addEventListener('click', dismissBrave);
}

function bindHomeModals() {
    const openPl = document.getElementById('open-create-playlist');
    const plModal = document.getElementById('playlist-modal');
    if(openPl) openPl.addEventListener('click', () => plModal.classList.add('active'));
    document.getElementById('close-playlist').addEventListener('click', () => plModal.classList.remove('active'));
    document.getElementById('save-playlist').addEventListener('click', () => {
        const name = document.getElementById('playlist-name').value.trim();
        if(name !== '' && !window.OCTAVE.playlists[name]) {
            window.OCTAVE.playlists[name] =[];
            localStorage.setItem('octave_data', JSON.stringify({ ...JSON.parse(localStorage.getItem('octave_data')||'{}'), playlists: window.OCTAVE.playlists }));
            document.getElementById('playlist-name').value = '';
            plModal.classList.remove('active');
            window.renderHome();
        }
    });
}

function openTrackOptions(track) {
    window.OCTAVE.activeTrackForOptions = track;
    const modal = document.getElementById('track-options-modal');
    document.getElementById('opt-track-info').innerHTML = `<img src="${track.thumb}" style="width: 40px; height: 40px; border-radius: 6px;"><div style="font-size: 14px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden;">${window.escapeHTML(track.title)}</div>`;
    const isLiked = !!window.OCTAVE.liked[track.videoId];
    document.getElementById('opt-like-track').innerHTML = isLiked ? '<i class="fa-solid fa-heart" style="color:var(--accent);"></i> <span>Unlike Track</span>' : '<i class="fa-regular fa-heart"></i> <span>Like Track</span>';
    modal.classList.add('active');
}

document.getElementById('opt-like-track').addEventListener('click', () => {
    if(window.OCTAVE.activeTrackForOptions) { window.toggleLike(window.OCTAVE.activeTrackForOptions); document.getElementById('track-options-modal').classList.remove('active'); }
});

document.getElementById('opt-add-playlist').addEventListener('click', () => {
    document.getElementById('track-options-modal').classList.remove('active');
    const plModal = document.getElementById('select-playlist-modal');
    const list = document.getElementById('playlist-selection-list');
    if (Object.keys(window.OCTAVE.playlists).length === 0) {
        list.innerHTML = '<div class="empty-state-text">No playlists created yet. Go to Home to create one.</div>';
    } else {
        list.innerHTML = '';
        Object.keys(window.OCTAVE.playlists).forEach(plName => {
            const el = document.createElement('div'); el.className = 'drawer-item'; el.innerHTML = `<i class="fa-solid fa-list"></i> <span>${window.escapeHTML(plName)}</span>`;
            el.addEventListener('click', () => {
                window.OCTAVE.playlists[plName].push(window.OCTAVE.activeTrackForOptions);
                localStorage.setItem('octave_data', JSON.stringify({ ...JSON.parse(localStorage.getItem('octave_data')||'{}'), playlists: window.OCTAVE.playlists }));
                plModal.classList.remove('active');
                if(window.renderPlaylistDetail && document.querySelector('h1').textContent === plName) window.renderPlaylistDetail(plName);
            });
            list.appendChild(el);
        });
    }
    plModal.classList.add('active');
});

// ============================================================
// app.js — Octave Full Flagship Engine (UNSTRIPPED + AI TASTE MATCHING FIXED)
// ============================================================

// --- PWA INSTALL LOGIC ---
let deferredInstallPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    
    if (!localStorage.getItem('installPromptDismissed')) {
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
        window.OCTAVE.queue =[sharedTrack];
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
            console.log(`User response to the install prompt: ${outcome}`);
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
            } else {
                dynamicView.innerHTML = views[tab];
                if (tab === 'search') {
                    bindSearch();
                    renderRecentSearches(); 
                }
                if (tab === 'library') renderLibrary();
            }
        });
    });

    handleBravePrompt();
    window.renderHome();

    // --- STATIC MODAL BUTTON BINDINGS (Bound only once!) ---
    document.getElementById('close-playlist')?.addEventListener('click', () => document.getElementById('playlist-modal').classList.remove('active'));
    document.getElementById('save-playlist')?.addEventListener('click', () => {
        const name = document.getElementById('playlist-name').value.trim();
        if (name !== '' && !window.OCTAVE.playlists[name]) {
            window.OCTAVE.playlists[name] =[];
            window.saveCache();
            document.getElementById('playlist-name').value = '';
            document.getElementById('playlist-modal').classList.remove('active');
            window.renderHome();
        }
    });

    document.querySelector('.mini-inner').addEventListener('click', () => document.getElementById('full-player').classList.add('active'));
    document.getElementById('close-fp').addEventListener('click', () => document.getElementById('full-player').classList.remove('active'));
    document.getElementById('close-track-options').addEventListener('click', () => document.getElementById('track-options-modal').classList.remove('active'));
    document.getElementById('close-select-playlist').addEventListener('click', () => document.getElementById('select-playlist-modal').classList.remove('active'));
    
    document.getElementById('close-yt-import').addEventListener('click', () => document.getElementById('yt-import-modal').classList.remove('active'));
    document.getElementById('close-ai-mix')?.addEventListener('click', () => document.getElementById('ai-mix-modal').classList.remove('active'));

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});

// --- GLOBAL EVENT DELEGATION ---
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
    if (e.target.closest('#open-create-playlist')) {
        document.getElementById('playlist-modal').classList.add('active');
    }
    
    if (e.target.closest('#open-ai-mix') || e.target.closest('#open-ai-mix-large')) {
        document.getElementById('ai-mix-modal').classList.add('active');
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
        } catch (err) {
            dynamicView.innerHTML = '<div class="empty-state-text">Failed to load.</div>';
        }
    }
});


// --- AI MIX ENGINE (WITH STRICT FIREWALL & MUSIC ENFORCEMENT) ---
async function generateAiMix() {
    const promptInput = document.getElementById('ai-prompt').value.trim();
    const lang = document.getElementById('ai-lang').value;
    if (!promptInput) return;

    const btn = document.getElementById('generate-ai-mix');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Brewing...';
    btn.disabled = true;

    try {
        let tasteContext = "";
        if (window.OCTAVE && typeof window.calculateTrackScore === 'function') {
            const allKnown =[...Object.values(window.OCTAVE.liked || {}), ...(window.OCTAVE.recentPlayed || [])];
            const uniqueTracks = Array.from(new Map(allKnown.map(t => [t.videoId, t])).values());
            const topScored = uniqueTracks.sort((a, b) => window.calculateTrackScore(b) - window.calculateTrackScore(a)).slice(0, 5);
            
            if (topScored.length > 0) {
                // Strip all special chars, limit length, prevent HTML injection from weird history
                const cleanNames = topScored.map(t => `${t.title.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30)} by ${t.author.replace(/[^a-zA-Z0-9 ]/g, '')}`).join(", ");
                tasteContext = `\nContext: The user recently played: [${cleanNames}]. If these are actual songs, use them to gauge their taste. IF THEY ARE TUTORIALS, NEWS, PODCASTS, OR YOUTUBE VIDEOS, COMPLETELY IGNORE THEM.\n`;
            }
        }

        // Extremely strict firewall prompt
        const systemPrompt = `You are an elite music curator API. 
Task: Recommend exactly 15 highly melodic MUSIC TRACKS based on the vibe: "${promptInput}". 
Language: ${lang}. ${tasteContext}

CRITICAL RULES:
1. Output strictly in this format: Song Title - Artist Name
2. Recommend ONLY actual music tracks (songs). NEVER recommend tutorials, news, podcasts, HTML coding, or conversational videos.
3. Do NOT include numbers, quotes, bullet points, HTML tags, or any other text.`;
        
        const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(systemPrompt)}`);
        const text = await response.text();

        // Firewall the parsing: Strip HTML tags, weird characters, and ignore obviously non-music lines
        const lines = text.split('\n')
            .map(l => l.replace(/^[\d\.\)\-*]+\s*/, '').replace(/["'*_<>]/g, '').trim()) 
            .filter(l => l.match(/[-–—]/) && l.length < 80 && !l.toLowerCase().includes('tutorial') && !l.toLowerCase().includes('html'));

        if (lines.length === 0) throw new Error("Format invalid. Please try a different prompt.");

        const playableTracks =[];
        
        for (const line of lines.slice(0, 15)) {
            const parts = line.split(/[-–—]/);
            if(parts.length < 2) continue;
            
            const title = parts[0].trim();
            const artist = parts[1].trim();
            if(!title || !artist) continue;

            // Forced "song audio" appended to search to guarantee we don't fetch vlogs
            const results = await window.performSearch(`${title} ${artist} song audio`);
            if (results && results.length > 0) {
                playableTracks.push(results[0]);
            }
        }

        if (playableTracks.length === 0) throw new Error("Tracks not found. Try a different vibe.");

        const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const finalName = `AI Mix: ${promptInput.substring(0, 10)} [${dateStr}]`;
        
        window.OCTAVE.playlists[finalName] = playableTracks;
        window.saveCache();

        document.getElementById('ai-mix-modal').classList.remove('active');
        document.getElementById('ai-prompt').value = '';
        
        const activeNav = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
        if(activeNav === 'home') window.renderHome();
        
        alert(`Successfully generated "${finalName}" with ${playableTracks.length} tracks!`);

    } catch (e) {
        alert("AI Error: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
document.getElementById('generate-ai-mix')?.addEventListener('click', generateAiMix);

// --- RESTORED CORE FUNCTIONS ---
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

document.getElementById('export-vault-btn').addEventListener('click', () => {
    document.getElementById('side-menu').classList.remove('active');
    document.getElementById('menu-backdrop').classList.remove('active');
    window.exportVault();
});
document.getElementById('import-vault-btn').addEventListener('click', () => {
    document.getElementById('import-vault-input').click();
});
document.getElementById('import-vault-input').addEventListener('change', window.importVault);

// --- LYRICS & FONTS ---
const fpPanel = document.getElementById('fp-overlay-panel');
const fpContent = document.getElementById('fp-overlay-content');
const fpTitle = document.getElementById('fp-overlay-title');
document.getElementById('close-fp-overlay').addEventListener('click', () => fpPanel.classList.remove('active'));

document.getElementById('fp-lyrics-btn').addEventListener('click', async () => {
    if (window.OCTAVE.currentIndex < 0) return;
    fpTitle.innerText = 'Lyrics';
    fpContent.innerHTML = '<div style="text-align:center; margin-top: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--accent);"></i></div>';
    fpPanel.classList.add('active');

    const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
    const html = await window.fetchLyrics(track.author, track.title);

    const fonts =[
        { name: 'Modern', css: 'Plus Jakarta Sans' },
        { name: 'Clean', css: 'Inter' },
        { name: 'Classic', css: 'Lora' },
        { name: 'Elegant', css: 'Playfair Display' },
        { name: 'Bold', css: 'Montserrat' },
        { name: 'Heavy', css: 'Kanit' },
        { name: 'Typewriter', css: 'Roboto Mono' },
        { name: 'Cursive', css: 'Dancing Script' },
        { name: 'Sharp', css: 'Oswald' },
        { name: 'Impact', css: 'Bebas Neue' }
    ];

    let fontHeader = `<div class="lyrics-font-selector scroll-x">`;
    fonts.forEach(f => {
        const activeClass = window.OCTAVE.selectedFont === f.css ? 'active' : '';
        fontHeader += `<div class="font-option ${activeClass}" style="font-family: '${f.css}', sans-serif;" onclick="window.setLyricsFont('${f.css}', this)">${f.name}</div>`;
    });
    fontHeader += `</div>`;

    fpContent.innerHTML = fontHeader + `<div id="lyrics-content">${html}</div>`;
});

document.getElementById('fp-share-btn')?.addEventListener('click', () => {
    if (window.OCTAVE.currentIndex >= 0) {
        const track = window.OCTAVE.queue[window.OCTAVE.currentIndex];
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('v', track.videoId);
        url.searchParams.set('t', track.title);
        url.searchParams.set('a', track.author);
        url.searchParams.set('th', track.thumb);
        
        navigator.clipboard.writeText(url.toString()).then(() => {
            alert("Track link copied to clipboard!");
        }).catch(() => {
            alert("Failed to copy link.");
        });
    }
});

window.setLyricsFont = (fontCss, el) => {
    window.OCTAVE.selectedFont = fontCss;
    localStorage.setItem('octave_font', fontCss);
    document.querySelectorAll('.font-option').forEach(opt => opt.classList.remove('active'));
    el.classList.add('active');
    const container = document.getElementById('lyrics-content');
    if (container && container.firstChild) {
        container.firstChild.style.fontFamily = `'${fontCss}', sans-serif`;
    }
};

// --- ARTIST PAGES ---
window.renderArtistPage = async (artistName) => {
    document.getElementById('full-player').classList.remove('active');
    document.getElementById('fp-overlay-panel').classList.remove('active');
    const dynamicView = document.getElementById('dynamic-view');
    dynamicView.innerHTML = '<div style="padding: 100px 20px; text-align:center;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 40px; color: var(--accent);"></i></div>';

    const profile = await window.fetchFullArtistProfile(artistName);
    let tracksHTML = '';
    if (profile.tracks.length > 0) {
        profile.tracks.forEach((track, index) => {
            tracksHTML += `
                <div class="artist-track-item" style="display: flex; align-items: center; gap: 14px; padding: 12px; background: var(--bg-surface); border-radius: 8px; margin-bottom: 12px; cursor: pointer;">
                    <img src="${track.thumb}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${window.escapeHTML(track.title)}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${window.escapeHTML(track.author)}</div>
                    </div>
                    <button class="icon-btn" style="color: var(--accent);"><i class="fa-solid fa-play"></i></button>
                </div>
            `;
        });
    } else {
        tracksHTML = '<div class="empty-state-text">No tracks found.</div>';
    }

    const bannerStyle = profile.banner ? `background-image: url('${profile.banner}'); background-size: cover; background-position: center;` : `background: linear-gradient(135deg, var(--bg-deep), var(--glass-bg));`;

    dynamicView.innerHTML = `
        <div style="position: relative; width: 100%; height: 250px; ${bannerStyle}">
            <div style="position: absolute; inset: 0; background: linear-gradient(0deg, var(--bg-deep) 0%, transparent 100%);"></div>
            <button class="icon-btn" onclick="document.querySelector('.nav-item.active').click()" style="position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.5); border-radius: 50%; padding: 10px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-arrow-left"></i></button>
            <div style="position: absolute; bottom: 20px; left: 20px;">
                <h1 style="font-size: 32px; font-weight: 800; text-shadow: 0 4px 10px rgba(0,0,0,0.8); margin:0;">${window.escapeHTML(profile.name)}</h1>
            </div>
        </div>
        <div style="padding: 20px;">
            <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 24px; background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 16px; border-radius: 12px;">${window.escapeHTML(profile.bio)}</div>
            <h2 class="section-title" style="margin-bottom: 16px;">Top Tracks</h2>
            <div class="vertical-list" id="artist-tracks-list">${tracksHTML}</div>
        </div>
        <div class="bottom-spacer"></div>
    `;

    if (profile.tracks.length > 0) {
        document.querySelectorAll('.artist-track-item').forEach((node, idx) => {
            node.addEventListener('click', () => {
                window.OCTAVE.queue = [...profile.tracks];
                window.playTrackByIndex(idx);
            });
        });
    }
};

document.getElementById('fp-artist')?.addEventListener('click', () => {
    if (window.OCTAVE.currentIndex >= 0) window.renderArtistPage(window.OCTAVE.queue[window.OCTAVE.currentIndex].author);
});

document.getElementById('fp-queue-btn')?.addEventListener('click', () => {
    if (window.OCTAVE.currentIndex < 0) return;
    fpTitle.innerText = 'Up Next';
    fpContent.innerHTML = '';
    fpPanel.classList.add('active');
    const q = window.OCTAVE.queue;
    for (let i = window.OCTAVE.currentIndex; i < q.length; i++) {
        const track = q[i];
        const isPlaying = i === window.OCTAVE.currentIndex;
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

document.getElementById('opt-sleep-timer')?.addEventListener('click', () => {
    document.getElementById('track-options-modal').classList.remove('active');
    document.getElementById('timer-modal').classList.add('active');
});

document.getElementById('close-timer')?.addEventListener('click', () => document.getElementById('timer-modal').classList.remove('active'));

if (document.getElementById('fp-options')) {
    document.getElementById('fp-options').addEventListener('click', () => {
        if (window.OCTAVE && window.OCTAVE.currentIndex >= 0) {
            window.openTrackOptions(window.OCTAVE.queue[window.OCTAVE.currentIndex]);
        }
    });
}

// --- CORE RENDERERS ---
window.renderPlaylistDetail = (plName) => {
    const dynamicView = document.getElementById('dynamic-view');
    const tracks = window.OCTAVE.playlists[plName] ||[];
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
                    <img src="${track.thumb}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;" onclick="window.OCTAVE.queue =[...window.OCTAVE.playlists['${window.escapeHTML(plName)}']]; window.playTrackByIndex(${idx});">
                    <div class="list-info" style="cursor: pointer;" onclick="window.OCTAVE.queue =[...window.OCTAVE.playlists['${window.escapeHTML(plName)}']]; window.playTrackByIndex(${idx});">
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
                    <img src="${track.thumb}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;" onclick="window.playTrack(track)">
                    <div class="list-info" style="cursor: pointer;" onclick="window.playTrack(track)">
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
    let greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    if (document.getElementById('time-greeting')) document.getElementById('time-greeting').textContent = greeting;

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

    if (window.fetchTrendingMusic) window.fetchTrendingMusic();

    const recsGrid = document.getElementById('home-recs-grid');
    if (recsGrid && window.OCTAVE.dailyRecs?.tracks.length > 0) {
        recsGrid.innerHTML = '';
        window.OCTAVE.dailyRecs.tracks.forEach(track => {
            const el = document.createElement('div'); el.className = 'square-card';
            el.innerHTML = `<div class="card-art shadow-heavy" style="background-image: url('${track.thumb}'); background-size: cover;"></div><div class="card-title">${window.escapeHTML(track.title)}</div>`;
            el.addEventListener('click', () => window.playTrack(track));
            recsGrid.appendChild(el);
        });
    }

    if (window.fetchDailyRecommendations) window.fetchDailyRecommendations();

    const likedCount = Object.keys(window.OCTAVE.liked).length;
    
    playlistsDiv.innerHTML = `
        <div class="list-item" id="open-discover-mix" style="margin-bottom: 8px; cursor: pointer;">
            <div class="list-art shadow-heavy" style="background: linear-gradient(135deg, #8a2387, #e94057, #f27121); display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff;"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div class="list-info"><div class="list-title">Auto-DJ Discover Mix</div><div class="list-subtitle">Endless tracks based on taste</div></div>
        </div>
        <div class="list-item" id="open-ai-mix-large" style="margin-bottom: 8px; cursor: pointer;">
            <div class="list-art shadow-heavy" style="background: linear-gradient(135deg, #00c6ff, #0072ff); display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff;"><i class="fa-solid fa-robot"></i></div>
            <div class="list-info"><div class="list-title">AI Custom Mix</div><div class="list-subtitle">Describe a vibe, AI builds it</div></div>
        </div>
        <div class="list-item" id="open-liked-songs" style="cursor: pointer;">
            <div class="list-art shadow-heavy" style="background: linear-gradient(135deg, var(--accent), #0b5c26); display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff;"><i class="fa-solid fa-heart"></i></div>
            <div class="list-info"><div class="list-title">Liked Songs</div><div class="list-subtitle">${likedCount} tracks saved</div></div>
        </div>
    `;

    document.getElementById('open-discover-mix').addEventListener('click', () => {
        if (window.generateDiscoverMix) window.generateDiscoverMix();
    });
    
    document.getElementById('open-liked-songs').addEventListener('click', window.renderLikedSongs);

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
            <button class="icon-btn"><i class="fa-solid fa-chevron-right"></i></button>
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
            <i class="fa-solid fa-chevron-right" style="color: var(--text-secondary);"></i>
        `;
        
        el.addEventListener('click', () => window.renderPlaylistDetail(plName));
        lib.appendChild(el);
    });
}

function renderRecentSearches() {
    const recentList = document.getElementById('search-recent-list');
    if (!recentList) return;

    if (window.OCTAVE.recentSearches && window.OCTAVE.recentSearches.length > 0) {
        recentList.innerHTML = '';
        window.OCTAVE.recentSearches.forEach(track => {
            const el = document.createElement('div'); 
            el.className = 'list-item';
            el.innerHTML = `
                <img src="${track.thumb}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover; cursor: pointer;">
                <div class="list-info" style="cursor: pointer;">
                    <div class="list-title">${window.escapeHTML(track.title)}</div>
                    <div class="list-subtitle">${window.escapeHTML(track.author)}</div>
                </div>
            `;
            el.addEventListener('click', () => window.playTrack(track));
            recentList.appendChild(el);
        });
    } else {
        recentList.innerHTML = '<div class="empty-state-text" style="padding-top: 10px;">No recent searches yet.</div>';
    }
}

function bindSearch() {
    const input = document.getElementById('searchInput');
    const resContainer = document.getElementById('searchResults');
    let timer;
    input.addEventListener('input', (e) => {
        clearTimeout(timer);
        const query = e.target.value.trim();
        
        if (!query) { 
            resContainer.innerHTML = `
                <div id="search-default-view">
                    <h3 style="font-size: 16px; margin-bottom: 16px;">Recently Searched</h3>
                    <div class="vertical-list" id="search-recent-list" style="padding-right: 0;"></div>
                </div>
            `;
            renderRecentSearches(); 
            return; 
        }
        
        timer = setTimeout(async () => {
            resContainer.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent);"></i></div>';
            const results = await window.performSearch(query);
            resContainer.innerHTML = '';
            
            if (results.length === 0) {
                resContainer.innerHTML = '<div class="empty-state-text">No results found.</div>';
                return;
            }
            
            results.slice(0, 15).forEach(track => {
                const el = document.createElement('div'); el.className = 'list-item';
                el.innerHTML = `<img src="${track.thumb}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover; cursor: pointer;"><div class="list-info" style="cursor: pointer;"><div class="list-title">${window.escapeHTML(track.title)}</div><div class="list-subtitle">${window.escapeHTML(track.author)}</div></div>`;
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

document.getElementById('opt-share-track')?.addEventListener('click', () => {
    if (window.OCTAVE.activeTrackForOptions) {
        const track = window.OCTAVE.activeTrackForOptions;
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('v', track.videoId);
        url.searchParams.set('t', track.title);
        url.searchParams.set('a', track.author);
        url.searchParams.set('th', track.thumb);
        
        navigator.clipboard.writeText(url.toString()).then(() => {
            alert("Track link copied to clipboard!");
        }).catch(() => {
            alert("Failed to copy link.");
        });
        document.getElementById('track-options-modal').classList.remove('active');
    }
});

document.getElementById('opt-like-track')?.addEventListener('click', () => {
    if (window.OCTAVE.activeTrackForOptions) {
        window.toggleLike(window.OCTAVE.activeTrackForOptions);
        document.getElementById('track-options-modal').classList.remove('active');
    }
});

document.getElementById('opt-add-playlist')?.addEventListener('click', () => {
    document.getElementById('track-options-modal').classList.remove('active');
    const plModal = document.getElementById('select-playlist-modal');
    const list = document.getElementById('playlist-selection-list');
    if (Object.keys(window.OCTAVE.playlists).length === 0) {
        list.innerHTML = '<div class="empty-state-text">No playlists.</div>';
    } else {
        list.innerHTML = '';
        Object.keys(window.OCTAVE.playlists).forEach(plName => {
            const el = document.createElement('div');
            el.className = 'drawer-item';
            el.innerHTML = `<i class="fa-solid fa-list"></i> <span>${window.escapeHTML(plName)}</span>`;
            el.addEventListener('click', () => {
                window.OCTAVE.playlists[plName].push(window.OCTAVE.activeTrackForOptions);
                window.saveCache();
                plModal.classList.remove('active');
                if (window.renderPlaylistDetail && document.querySelector('h1').textContent === plName) window.renderPlaylistDetail(plName);
            });
            list.appendChild(el);
        });
    }
    plModal.classList.add('active');
});

// --- YOUTUBE IMPORT ---
document.getElementById('start-yt-import')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('yt-playlist-url').value.trim();
    if (!urlInput) return;
    let playlistId = '';
    try {
        const urlObj = new URL(urlInput);
        playlistId = urlObj.searchParams.get('list');
    } catch (e) {
        if (urlInput.startsWith('PL') && urlInput.length > 15) {
            playlistId = urlInput;
        }
    }
    if (!playlistId) {
        alert("Invalid URL.");
        return;
    }
    const btn = document.getElementById('start-yt-import');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    let success = false;
    for (let i = 0; i < window.INVIDIOUS.length; i++) {
        const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
            const r = await fetch(`${base}/api/v1/playlists/${playlistId}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (r.ok) {
                const data = await r.json();
                if (data.videos && data.videos.length > 0) {
                    let finalName = data.title || "Imported";
                    let count = 1;
                    while (window.OCTAVE.playlists[finalName]) {
                        finalName = `${data.title} (${count})`;
                        count++;
                    }
                    window.OCTAVE.playlists[finalName] = data.videos.map(v => ({
                        videoId: v.videoId,
                        title: v.title,
                        author: v.author,
                        thumb: (v.videoThumbnails && v.videoThumbnails.length > 0) ? v.videoThumbnails[0].url : ''
                    }));
                    window.saveCache();
                    success = true;
                    alert(`Imported ${data.videos.length} tracks!`);
                    document.getElementById('yt-import-modal').classList.remove('active');
                    document.getElementById('yt-playlist-url').value = '';
                    window.renderHome();
                    break;
                }
            }
        } catch (e) {
            continue;
        }
    }
    if (!success) alert("Failed.");
    btn.innerHTML = 'Import';
    btn.disabled = false;
});
document.addEventListener('DOMContentLoaded', () => {
    const dynamicView = document.getElementById('dynamic-view');
    
    // Cache the initial home HTML
    const views = {
        home: dynamicView.innerHTML,
        search: `
            <header class="search-header" style="padding: 40px 20px 20px 20px; background: var(--bg-deep);">
                <h1 class="search-title" style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">Search</h1>
                <div class="search-input-wrap" style="position: relative;">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                    <input type="text" class="search-box" id="searchInput" placeholder="Songs, artists, or podcasts..." autocomplete="off" style="width: 100%; background: var(--bg-surface); border: 1px solid var(--glass-border); padding: 14px 14px 14px 44px; border-radius: 8px; color: var(--text-primary); font-family: inherit; font-size: 14px; outline: none;">
                </div>
            </header>
            <div class="search-results" id="searchResults" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                
                <div id="search-default-view">
                    <h3 style="font-size: 16px; margin-bottom: 16px; color: var(--text-primary);">Recently Played</h3>
                    <div class="vertical-list" id="search-recent-list">
                        <div style="color: var(--text-secondary); font-size: 13px;">Play some tracks to build your history...</div>
                    </div>
                </div>

            </div>
            <div class="bottom-spacer"></div>
        `,
        library: `
            <header class="search-header" style="padding: 40px 20px 20px 20px;"><h1 class="search-title" style="font-size: 24px; font-weight: 700;">Your Library</h1></header>
            <div style="padding: 20px; color: var(--text-secondary); text-align: center; margin-top: 40px;">
                <i class="fa-solid fa-layer-group" style="font-size: 40px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>Your saved playlists and liked songs will appear here.</p>
            </div>
        `,
        premium: `
            <div style="padding: 80px 20px; text-align: center;">
                <i class="fa-solid fa-crown" style="font-size: 64px; color: var(--accent); margin-bottom: 24px; text-shadow: 0 0 20px rgba(30,215,96,0.4);"></i>
                <h2 style="font-size: 24px; margin-bottom: 12px;">Octave Premium</h2>
                <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">Ad-free background listening and custom audio engine are active.</p>
            </div>
        `
    };

    // Routing Logic
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            document.querySelector('.nav-item.active').classList.remove('active');
            item.classList.add('active');
            
            const tab = item.getAttribute('data-tab');
            
            // Re-bind Home logic if returning home
            if (tab === 'home') {
                dynamicView.innerHTML = views.home;
                bindHomeModals();
            } else {
                dynamicView.innerHTML = views[tab];
            }
            
            // Bind Search if Search tab opened
            if (tab === 'search') bindSearch();
        });
    });

    setGreeting();
    handleBravePrompt();
    bindMenuLogic();
    bindHomeModals();
});

function setGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    const el = document.getElementById('time-greeting');
    if (el) el.textContent = greeting;
}

// --- MODAL & MENU LOGIC ---
function bindMenuLogic() {
    const menuBtn = document.getElementById('menu-btn');
    const sideMenu = document.getElementById('side-menu');
    const backdrop = document.getElementById('menu-backdrop');
    const closeMenu = document.getElementById('close-menu');
    const openTerms = document.getElementById('open-terms');
    const termsModal = document.getElementById('terms-modal');
    const closeTerms = document.getElementById('close-terms');

    // Drawer
    menuBtn.addEventListener('click', () => {
        sideMenu.classList.add('active');
        backdrop.classList.add('active');
    });

    const hideDrawer = () => {
        sideMenu.classList.remove('active');
        backdrop.classList.remove('active');
    };
    closeMenu.addEventListener('click', hideDrawer);
    backdrop.addEventListener('click', hideDrawer);

    // Terms Modal
    openTerms.addEventListener('click', () => {
        hideDrawer();
        termsModal.classList.add('active');
    });
    closeTerms.addEventListener('click', () => termsModal.classList.remove('active'));
}

function handleBravePrompt() {
    if (!localStorage.getItem('bravePromptShown')) {
        setTimeout(() => {
            document.getElementById('brave-modal').classList.add('active');
        }, 1500); // Pops up 1.5 seconds after first visit
    }

    const closeBrave = document.getElementById('close-brave');
    const getBrave = document.getElementById('get-brave');

    const dismissBrave = () => {
        localStorage.setItem('bravePromptShown', 'true');
        document.getElementById('brave-modal').classList.remove('active');
    };

    closeBrave.addEventListener('click', dismissBrave);
    getBrave.addEventListener('click', dismissBrave);
}

function bindHomeModals() {
    // Re-attach playlist modal trigger since Home view can be wiped and restored
    const openPlaylist = document.getElementById('open-create-playlist');
    const playlistModal = document.getElementById('playlist-modal');
    const closePlaylist = document.getElementById('close-playlist');
    const savePlaylist = document.getElementById('save-playlist');

    if(openPlaylist) openPlaylist.addEventListener('click', () => playlistModal.classList.add('active'));
    if(closePlaylist) closePlaylist.addEventListener('click', () => playlistModal.classList.remove('active'));
    if(savePlaylist) savePlaylist.addEventListener('click', () => {
        const name = document.getElementById('playlist-name').value;
        if(name.trim() !== '') {
            console.log(`Playlist created: ${name}`);
            // Logic to save to cache will go here in Step 2
            document.getElementById('playlist-name').value = '';
            playlistModal.classList.remove('active');
        }
    });
}

// --- SEARCH LOGIC ---
function debounce(func, timeout = 500) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

function bindSearch() {
    const input = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('searchResults');
    const defaultView = document.getElementById('search-default-view');
    
    if (!input) return;

    input.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        
        // If empty, return to "Recently Played" view
        if (!query) {
            resultsContainer.innerHTML = '';
            resultsContainer.appendChild(defaultView);
            return;
        }

        // Searching state
        resultsContainer.innerHTML = '<div style="text-align: center; margin-top: 20px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--accent);"></i></div>';
        
        if (window.performSearch) {
            const results = await window.performSearch(query);
            renderResults(results, resultsContainer);
        }
    }));
}

function renderResults(results, container) {
    if (!results || results.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; margin-top: 20px;">No results found.</div>';
        return;
    }

    container.innerHTML = '';
    results.slice(0, 15).forEach(track => {
        const el = document.createElement('div');
        el.style.cssText = 'display: flex; align-items: center; gap: 14px; padding: 12px; background: var(--bg-surface); border-radius: 8px; box-shadow: var(--shadow-soft); cursor: pointer;';
        el.innerHTML = `
            <img src="${track.thumb}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;" alt="Art">
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${track.title}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${track.author}</div>
            </div>
            <i class="fa-solid fa-play" style="color: var(--accent); font-size: 14px;"></i>
        `;
        
        el.addEventListener('click', () => {
            if (window.playTrack) window.playTrack(track);
        });
        
        container.appendChild(el);
    });
}

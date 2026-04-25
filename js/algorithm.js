// ============================================================
// algorithm.js — Octave Top-Notch Auto-DJ & Prediction Engine
// ============================================================

window.calculateTrackScore = (track) => {
    if (!track || !track.videoId) return -100;
    const stats = window.OCTAVE.playStats[track.videoId] || { plays: 0, skips: 0, completes: 0, manual: 0, activeViews: 0 };
    
    let score = 0;
    score += (stats.plays * 1);
    score += (stats.completes * 3);  
    score += (stats.manual * 5);     
    score += (stats.activeViews * 1);
    score -= (stats.skips * 10); 
    
    if (window.OCTAVE.liked && window.OCTAVE.liked[track.videoId]) score += 20;
    
    let inPlaylist = false;
    if (window.OCTAVE.playlists) {
        Object.values(window.OCTAVE.playlists).forEach(pl => {
            if (pl.find(t => t.videoId === track.videoId)) inPlaylist = true;
        });
    }
    if (inPlaylist) score += 5;
    
    return score;
};

window.isFetchingBatch = false;

window.fetchAutoDjBatch = async () => {
    if (window.isFetchingBatch) return;
    window.isFetchingBatch = true;

    try {
        const allKnown =[...Object.values(window.OCTAVE.liked || {}), ...(window.OCTAVE.recentPlayed || []), ...(window.OCTAVE.queue ||[])];
        const uniqueKnown = Array.from(new Map(allKnown.map(t =>[t.videoId, t])).values());
        
        let topSeeds = uniqueKnown
            .filter(t => !window.OCTAVE.sessionHistory.includes(t.videoId))
            .sort((a, b) => window.calculateTrackScore(b) - window.calculateTrackScore(a))
            .slice(0, 3);
            
        if (topSeeds.length === 0 && window.OCTAVE.recentPlayed.length > 0) {
            topSeeds.push(window.OCTAVE.recentPlayed[0]);
        }

        let candidatePool =[];

        // METHOD 1: Fetch recommended videos aggressively across safe instances
        if (topSeeds.length > 0) {
            for (const seed of topSeeds) {
                for (let i = 0; i < window.INVIDIOUS.length; i++) {
                    const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
                    try {
                        const controller = new AbortController();
                        const id = setTimeout(() => controller.abort(), 3500); // 3.5 sec fail-fast timeout
                        const r = await fetch(`${base}/api/v1/videos/${seed.videoId}?fields=recommendedVideos`, { signal: controller.signal });
                        clearTimeout(id);
                        if (r.ok) {
                            const d = await r.json();
                            if (d.recommendedVideos && d.recommendedVideos.length > 0) {
                                candidatePool.push(...d.recommendedVideos);
                                break; // Got recommendations for this seed, break inner loop!
                            }
                        }
                    } catch (e) { continue; }
                }
            }
        }

        // METHOD 2: Robust Fallback -> Use the working Search API for the seed artists!
        if (candidatePool.length < 5 && topSeeds.length > 0) {
            for (const seed of topSeeds) {
                try {
                    const searchResults = await window.performSearch(`${seed.author} audio`);
                    if (searchResults && searchResults.length > 0) {
                        candidatePool.push(...searchResults);
                    }
                } catch(e) {}
            }
        }

        // METHOD 3: Nuclear Fallback -> Global Popular Music
        if (candidatePool.length < 5) {
            for (let i = 0; i < window.INVIDIOUS.length; i++) {
                try {
                    const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
                    const r = await fetch(`${base}/api/v1/popular?videoCategory=10`);
                    if (r.ok) {
                        const d = await r.json();
                        if (d && d.length > 0) {
                            candidatePool.push(...d);
                            break;
                        }
                    }
                } catch(e) { continue; }
            }
        }

        // Strict Music Firewall
        const badWords =['tutorial', 'vlog', 'news', 'podcast', 'interview', 'review', 'unboxing', 'live', 'type beat', 'full album', 'documentary'];
        
        const freshRecs = candidatePool.filter(v => {
            const isShortEnough = !v.lengthSeconds || (v.lengthSeconds < 600 && v.lengthSeconds > 30); 
            const notPlayedThisSession = !window.OCTAVE.sessionHistory.includes(v.videoId);
            const notPenalized = window.calculateTrackScore({ videoId: v.videoId }) >= -5; 
            
            const titleLower = (v.title || '').toLowerCase();
            const authorLower = (v.author || '').toLowerCase();
            const noBadWords = !badWords.some(bw => titleLower.includes(bw) || authorLower.includes(bw));

            // Prevent duplicating songs that are already physically sitting in the queue
            const notInQueue = !window.OCTAVE.queue.some(q => q.videoId === v.videoId);

            return isShortEnough && notPlayedThisSession && notPenalized && noBadWords && notInQueue;
        });

        // Deduplicate and Randomize
        const uniqueRecs = Array.from(new Map(freshRecs.map(t =>[t.videoId, t])).values());
        uniqueRecs.sort(() => 0.5 - Math.random());
        
        const next5 = uniqueRecs.slice(0, 5).map(pick => ({
            videoId: pick.videoId, 
            title: pick.title, 
            author: pick.author,
            // Handles different object shapes flawlessly
            thumb: pick.thumb ? pick.thumb : ((pick.videoThumbnails && pick.videoThumbnails.length > 0) ? pick.videoThumbnails[0].url : '')
        }));

        if (next5.length > 0) {
            window.OCTAVE.queue.push(...next5);
            window.saveCache();
        }
        
    } catch (e) {
        console.warn("Octave: Silent Auto-DJ batch fetch skipped.");
    } finally {
        window.isFetchingBatch = false;
    }
};

// Queue Interceptor: Silently loads next 5 songs in the background when getting close to the end
setTimeout(() => {
    if (window.playTrackByIndex) {
        const originalPlayTrackByIndex = window.playTrackByIndex;
        window.playTrackByIndex = (index) => {
            originalPlayTrackByIndex(index);
            if (window.OCTAVE.queue.length - index <= 2) {
                setTimeout(() => {
                    window.fetchAutoDjBatch();
                }, 2000);
            }
        };
    }
}, 500); 

window.playNextLogic = async () => {
    if (window.OCTAVE.isTransitioning) return;
    
    // Absolute failsafe if the background loading didn't finish fast enough
    if (window.OCTAVE.currentIndex >= window.OCTAVE.queue.length - 1) {
        const fpPlay = document.querySelector('#fp-play i');
        if (fpPlay) fpPlay.className = 'fa-solid fa-spinner fa-spin'; 
        await window.fetchAutoDjBatch();
    }

    if (window.OCTAVE.currentIndex < window.OCTAVE.queue.length - 1) {
        window.OCTAVE.isNextTrackManual = false; 
        window.playTrackByIndex(window.OCTAVE.currentIndex + 1);
    } else {
        window.OCTAVE.isPlaying = false;
        const fpPlay = document.querySelector('#fp-play i');
        if (fpPlay) fpPlay.className = 'fa-solid fa-play';
    }
};
window.playNext = window.playNextLogic; 

// FIXED: MANUAL DISCOVER MIX
window.generateDiscoverMix = async () => {
    const allKnown =[...Object.values(window.OCTAVE.liked || {}), ...(window.OCTAVE.recentPlayed || [])];
    if (allKnown.length === 0) {
        alert("Play or like some songs first to build your taste profile!");
        return;
    }

    const dynamicView = document.getElementById('dynamic-view');
    
    dynamicView.innerHTML = `
        <div style="padding: 20px;">
            <button class="icon-btn" onclick="document.querySelector('.nav-item.active').click()"><i class="fa-solid fa-arrow-left"></i></button>
        </div>
        <div style="padding: 60px 20px; text-align:center;">
            <i class="fa-solid fa-wand-magic-sparkles fa-bounce" style="font-size: 40px; color: var(--accent); margin-bottom: 20px;"></i>
            <h2>Brewing your mix...</h2>
            <p style="color:var(--text-secondary);font-size:14px;margin-top:10px;">Analyzing taste profile via advanced predictive engine.</p>
        </div>
    `;

    // Save backup just in case API fails completely
    const backupQueue = [...window.OCTAVE.queue];
    const backupIndex = window.OCTAVE.currentIndex;

    window.OCTAVE.queue =[];
    window.OCTAVE.currentIndex = -1;
    
    await window.fetchAutoDjBatch(); 

    if (window.OCTAVE.queue.length > 0) {
        window.OCTAVE.isNextTrackManual = true; 
        window.playTrackByIndex(0);
        const homeTab = document.querySelector('.nav-item[data-tab="home"]');
        if (homeTab) homeTab.click();
    } else {
        // Restore perfect UI if it somehow fails
        window.OCTAVE.queue = backupQueue;
        window.OCTAVE.currentIndex = backupIndex;
        alert("Algorithm failed to connect to network. Try again.");
        const homeTab = document.querySelector('.nav-item[data-tab="home"]');
        if (homeTab) homeTab.click(); 
    }
};

window.fetchDailyRecommendations = async () => {
    if (!window.OCTAVE) return;
    const now = Date.now();
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
    
    if (window.OCTAVE.dailyRecs && window.OCTAVE.dailyRecs.tracks && window.OCTAVE.dailyRecs.tracks.length > 0) {
        if (now - window.OCTAVE.dailyRecs.timestamp < FIVE_DAYS) return; 
    }
    
    const allKnown =[...Object.values(window.OCTAVE.liked || {}), ...(window.OCTAVE.recentPlayed || [])];
    const topScored = allKnown.sort((a, b) => window.calculateTrackScore(b) - window.calculateTrackScore(a)).slice(0, 10);
    
    for (let i = 0; i < window.INVIDIOUS.length; i++) {
        const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
            let url = '';
            if (topScored.length > 0) {
                const seed = topScored[Math.floor(Math.random() * topScored.length)];
                url = `${base}/api/v1/videos/${seed.videoId}?fields=recommendedVideos`;
            } else {
                url = `${base}/api/v1/popular?videoCategory=10`; 
            }

            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (r.ok) {
                const d = await r.json();
                let newTracks =[];

                if (topScored.length > 0 && d.recommendedVideos) {
                    newTracks = d.recommendedVideos.filter(v => v.lengthSeconds && v.lengthSeconds < 600).slice(0, 10);
                } else if (topScored.length === 0 && Array.isArray(d)) {
                    newTracks = d.filter(v => v.lengthSeconds && v.lengthSeconds < 600).slice(0, 10);
                }

                if (newTracks.length > 0) {
                    window.OCTAVE.dailyRecs = {
                        timestamp: now,
                        tracks: newTracks.map(rec => ({
                            videoId: rec.videoId, title: rec.title, author: rec.author,
                            thumb: (rec.videoThumbnails && rec.videoThumbnails.length > 0) ? rec.videoThumbnails[0].url : ''
                        }))
                    };
                    window.saveCache();
                    const activeTab = document.querySelector('.nav-item.active');
                    if (activeTab && activeTab.getAttribute('data-tab') === 'home') {
                        window.renderHome();
                    }
                    break;
                }
            }
        } catch(e) { continue; }
    }
};

window.fetchTrendingMusic = async () => {
    const trendingGrid = document.getElementById('home-trending-grid');
    if (!trendingGrid) return;

    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    if (window.OCTAVE.trendingData && window.OCTAVE.trendingData.tracks && window.OCTAVE.trendingData.tracks.length > 0) {
        if (now - window.OCTAVE.trendingData.timestamp < THREE_DAYS) {
            window.renderTrendingTracks(window.OCTAVE.trendingData.tracks, trendingGrid);
            return;
        }
    }

    try {
        const r = await fetch('https://itunes.apple.com/us/rss/topsongs/limit=50/json');
        if (r.ok) {
            const d = await r.json();
            if (d.feed && d.feed.entry) {
                const uniqueTracks = new Map();

                d.feed.entry.forEach(entry => {
                    const title = entry['im:name'].label;
                    const author = entry['im:artist'].label;
                    const key = `${title}-${author}`.toLowerCase(); 
                    
                    if (!uniqueTracks.has(key)) {
                        let thumbUrl = '';
                        if (entry['im:image'] && entry['im:image'].length > 0) {
                            thumbUrl = entry['im:image'][entry['im:image'].length - 1].label;
                        }
                        
                        uniqueTracks.set(key, {
                            videoId: null, 
                            title: title,
                            author: author,
                            thumb: thumbUrl
                        });
                    }
                });

                const newTracks = Array.from(uniqueTracks.values());

                if (newTracks.length > 0) {
                    window.OCTAVE.trendingData = {
                        timestamp: now,
                        tracks: newTracks
                    };
                    window.saveCache();
                    window.renderTrendingTracks(newTracks, trendingGrid);
                }
            }
        }
    } catch(e) { 
        trendingGrid.innerHTML = '<div class="empty-state-text">Failed to load charts.</div>';
    }
};

window.renderTrendingTracks = (tracks, container) => {
    container.innerHTML = '';
    tracks.forEach(track => {
        const el = document.createElement('div');
        el.className = 'square-card';
        el.innerHTML = `<div class="card-art shadow-heavy" style="background-image: url('${track.thumb}'); background-size: cover;"></div><div class="card-title">${window.escapeHTML(track.title)}</div>`;
        
        el.addEventListener('click', async () => {
            if (!track.videoId) {
                el.style.opacity = '0.5'; 
                const query = `${track.author} ${track.title} audio`;
                const results = await window.performSearch(query);
                el.style.opacity = '1';
                
                if (results && results.length > 0) {
                    track.videoId = results[0].videoId;
                    window.saveCache(); 
                    window.playTrack(track);
                } else {
                    alert("Could not find an audio stream for this track.");
                }
            } else {
                window.playTrack(track);
            }
        });
        
        container.appendChild(el);
    });
};

window.smartShufflePlaylist = (plName) => {
    const pl = window.OCTAVE.playlists[plName];
    if (pl && pl.length > 0) {
        let sorted = [...pl].sort((a, b) => {
            const countA = window.calculateTrackScore(a);
            const countB = window.calculateTrackScore(b);
            if (countB !== countA) return countB - countA;
            return 0.5 - Math.random(); 
        });
        window.OCTAVE.queue = sorted; 
        window.OCTAVE.isNextTrackManual = true;
        window.playTrackByIndex(0);
    }
};
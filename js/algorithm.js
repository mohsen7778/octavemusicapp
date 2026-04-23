window.calculateTrackScore = (track) => {
    if (!track || !track.videoId) return -100;
    const stats = window.OCTAVE.playStats[track.videoId] || { plays: 0, skips: 0, completes: 0, manual: 0, activeViews: 0 };
    
    let score = 0;
    score += (stats.plays * 1);
    score += (stats.completes * 2);
    score += (stats.manual * 3);
    score += (stats.activeViews * 1);
    score -= (stats.skips * 4);
    
    if (window.OCTAVE.liked[track.videoId]) score += 5;
    
    // Check if it's in any playlist
    let inPlaylist = false;
    Object.values(window.OCTAVE.playlists).forEach(pl => {
        if (pl.find(t => t.videoId === track.videoId)) inPlaylist = true;
    });
    if (inPlaylist) score += 4;
    
    return score;
};

window.playNextLogic = async () => {
    // 1. If there's a manual queue, play the next song in it
    if (window.OCTAVE.currentIndex < window.OCTAVE.queue.length - 1) {
        window.playTrackByIndex(window.OCTAVE.currentIndex + 1);
    } 
    // 2. The Smart Auto-DJ kicks in
    else {
        const currentTrack = window.OCTAVE.queue[window.OCTAVE.currentIndex];
        if (!currentTrack) return;
        
        // Get all known tracks and score them
        const allKnownTracks = [...Object.values(window.OCTAVE.liked), ...window.OCTAVE.recentPlayed, ...window.OCTAVE.queue];
        
        // Find the absolute highest scoring track that hasn't been played in this session to act as our "Seed"
        let bestSeed = currentTrack;
        let highestScore = -999;

        allKnownTracks.forEach(t => {
            const tScore = window.calculateTrackScore(t);
            // Must be high score, AND not played in this session
            if (tScore > highestScore && !window.OCTAVE.sessionHistory.includes(t.videoId)) {
                highestScore = tScore;
                bestSeed = t;
            }
        });

        // Fallback to current track if no better seed is found
        if (!bestSeed) bestSeed = currentTrack;

        for (let i = 0; i < window.INVIDIOUS.length; i++) {
            const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
                const r = await fetch(`${base}/api/v1/videos/${bestSeed.videoId}?fields=recommendedVideos`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (r.ok) {
                    const d = await r.json();
                    if (d.recommendedVideos && d.recommendedVideos.length > 0) {
                        
                        // THE STRICT NO-REPEAT & PENALTY BOX FILTER
                        let freshRecs = d.recommendedVideos.filter(v => {
                            const isShortEnough = v.lengthSeconds && v.lengthSeconds < 600;
                            const notPlayedThisSession = !window.OCTAVE.sessionHistory.includes(v.videoId);
                            const notPenalized = window.calculateTrackScore({ videoId: v.videoId }) >= 0;
                            return isShortEnough && notPlayedThisSession && notPenalized;
                        });

                        // Extreme fallback if filtering removes everything (very rare)
                        if (freshRecs.length === 0) {
                            freshRecs = d.recommendedVideos.filter(v => v.lengthSeconds && v.lengthSeconds < 600 && !window.OCTAVE.sessionHistory.includes(v.videoId));
                        }
                        
                        if (freshRecs.length > 0) {
                            // Pick from the top 3 best recommendations to maintain high relevance but add slight discovery variance
                            const pick = freshRecs[Math.floor(Math.random() * Math.min(3, freshRecs.length))];
                            const nextTrack = {
                                videoId: pick.videoId, title: pick.title, author: pick.author,
                                thumb: (pick.videoThumbnails && pick.videoThumbnails.length > 0) ? pick.videoThumbnails[0].url : ''
                            };
                            
                            // Because Auto-DJ found it, it's not a manual pick
                            window.OCTAVE.isNextTrackManual = false;
                            window.OCTAVE.queue.push(nextTrack);
                            window.playTrackByIndex(window.OCTAVE.queue.length - 1);
                            return;
                        }
                    }
                }
            } catch(e) { continue; }
        }
    }
};

window.playNext = window.playNextLogic;

window.fetchDailyRecommendations = async () => {
    if (!window.OCTAVE) return;
    const now = Date.now();
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
    
    if (window.OCTAVE.dailyRecs && window.OCTAVE.dailyRecs.tracks && window.OCTAVE.dailyRecs.tracks.length > 0) {
        if (now - window.OCTAVE.dailyRecs.timestamp < FIVE_DAYS) return; 
    }
    
    // Base recs purely on highest scored tracks, not just random recents
    const allKnown = [...Object.values(window.OCTAVE.liked), ...window.OCTAVE.recentPlayed];
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
                    if(activeTab && activeTab.getAttribute('data-tab') === 'home') {
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

    // Load from cache if fresh (3 Days)
    if (window.OCTAVE.trendingData && window.OCTAVE.trendingData.tracks && window.OCTAVE.trendingData.tracks.length > 0) {
        if (now - window.OCTAVE.trendingData.timestamp < THREE_DAYS) {
            window.renderTrendingTracks(window.OCTAVE.trendingData.tracks, trendingGrid);
            return;
        }
    }

    try {
        // Fetch Top 20 from iTunes Open API
        const r = await fetch('https://itunes.apple.com/us/rss/topsongs/limit=20/json');
        if (r.ok) {
            const d = await r.json();
            if (d.feed && d.feed.entry) {
                const newTracks = d.feed.entry.map(entry => {
                    // Grab the highest resolution thumb available
                    let thumbUrl = '';
                    if (entry['im:image'] && entry['im:image'].length > 0) {
                        thumbUrl = entry['im:image'][entry['im:image'].length - 1].label;
                    }
                    
                    return {
                        videoId: null, // We will fetch this dynamically on click
                        title: entry['im:name'].label,
                        author: entry['im:artist'].label,
                        thumb: thumbUrl
                    };
                });

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
            // If we don't have the videoId yet, fetch it securely in the background
            if (!track.videoId) {
                el.style.opacity = '0.5'; // Visual feedback that it's loading
                const query = `${track.author} ${track.title} audio`;
                const results = await window.performSearch(query);
                el.style.opacity = '1';
                
                if (results && results.length > 0) {
                    track.videoId = results[0].videoId;
                    window.saveCache(); // Save the found ID so we don't search for it again
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

window.generateDiscoverMix = async () => {
    const allKnown = [...Object.values(window.OCTAVE.liked), ...window.OCTAVE.recentPlayed];
    if (allKnown.length === 0) {
        alert("Play or like some songs first to build your taste profile!");
        return;
    }

    const dynamicView = document.getElementById('dynamic-view');
    const originalHTML = dynamicView.innerHTML;
    dynamicView.innerHTML = '<div style="padding: 100px 20px; text-align:center;"><i class="fa-solid fa-wand-magic-sparkles fa-bounce" style="font-size: 40px; color: var(--accent); margin-bottom: 20px;"></i><h2>Brewing your mix...</h2><p style="color:var(--text-secondary);font-size:14px;margin-top:10px;">Analyzing taste profile via advanced predictive engine.</p></div>';

    // Seed mix with top 3 highest scored tracks
    const topScored = allKnown.sort((a, b) => window.calculateTrackScore(b) - window.calculateTrackScore(a)).slice(0, 5);
    const seeds = [];
    for(let i=0; i<3; i++) {
        if(topScored[i]) seeds.push(topScored[i]);
    }
    
    const newQueue = [];
    const seenIds = new Set();

    for (const seed of seeds) {
        if(!seed) continue;
        for (let i = 0; i < window.INVIDIOUS.length; i++) {
            const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
            try {
                const r = await fetch(`${base}/api/v1/videos/${seed.videoId}?fields=recommendedVideos`);
                if (r.ok) {
                    const d = await r.json();
                    if (d.recommendedVideos) {
                        d.recommendedVideos.filter(v => v.lengthSeconds && v.lengthSeconds < 600 && window.calculateTrackScore({videoId: v.videoId}) >= 0).slice(0, 6).forEach(rec => {
                            if(!seenIds.has(rec.videoId) && !window.OCTAVE.sessionHistory.includes(rec.videoId)) {
                                seenIds.add(rec.videoId);
                                newQueue.push({
                                    videoId: rec.videoId, title: rec.title, author: rec.author,
                                    thumb: (rec.videoThumbnails && rec.videoThumbnails.length > 0) ? rec.videoThumbnails[0].url : ''
                                });
                            }
                        });
                    }
                    break; 
                }
            } catch(e) { continue; }
        }
    }

    if (newQueue.length > 0) {
        newQueue.sort(() => 0.5 - Math.random());
        window.OCTAVE.queue = newQueue;
        window.OCTAVE.isNextTrackManual = true; // Mark as manual intent
        window.playTrackByIndex(0);
        const homeTab = document.querySelector('.nav-item[data-tab="home"]');
        if(homeTab) homeTab.click();
    } else {
        dynamicView.innerHTML = originalHTML;
        alert("Algorithm failed to connect to network. Try again.");
    }
};

window.smartShufflePlaylist = (plName) => {
    const pl = window.OCTAVE.playlists[plName];
    if (pl && pl.length > 0) {
        // Smart Shuffle ranks by exact 10-point score
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

window.playNextLogic = async () => {
    if (window.OCTAVE.currentIndex < window.OCTAVE.queue.length - 1) {
        window.playTrackByIndex(window.OCTAVE.currentIndex + 1);
    } else {
        let seedTrack = window.OCTAVE.queue[window.OCTAVE.currentIndex];
        if (!seedTrack) return;
        
        const likedKeys = Object.keys(window.OCTAVE.liked);
        const recentTracks = window.OCTAVE.recentPlayed;
        const rand = Math.random();
        
        if (rand < 0.3 && likedKeys.length > 0) {
            seedTrack = window.OCTAVE.liked[likedKeys[Math.floor(Math.random() * likedKeys.length)]];
        } else if (rand < 0.5 && recentTracks.length > 0) {
            seedTrack = recentTracks[Math.floor(Math.random() * recentTracks.length)];
        }
        
        for (let i = 0; i < window.INVIDIOUS.length; i++) {
            const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
            try {
                const r = await fetch(`${base}/api/v1/videos/${seedTrack.videoId}?fields=recommendedVideos`, { signal: AbortSignal.timeout(5000) });
                if (r.ok) {
                    const d = await r.json();
                    if (d.recommendedVideos && d.recommendedVideos.length > 0) {
                        const recentIds = window.OCTAVE.recentPlayed.slice(0, 15).map(t => t.videoId);
                        let freshRecs = d.recommendedVideos.filter(v => !recentIds.includes(v.videoId));
                        if (freshRecs.length === 0) freshRecs = d.recommendedVideos;
                        const pick = freshRecs[Math.floor(Math.random() * Math.min(3, freshRecs.length))];
                        
                        const nextTrack = {
                            videoId: pick.videoId, title: pick.title, author: pick.author,
                            thumb: (pick.videoThumbnails && pick.videoThumbnails.length > 0) ? pick.videoThumbnails[0].url : ''
                        };
                        window.OCTAVE.queue.push(nextTrack);
                        window.playTrackByIndex(window.OCTAVE.queue.length - 1);
                        return;
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
    
    const baseTracks =[...Object.values(window.OCTAVE.liked), ...window.OCTAVE.recentPlayed].slice(0, 20);
    
    for (let i = 0; i < window.INVIDIOUS.length; i++) {
        const base = window.INVIDIOUS[(window.invIdx + i) % window.INVIDIOUS.length];
        try {
            let url = '';
            if (baseTracks.length > 0) {
                const seed = baseTracks[Math.floor(Math.random() * baseTracks.length)];
                url = `${base}/api/v1/videos/${seed.videoId}?fields=recommendedVideos`;
            } else {
                url = `${base}/api/v1/popular?videoCategory=10`; 
            }

            const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (r.ok) {
                const d = await r.json();
                let newTracks =[];

                if (baseTracks.length > 0 && d.recommendedVideos) {
                    newTracks = d.recommendedVideos.slice(0, 10);
                } else if (baseTracks.length === 0 && Array.isArray(d)) {
                    newTracks = d.slice(0, 10);
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

window.generateDiscoverMix = async () => {
    const baseTracks =[...Object.values(window.OCTAVE.liked), ...window.OCTAVE.recentPlayed.slice(0, 10)];
    if (baseTracks.length === 0) {
        alert("Play or like some songs first to build your taste profile!");
        return;
    }

    const dynamicView = document.getElementById('dynamic-view');
    const originalHTML = dynamicView.innerHTML;
    dynamicView.innerHTML = '<div style="padding: 100px 20px; text-align:center;"><i class="fa-solid fa-wand-magic-sparkles fa-bounce" style="font-size: 40px; color: var(--accent); margin-bottom: 20px;"></i><h2>Brewing your mix...</h2><p style="color:var(--text-secondary);font-size:14px;margin-top:10px;">Analyzing taste profile via open API graph.</p></div>';

    const seeds =[];
    for(let i=0; i<3; i++) seeds.push(baseTracks[Math.floor(Math.random()*baseTracks.length)]);
    
    const newQueue =[];
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
                        d.recommendedVideos.slice(0, 6).forEach(rec => {
                            if(!seenIds.has(rec.videoId)) {
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
        window.playTrackByIndex(0);
        document.querySelector('.nav-item.active').click(); 
    } else {
        dynamicView.innerHTML = originalHTML;
        alert("Algorithm failed to connect to network. Try again.");
    }
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

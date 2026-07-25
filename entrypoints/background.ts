export default defineBackground(() => {
  console.log('Background service worker running');
  
  // Clear stale cache from previous versions on startup
  chrome.storage.local.clear();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FIND_THREAD') {
      (async () => {
        try {
          const { animeTitle, episodeNumber, seasonNumber } = message.payload;
          
          console.log(`[Reddit Extension] Searching for: "${animeTitle}" Season "${seasonNumber}" Episode "${episodeNumber}"`);

          // Build search query - simple text, no fancy quoting
          let searchTerms = animeTitle.replace(/["+]/g, '').trim();
          if (episodeNumber) {
            searchTerms += ` Episode ${episodeNumber}`;
          }

          // Check cache first
          const cacheKey = `reddit_v2_${searchTerms.replace(/\s+/g, '_')}`;
          const cached = await chrome.storage.local.get(cacheKey);
          if (cached[cacheKey] && cached[cacheKey].timestamp > Date.now() - 1000 * 60 * 60) {
             console.log('[Reddit Extension] Using cached data');
             sendResponse(cached[cacheKey].data);
             return;
          }

          // Strategy 1: Reddit's own search JSON API (works for new/current episodes)
          let threadId: string | null = null;
          let threadTitle = '';
          let threadPermalink = '';

          try {
            const redditSearchUrl = `https://www.reddit.com/r/anime/search.json?q=${encodeURIComponent(searchTerms)}&restrict_sr=on&sort=relevance&limit=10&type=link`;
            console.log('[Reddit Extension] Trying Reddit search:', redditSearchUrl);
            
            const redditRes = await fetch(redditSearchUrl);
            console.log('[Reddit Extension] Reddit search status:', redditRes.status);
            
            if (redditRes.ok) {
              const redditData = await redditRes.json();
              const autoLoveponThreads = redditData.data?.children
                ?.filter((c: any) => c.data.author === 'AutoLovepon')
                ?.map((c: any) => c.data) || [];
              
              console.log(`[Reddit Extension] Reddit search found ${autoLoveponThreads.length} AutoLovepon threads`);
              autoLoveponThreads.forEach((t: any) => console.log(`  - ${t.title}`));
              
              if (autoLoveponThreads.length > 0) {
                // Try to find the thread that matches the exact episode number
                let bestMatch = autoLoveponThreads[0];
                if (episodeNumber) {
                  const exactMatch = autoLoveponThreads.find((t: any) => {
                    const epPattern = new RegExp(`Episode\\s+${episodeNumber}\\b`, 'i');
                    return epPattern.test(t.title);
                  });
                  if (exactMatch) bestMatch = exactMatch;
                }
                
                threadId = bestMatch.id;
                threadTitle = bestMatch.title;
                threadPermalink = bestMatch.permalink;
                console.log(`[Reddit Extension] Reddit match: "${threadTitle}" (${threadId})`);
              }
            }
          } catch (e) {
            console.warn('[Reddit Extension] Reddit search failed, trying PullPush fallback:', e);
          }

          // Strategy 2: PullPush fallback (works for older episodes)
          if (!threadId) {
            try {
              const ppSearchUrl = `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(searchTerms)}&subreddit=anime&author=AutoLovepon`;
              console.log('[Reddit Extension] Trying PullPush search:', ppSearchUrl);
              
              const ppRes = await fetch(ppSearchUrl);
              console.log('[Reddit Extension] PullPush search status:', ppRes.status);
              
              if (ppRes.ok) {
                const ppData = await ppRes.json();
                if (ppData.data && ppData.data.length > 0) {
                  const post = ppData.data[0];
                  threadId = post.id;
                  threadTitle = post.title;
                  threadPermalink = `/r/anime/comments/${post.id}/`;
                  console.log(`[Reddit Extension] PullPush match: "${threadTitle}" (${threadId})`);
                }
              }
            } catch (e) {
              console.warn('[Reddit Extension] PullPush search also failed:', e);
            }
          }

          if (!threadId) {
            console.log('[Reddit Extension] No thread found by any method.');
            sendResponse({ success: false, error: 'THREAD_NOT_FOUND' });
            return;
          }

          // Fetch comments using Reddit's JSON endpoint (returns pre-nested comments)
          const commentsUrl = `https://www.reddit.com/comments/${threadId}.json?sort=top&limit=100`;
          console.log('[Reddit Extension] Fetching comments:', commentsUrl);
          
          const commentsRes = await fetch(commentsUrl);
          
          if (!commentsRes.ok) {
            // Fallback: try PullPush for comments
            console.warn(`[Reddit Extension] Reddit comments failed (${commentsRes.status}), trying PullPush`);
            const ppCommentsUrl = `https://api.pullpush.io/reddit/comment/search?link_id=${threadId}&limit=100`;
            const ppCommentsRes = await fetch(ppCommentsUrl);
            
            if (!ppCommentsRes.ok) {
              throw new Error(`Failed to fetch comments from both Reddit and PullPush`);
            }
            
            const ppCommentsData = await ppCommentsRes.json();
            
            // Reconstruct into Reddit's nested format since PullPush returns flat
            const commentMap = new Map();
            const rootComments: any[] = [];
            
            ppCommentsData.data.forEach((c: any) => {
              commentMap.set(c.id, {
                id: c.id, author: c.author, body: c.body, body_html: c.body,
                score: c.score || 0, created_utc: c.created_utc,
                replies: { data: { children: [] } }, parent_id: c.parent_id
              });
            });
            
            ppCommentsData.data.forEach((c: any) => {
              const node = commentMap.get(c.id);
              if (c.parent_id.startsWith('t3_')) {
                rootComments.push({ kind: 't1', data: node });
              } else if (c.parent_id.startsWith('t1_')) {
                const parentNode = commentMap.get(c.parent_id.replace('t1_', ''));
                if (parentNode) parentNode.replies.data.children.push({ kind: 't1', data: node });
                else rootComments.push({ kind: 't1', data: node });
              }
            });

            const responseData = {
              success: true, threadId, threadTitle,
              threadUrl: `https://www.reddit.com${threadPermalink}`,
              comments: [{ data: { children: [] } }, { data: { children: rootComments } }]
            };
            
            await chrome.storage.local.set({ [cacheKey]: { data: responseData, timestamp: Date.now() } });
            sendResponse(responseData);
            return;
          }
          
          // Reddit comments API returns data in exactly the format App.tsx expects
          const commentsData = await commentsRes.json();
          
          const responseData = { 
            success: true, threadId, threadTitle,
            threadUrl: `https://www.reddit.com${threadPermalink}`,
            comments: commentsData 
          };
          
          await chrome.storage.local.set({ [cacheKey]: { data: responseData, timestamp: Date.now() } });
          sendResponse(responseData);
          
        } catch (err) {
          console.error('[Reddit Extension] Error:', err);
          sendResponse({ success: false, error: (err as Error).message });
        }
      })();
      return true;
    }
  });
});

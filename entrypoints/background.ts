export default defineBackground(() => {
  console.log('Background service worker running');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FIND_THREAD') {
      (async () => {
        try {
          const { animeTitle, episodeNumber } = message.payload;
          
          console.log(`[Reddit Extension] Searching for: "${animeTitle}" Episode "${episodeNumber}"`);

          let query = `subreddit:anime author:AutoLovepon "${animeTitle}"`;
          if (episodeNumber) {
            query += ` "Episode ${episodeNumber}"`;
          }
          
          const searchUrl = `https://www.reddit.com/r/anime/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&limit=1`;
          
          const searchRes = await fetch(searchUrl);
          if (!searchRes.ok) {
            throw new Error(`Reddit API search failed (${searchRes.status})`);
          }
          const searchData = await searchRes.json();
          
          if (searchData.data?.children?.length > 0) {
            const post = searchData.data.children[0].data;
            const threadId = post.id;
            console.log(`[Reddit Extension] Found thread: ${post.title} (ID: ${threadId})`);
            
            const commentsUrl = `https://www.reddit.com/r/anime/comments/${threadId}.json?depth=5`;
            const commentsRes = await fetch(commentsUrl);
            if (!commentsRes.ok) {
              throw new Error(`Failed to fetch comments (${commentsRes.status})`);
            }
            const commentsData = await commentsRes.json();
            
            sendResponse({ 
              success: true, 
              threadId, 
              threadTitle: post.title,
              threadUrl: `https://www.reddit.com${post.permalink}`,
              comments: commentsData 
            });
          } else {
            sendResponse({ success: false, error: 'THREAD_NOT_FOUND' });
          }
        } catch (err) {
          console.error('[Reddit Extension] Error:', err);
          sendResponse({ success: false, error: (err as Error).message });
        }
      })();
      return true; // Keep channel open
    }
  });
});

import React, { useState, useEffect } from 'react';

type Comment = {
  id: string;
  author: string;
  body: string;
  body_html: string;
  score: number;
  replies: any; 
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [threadInfo, setThreadInfo] = useState<{ title: string; url: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    tryFetch();
  }, []);

  const tryFetch = () => {
    setLoading(true);
    setError(null);
    setVisibleCount(10);

    let animeTitle = '';
    let episodeNumber = '';
    let seasonNumber = '';
    
    // 1. Try DOM elements first — these are the most reliable on Crunchyroll's SPA
    //    The show title is usually an orange link pointing to /series/
    const showTitleEl = document.querySelector('a[href*="/series/"]') 
                     || document.querySelector('[data-t="show-title"]');
    if (showTitleEl) {
      animeTitle = showTitleEl.textContent?.trim() || '';
      // Clean up season/part suffixes that might be in the link text
      animeTitle = animeTitle.replace(/\s+Season\s+\d+/i, '').replace(/\s+Part\s+\d+/i, '').trim();
    }
    
    // Episode number from the episode heading (format: "E16 – Gran, the Hero of Dawn")
    const episodeHeading = document.querySelector('h1') 
                        || document.querySelector('.current-media-title')
                        || document.querySelector('[data-t="episode-title"]');
    if (episodeHeading) {
      const epText = episodeHeading.textContent || '';
      const epMatch = epText.match(/E(\d+)/i) || epText.match(/Episode\s*(\d+)/i);
      if (epMatch) episodeNumber = epMatch[1];
    }

    // 2. Fallback: try document.title (format: "Watch [Title] Season X EXX - [Ep Name] - Crunchyroll")
    if (!animeTitle && document.title) {
      // Match everything after "Watch " until Season/E/Part or " - "
      const seriesMatch = document.title.match(/Watch\s+(.*?)(?:\s+Season\s+\d+|\s+E\d+|\s+Part\s+\d+|\s+-)/i);
      if (seriesMatch) animeTitle = seriesMatch[1].trim();
    }
    
    if (!episodeNumber && document.title) {
      // Handle both "Episode 16" and "E16" formats
      const epMatch = document.title.match(/(?:Episode|E)\s*(\d+)/i);
      if (epMatch) episodeNumber = epMatch[1];
    }
    
    if (!seasonNumber && document.title) {
      const sMatch = document.title.match(/Season\s+(\d+)/i);
      if (sMatch) seasonNumber = sMatch[1];
    }

    console.log(`[Reddit Extension] Extracted — Title: "${animeTitle}", Season: "${seasonNumber}", Episode: "${episodeNumber}"`);

    chrome.runtime.sendMessage({ 
      type: 'FIND_THREAD', 
      payload: { animeTitle, episodeNumber, seasonNumber } 
    }, (response) => {
      if (response?.success) {
        setThreadInfo({ title: response.threadTitle, url: response.threadUrl });
        parseComments(response.comments);
      } else {
        if (response?.error === 'THREAD_NOT_FOUND') {
          setError(`No Reddit discussion thread found for "${animeTitle || 'this show'}" Episode ${episodeNumber || ''}.`);
        } else {
          setError(response?.error || 'Failed to fetch thread.');
        }
        setLoading(false);
      }
    });
  };

  const parseComments = (data: any[]) => {
    try {
      if (Array.isArray(data) && data.length > 1) {
        const commentsListing = data[1].data.children;
        const parsed = commentsListing
          .filter((child: any) => child.kind === 't1')
          .map((child: any) => child.data)
          .filter((data: any) => data.author && data.author !== '[deleted]' && data.body !== '[removed]');
        setComments(parsed);
      }
    } catch (e) {
      setError('Could not parse comments.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  const visibleComments = comments.slice(0, visibleCount);
  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  return (
    <div className="bg-black text-gray-200 font-sans w-full max-w-4xl mx-auto flex flex-col min-h-screen relative z-10 border border-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-900 bg-black">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-white cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
        <div className="text-white font-medium text-lg flex items-center gap-2">
          <span>Comments</span>
          {comments.length > 0 && (
             <>
               <span className="text-gray-500">•</span>
               <span>{formatNumber(comments.length)}</span>
             </>
          )}
        </div>
        <div className="flex items-center">
           <svg className="w-6 h-6 text-white cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
           </svg>
        </div>
      </div>
      
      {/* Subheader Thread Title */}
      {threadInfo && (
        <div className="px-4 py-3 bg-[#111111] border-b border-gray-900 flex justify-between items-center">
          <a href={threadInfo.url} target="_blank" rel="noreferrer" className="text-sm text-gray-400 hover:text-white truncate pr-4">
             {threadInfo.title}
          </a>
          <a href={threadInfo.url} target="_blank" rel="noreferrer" className="text-xs bg-[#F47521] text-white px-3 py-1 rounded font-bold shrink-0">
            Open App
          </a>
        </div>
      )}
      
      {loading && (
        <div className="flex items-center justify-center gap-3 text-gray-400 py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#F47521] border-t-transparent"></div>
          <span>Loading comments...</span>
        </div>
      )}

      {!loading && error && (
        <div className="text-gray-400 text-sm p-6 flex flex-col items-center justify-center text-center gap-4 py-12">
          <span>{error}</span>
          <button onClick={tryFetch} className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded transition font-medium">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="flex-1 pb-16">
          {comments.length === 0 ? (
            <p className="text-gray-500 p-6 text-center">No comments yet.</p>
          ) : (
            <div className="divide-y divide-gray-900/50">
              {visibleComments.map(c => <CommentItem key={c.id} comment={c} isTopLevel={true} />)}
              {visibleCount < comments.length && (
                <div className="p-6 text-center">
                  <button 
                    onClick={handleLoadMore}
                    className="text-[#F47521] font-bold text-sm uppercase tracking-wider hover:underline"
                  >
                    Load More Comments
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Fake Input Footer to match screenshot */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#141519] border-t border-gray-800 flex items-center gap-3 z-10 w-full">
        <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden shrink-0">
          <img src={`https://ui-avatars.com/api/?name=User&background=333&color=fff`} alt="Avatar" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 bg-transparent border-b border-gray-600 pb-1 text-gray-400 text-sm">
           Add a comment...
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment, isTopLevel = false }: { comment: any, isTopLevel?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!comment.author || comment.author === '[deleted]') return null; 
  
  const replies = comment.replies?.data?.children?.filter((c: any) => c.kind === 't1').map((c: any) => c.data) || [];
  
  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  const getTimeAgo = (createdUtc: number) => {
    if (!createdUtc) return '';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - createdUtc;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  };

  const timeAgo = getTimeAgo(comment.created_utc);
  
  return (
    <div className={`flex gap-3 px-4 py-4 ${!isTopLevel ? 'mt-1' : ''}`}>
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        <div className="w-10 h-10 rounded-full bg-[#F47521] flex items-center justify-center overflow-hidden">
           <img src={`https://ui-avatars.com/api/?name=${comment.author}&background=random&color=fff`} alt={comment.author} className="w-full h-full object-cover" />
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-bold text-white text-sm truncate">{comment.author}</span>
          <span className="text-gray-400 text-xs shrink-0">{timeAgo}</span>
        </div>
        
        <div className="text-white text-sm whitespace-pre-wrap leading-relaxed break-words mb-3" 
             dangerouslySetInnerHTML={{ __html: unescapeHtml(comment.body_html || comment.body) }} />
             
        {/* Actions */}
        <div className="flex items-center gap-6 text-gray-400">
           {/* Reply icon */}
           <svg className="w-5 h-5 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
           </svg>
           
           {/* Thumbs up */}
           <div className="flex items-center gap-1.5 cursor-pointer hover:text-white">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.514" />
             </svg>
             <span className="text-sm font-bold text-white">{formatNumber(comment.score)}</span>
           </div>
           
           {/* Dots */}
           <svg className="w-5 h-5 ml-auto cursor-pointer hover:text-white" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
           </svg>
        </div>
        
        {/* Replies Toggle */}
        {replies.length > 0 && !expanded && (
          <div className="mt-2 flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white" onClick={() => setExpanded(true)}>
            <div className="w-5 h-5 rounded-full border border-gray-400 flex items-center justify-center shrink-0">
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
               </svg>
            </div>
            <span className="text-sm font-medium">{replies.length} more {replies.length === 1 ? 'reply' : 'replies'}</span>
          </div>
        )}
        
        {/* Expanded Replies */}
        {expanded && replies.length > 0 && (
          <div className="mt-4 space-y-2">
            {replies.map((child: any) => (
              <CommentItem key={child.id} comment={child} isTopLevel={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function unescapeHtml(safe: string) {
  if (!safe) return '';
  return safe.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
}

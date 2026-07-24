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

  useEffect(() => {
    tryFetch();
  }, []);

  const tryFetch = () => {
    setLoading(true);
    setError(null);

    // Extract title and episode number from Crunchyroll DOM or document title
    const titleNode = document.querySelector('.show-title-link') || 
                      document.querySelector('h1.title') || 
                      document.querySelector('[data-t="show-title"]');
                      
    const episodeNode = document.querySelector('.current-media-title') || 
                        document.querySelector('h2.sub-title') ||
                        document.querySelector('[data-t="episode-title"]');
    
    let animeTitle = titleNode?.textContent?.trim() || '';
    let episodeString = episodeNode?.textContent?.trim() || '';
    
    if (!animeTitle) {
      const match = document.title.match(/Watch\s+(.*?)\s+-\s+Episode\s+(\d+)/i);
      if (match) {
        animeTitle = match[1];
        episodeString = match[2];
      }
    }

    let episodeNumber = episodeString.replace(/[^0-9]/g, '');

    chrome.runtime.sendMessage({ 
      type: 'FIND_THREAD', 
      payload: { animeTitle, episodeNumber } 
    }, (response) => {
      if (response?.success) {
        setThreadInfo({ title: response.threadTitle, url: response.threadUrl });
        parseComments(response.comments);
      } else {
        if (response?.error === 'THREAD_NOT_FOUND') {
          setError(`No r/anime discussion thread found for "${animeTitle || 'this show'}" Episode ${episodeNumber || ''}.`);
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
          .map((child: any) => child.data);
        setComments(parsed);
      }
    } catch (e) {
      setError('Could not parse comments.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#141519] text-gray-200 p-6 mt-8 rounded-lg shadow-2xl border border-gray-800 font-sans">
      <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[#F47521]">Reddit Discussion</h2>
          <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 tracking-wider">r/anime</span>
        </div>
        {threadInfo && (
          <a href={threadInfo.url} target="_blank" rel="noreferrer" className="text-xs text-[#F47521] hover:underline font-medium">
            View on Reddit ↗
          </a>
        )}
      </div>
      
      {loading && (
        <div className="flex items-center gap-2 text-gray-400 py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#F47521] border-t-transparent"></div>
          <span>Searching r/anime for episode thread...</span>
        </div>
      )}

      {!loading && error && (
        <div className="text-gray-400 text-sm p-4 bg-gray-900/50 rounded border border-gray-800 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={tryFetch} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded transition">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {comments.length === 0 ? (
            <p className="text-gray-500">No comments found in this thread yet.</p>
          ) : (
            comments.map(c => <CommentItem key={c.id} comment={c} />)
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment }: { comment: any }) {
  if (!comment.author || comment.author === '[deleted]') return null; 
  return (
    <div className="flex flex-col border-l-2 border-gray-700 hover:border-gray-500 transition-colors pl-4 py-2 my-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-gray-300 text-sm">{comment.author}</span>
        <span className="text-xs text-gray-500 font-medium bg-gray-800 px-1.5 py-0.5 rounded">{comment.score} pts</span>
      </div>
      <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed prose prose-invert max-w-none" 
           dangerouslySetInnerHTML={{ __html: unescapeHtml(comment.body_html || comment.body) }} />
      {comment.replies && comment.replies.data && comment.replies.data.children.length > 0 && (
        <div className="mt-3">
          {comment.replies.data.children.map((child: any) => {
            if (child.kind !== 't1') return null;
            return <CommentItem key={child.data.id} comment={child.data} />;
          })}
        </div>
      )}
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

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../components/App';
import '../assets/tailwind.css';

export default defineContentScript({
  matches: ['*://*.crunchyroll.com/watch/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'crunchyroll-reddit-comments',
      position: 'inline',
      anchor: () => {
        return document.querySelector('.erc-series-description') || 
               document.querySelector('.video-player-wrapper') || 
               document.body;
      },
      append: 'after',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});

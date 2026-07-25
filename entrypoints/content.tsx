import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../components/App';
import '../assets/tailwind.css';

export default defineContentScript({
  matches: ['*://*.crunchyroll.com/watch/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Poll until an element appears (same strategy as reference CrunchyComments extension)
    const waitForElement = (selector: string, timeout = 30000): Promise<Element | null> => {
      return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          const el = document.querySelector(selector);
          if (el) { resolve(el); return; }
          if (Date.now() - start > timeout) { resolve(null); return; }
          requestAnimationFrame(check);
        };
        check();
      });
    };

    // Wait for the actual watch page content to render
    console.log('[Reddit Extension] Waiting for Crunchyroll page to load...');
    const showTitle = await waitForElement('a[href*="/series/"], [data-t="show-title"]');
    
    if (!showTitle) {
      console.warn('[Reddit Extension] Page did not load in time.');
      return;
    }

    console.log('[Reddit Extension] Page loaded. Show title:', showTitle.textContent?.trim());
    await new Promise(r => setTimeout(r, 1000));

    // Inject INSIDE the content area as its last child.
    // This puts comments below the video + description, above the footer,
    // without disrupting the flex layout that has the video on left and episode list on right.
    let contentArea = document.querySelector('[class*="app-layout__content"]');
    
    if (!contentArea) {
      // Fallback: try page-wrapper (reference extension approach)
      contentArea = document.querySelector('[class*="page-wrapper--"]');
    }
    
    if (!contentArea) {
      contentArea = document.body;
    }

    console.log('[Reddit Extension] Injecting into:', contentArea.tagName, contentArea.className?.slice(0, 60));

    const ui = await createShadowRootUi(ctx, {
      name: 'crunchyroll-reddit-comments',
      position: 'inline',
      anchor: () => contentArea as Element,
      append: 'last', // Append as last child of content area
      onMount: (container) => {
        container.style.display = 'block';
        container.style.width = '100%';
        container.style.maxWidth = '960px';
        container.style.margin = '20px auto';
        container.style.padding = '0 20px';
        container.style.boxSizing = 'border-box';

        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
    console.log('[Reddit Extension] Comment section mounted.');
  },
});

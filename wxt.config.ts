import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Crunchyroll Reddit Comments',
    description: 'Replaces Crunchyroll comments with Reddit episode discussion threads.',
    permissions: ['identity', 'storage'],
    host_permissions: [
      'https://*.reddit.com/*',
      'https://oauth.reddit.com/*'
    ],
  },
});

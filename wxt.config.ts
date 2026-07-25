import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Crunchyroll Reddit Comments',
    description: 'Replaces Crunchyroll comments with Reddit episode discussion threads.',
    permissions: ['storage'],
    host_permissions: [
      'https://*.reddit.com/*',
      'https://api.pullpush.io/*'
    ],
  },
});

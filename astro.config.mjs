import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.fahamlaw.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    sitemap({
      filter: (page) => !/\/(admin|thank-you|404)(\/|$)/.test(page),
    }),
  ],
});

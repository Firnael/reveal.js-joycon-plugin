import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/plugin.ts'),
      name: 'reveal.js - The Joy Con plugin',
      fileName: 'joycon-plugin',
    },
  }
})
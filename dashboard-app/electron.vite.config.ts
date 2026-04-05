import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: ['sharp', '@marsaud/smb2', 'electron-store', 'googleapis', 'google-auth-library']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      outDir: 'out/preload'
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    build: {
      outDir: 'out/renderer'
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // base ต้องตรงกับชื่อ Repository บน GitHub
  base: '/ig342Final-Project/', 
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'IG342 Beatdown PWA',
        short_name: 'Beatdown',
        description: 'เกมเต้นจังหวะนีออน 1P และ 2P',
        theme_color: '#ffffff',
        start_url: '/ig342Final-Project/', // เพิ่มเพื่อให้ PWA เปิดถูกหน้า
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192', // แก้ให้ตรงกับชื่อไฟล์
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
        ]
      }
    })
  ]
})
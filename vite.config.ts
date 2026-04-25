import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 12000,
    strictPort: true, // 如果 12000 端口被占用，直接退出而不是尝试下一个端口
    proxy: {
      '/open-apis': {
        target: 'https://open.feishu.cn',
        changeOrigin: true,
      },
    },
  },
})

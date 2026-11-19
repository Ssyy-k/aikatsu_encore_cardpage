import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' → 빌드 결과물을 어떤 경로(GitHub Pages, Netlify 하위 폴더 등)에 올려도 동작합니다.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // 같은 Wi-Fi의 휴대폰에서도 접속해 테스트할 수 있도록
  },
});

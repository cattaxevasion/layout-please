import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// GitHub Pages는 https://<사용자>.github.io/<저장소>/ 아래에서 서비스되므로 base를 저장소 이름에 맞춘다.
// 다른 경로로 배포할 때는 BASE_PATH 환경변수로 덮어쓴다.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/layout-please/',
  plugins: [preact()],
  build: {
    // three.js 묶음(3D 뷰를 열 때만 불러옴)이 500kB를 조금 넘는다
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

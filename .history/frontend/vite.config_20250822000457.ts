/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

function getPlugins() {
  const plugins = [react(), tsconfigPaths()];
  return plugins;
}

export default defineConfig({
  plugins: getPlugins(),
  server: {
    proxy: {
      '/api': {
        target: '', // 👈 你的 FastAPI 后端地址
        changeOrigin: true,              // 允许跨域
        secure: false,                   // 不验证 HTTPS 证书
      },
    },
    port: 3000, // 前端运行在 3000
  },
});

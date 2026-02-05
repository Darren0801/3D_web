import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 配置路径别名（保留原有，方便@/导入）
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  // 核心配置：添加.glb到静态资产识别列表
  assetsInclude: ['**/*.glb'] 
})
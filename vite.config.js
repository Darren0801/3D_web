import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // 1. 强制识别glb为静态资产
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  // 2. 配置服务器，对glb文件返回正确的Content-Type
  server: {
    mimeTypes: {
      '**/*.glb': 'model/gltf-binary', // glb的标准MIME类型
      '**/*.gltf': 'model/gltf+json'
    }
  },
  // 3. 构建时不解析glb文件，原封不动输出
  build: {
    assetsInlineLimit: 0, // 所有资产不内联，保证glb单独输出
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})
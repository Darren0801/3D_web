<template>
  <!-- 承载3D渲染的画布容器，设置宽高 -->
  <div id="3d-model-container" style="width: 800px; height: 600px; margin: 20px auto;"></div>
</template>

<script setup>
import * as THREE from 'three'
import { onMounted, onUnmounted } from 'vue'

// 声明全局变量，用于控制场景、相机、渲染器、模型等
let scene, camera, renderer, model, animationId

onMounted(() => {
  init3DScene() // 初始化3D场景
  load3DModel() // 加载3D模型
  animate()     // 启动逐帧渲染（实现旋转）
  // 监听窗口大小变化，自适应画布
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  // 销毁资源，防止内存泄漏
  window.removeEventListener('resize', onWindowResize)
  cancelAnimationFrame(animationId)
  renderer.dispose()
  scene.clear()
})

// 1. 初始化3D场景（三要素：场景、相机、渲染器）
function init3DScene() {
  // 创建场景：所有3D元素的容器
  scene = new THREE.Scene()
  // 设置场景背景色
  scene.background = new THREE.Color(0xf5f5f5)

  // 创建透视相机（模拟人眼视角，参数：视角FOV、宽高比、近裁剪面、远裁剪面）
  const container = document.getElementById('3d-model-container')
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)
  // 设置相机位置（x,y,z），需远离模型才能看到
  camera.position.set(0, 2, 5)

  // 创建渲染器：将3D场景渲染到2D画布
  renderer = new THREE.WebGLRenderer({ antialias: true }) // antialias: 抗锯齿，让模型边缘更平滑
  renderer.setSize(container.clientWidth, container.clientHeight) // 设置渲染器大小
  container.appendChild(renderer.domElement) // 将渲染器的画布添加到页面容器

  // 添加环境光：让模型整体亮度均匀，避免局部过暗
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)

  // 添加方向光：增强模型立体感（可选）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
  directionalLight.position.set(5, 10, 7)
  scene.add(directionalLight)
}

// 2. 加载3D模型（主流glTF/GLB格式，Three.js内置GLTFLoader）
function load3DModel() {
  const loader = new THREE.GLTFLoader()
  // 替换为你的模型路径（public目录下直接写路径，如：/models/robot.glb）
  loader.load(
    '/models/your-model.glb', // 模型文件路径
    (gltf) => {
      // 加载成功，获取模型对象
      model = gltf.scene
      // 调整模型大小（根据实际情况缩放，1为原始大小）
      model.scale.set(1, 1, 1)
      // 调整模型位置（让模型居中显示）
      model.position.set(0, 0, 0)
      // 将模型添加到场景
      scene.add(model)
      console.log('模型加载成功')
    },
    (progress) => {
      // 加载进度回调（可选）
      const percent = (progress.loaded / progress.total) * 100
      console.log(`模型加载中：${percent.toFixed(1)}%`)
    },
    (error) => {
      // 加载失败回调
      console.error('模型加载失败：', error)
    }
  )
}

// 3. 逐帧渲染 + 模型旋转核心逻辑
function animate() {
  // 请求下一帧渲染，形成循环（浏览器原生API，保证60帧/秒）
  animationId = requestAnimationFrame(animate)
  
  // 模型加载完成后，逐帧修改旋转角度（实现平滑旋转）
  if (model) {
    // y轴旋转（左右转），0.01为旋转速度，值越大转得越快
    model.rotation.y += 0.01
    // 可选：x轴旋转（上下转）
    // model.rotation.x += 0.005
    // 可选：z轴旋转（侧翻）
    // model.rotation.z += 0.002
  }

  // 将场景和相机渲染到画布
  renderer.render(scene, camera)
}

// 4. 窗口大小自适应（可选，保证画布响应式）
function onWindowResize() {
  const container = document.getElementById('3d-model-container')
  // 更新相机宽高比
  camera.aspect = container.clientWidth / container.clientHeight
  camera.updateProjectionMatrix() // 相机参数更新后必须调用
  // 更新渲染器大小
  renderer.setSize(container.clientWidth, container.clientHeight)
}
</script>
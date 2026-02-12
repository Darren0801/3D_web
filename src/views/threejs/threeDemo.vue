<template>
  <div id="threeDemo"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// 定义全局变量，用于卸载时清理资源
let scene = null
let camera = null
let renderer = null
let controls = null
let animationId = null

onMounted(() => {
  // 1 创建3D场景对象Scene
  scene = new THREE.Scene()
  const width = window.innerWidth // 宽度
  const height = window.innerHeight  // 高度

  // 2 创建相机（关键修复：相机不需要添加到场景）
  // 30:视场角度, width / height:Canvas画布宽高比, 1:近裁截面, 3000：远裁截面
  camera = new THREE.PerspectiveCamera(30, width / height, 1, 3000)
  camera.position.set(200, 200, 200)
  camera.lookAt(0, 0, 0)

  // 3 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  // 开启阴影渲染（保留你的配置）
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // 挂载到DOM
  document.getElementById('threeDemo').appendChild(renderer.domElement)

  // 4 创建轨道控制器（优化：无需手动监听change事件，controls会自动处理）
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true // 开启阻尼，操作更顺滑
  controls.dampingFactor = 0.05

  // 5 创建辅助坐标系（保留）
  const axesHelper = new THREE.AxesHelper(150)
  scene.add(axesHelper)

  // 6 创建立方体（你的原有代码，调整位置让阴影可见）
  const geometry = new THREE.BoxGeometry(50, 50, 50)
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const mesh = new THREE.Mesh(geometry, material)
  // 调整位置：立方体底部刚好在地面（y=0）上（立方体中心y=25，边长50）
  mesh.position.set(100, 100, 0)
  mesh.castShadow = true // 立方体投射阴影（保留）
  scene.add(mesh)

  // 7 新增：创建地面（必须！阴影需要接收的载体）
  const planeGeometry = new THREE.PlaneGeometry(300, 300) // 地面尺寸
  const planeMaterial = new THREE.MeshLambertMaterial({ color: 0x999999 }) // 灰色地面
  const plane = new THREE.Mesh(planeGeometry, planeMaterial)
  plane.rotation.x = -Math.PI / 2 // 旋转为水平
  plane.position.y = 0 // 地面在y=0位置
  plane.receiveShadow = true // 地面接收阴影（核心！）
  scene.add(plane)

  // 8 环境光（修复颜色值错误：0xffff → 0xffffff）
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3) // 降低强度，突出平行光
  scene.add(ambientLight)

  // 9 平行光（你的原有配置，补充到场景）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(200, 400, 300)
  // 平行光投射阴影（保留你的配置）
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.set(4096,4096) 
  directionalLight.shadow.camera.left = -500
  directionalLight.shadow.camera.right = 500
  directionalLight.shadow.camera.top = 500
  directionalLight.shadow.camera.bottom = -500
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 1000
  // 可选：显示平行光阴影相机范围（调试用，可删除）
  // const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera)
  // scene.add(shadowHelper)
  scene.add(directionalLight)
  const clock = new THREE.Clock()
  // 10 动画循环（核心！确保渲染持续更新，控制器/阴影正常显示）
  const animate = () => {
    const deleayTime = clock.getElapsedTime()
    animationId = requestAnimationFrame(animate)
    controls.update() // 更新轨道控制器
    mesh.position.x = Math.sin(deleayTime) * 40
    mesh.position.z = Math.cos(deleayTime) * 40
    // mesh.position.y = Math.sin(deleayTime) * 40
    // mesh.rotation.x += 0.02
    // mesh.rotation.y += 0.01
    renderer.render(scene, camera)
  }
  animate()
})

onBeforeUnmount(() => {
  // 清理资源，避免内存泄漏
  if (animationId) cancelAnimationFrame(animationId)
  if (controls) controls.dispose()
  if (renderer) {
    renderer.dispose()
    const container = document.getElementById('threeDemo')
    if (container && renderer.domElement) {
      container.removeChild(renderer.domElement)
    }
  }
  scene = null
  camera = null
  renderer = null
  controls = null
})
</script>

<style scoped>
#threeDemo {
  /* 可选：给容器加背景，方便观察 */
  background-color: #f8f8f8;
}
</style>
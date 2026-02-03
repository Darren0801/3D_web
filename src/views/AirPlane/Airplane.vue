<template>
  <div id="plane-container" class="plane-shell"></div>
</template>

<script setup>
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { onMounted, onUnmounted, ref } from 'vue'

// 确保路径指向你的模型文件
import airModelUrl from './3Dmodel/Cesium_Air.glb?url'

let scene, camera, renderer
let model = null
let animationId = null
let clock
let trailGeometry = null
let trailLine = null

// --- 配置参数 ---
const cruiseSpeedPerFrame = 0.5
const landingSpeedPerFrame = 0.2
// 侧面视角相机偏移
const cameraOffset = new THREE.Vector3(0, 15, 80)
const trailColor = 0x00ffff

// 鼠标交互
let isDragging = false
let dragStart = { x: 0, y: 0 }
let orbitYaw = 0
let orbitPitch = 0

const isReady = ref(false)

onMounted(() => {
  initScene()
  loadModel()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(animationId)
  renderer?.dispose()
  scene?.clear()
  if (trailGeometry) trailGeometry.dispose()
})

function initScene() {
  const container = document.getElementById('plane-container')
  const width = container?.clientWidth || 800
  const height = container?.clientHeight || 600

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050810) 

  camera = new THREE.PerspectiveCamera(50, width / height, 1, 5000)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  container?.appendChild(renderer.domElement)

  bindDrag(container)

  scene.add(new THREE.AmbientLight(0xffffff, 1.2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.5)
  sun.position.set(100, 200, 100)
  scene.add(sun)

  const grid = new THREE.GridHelper(2000, 50, 0x1e293b, 0x0f172a)
  scene.add(grid)

  clock = new THREE.Clock()
}

function loadModel() {
  const loader = new GLTFLoader()
  loader.load(airModelUrl, (gltf) => {
    model = gltf.scene
    model.scale.set(1.5, 1.5, 1.5)
    scene.add(model)
    isReady.value = true
    startFlyA2B()
  })
}

function startFlyA2B() {
  if (!model) return
  cancelAnimationFrame(animationId)
  clock.start()

  // --- 轨迹初始化 ---
  if (trailLine) scene.remove(trailLine)
  const maxPoints = 20000 
  trailGeometry = new THREE.BufferGeometry()
  const positions = new Float32Array(maxPoints * 3)
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  trailGeometry.setDrawRange(0, 0)
  
  trailLine = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ 
    color: trailColor, 
    transparent: true, 
    opacity: 0.9,
    linewidth: 3 
  }))
  trailLine.frustumCulled = false 
  scene.add(trailLine)
  
  let pointCount = 0

  const recordPos = () => {
    if (!model || pointCount >= maxPoints) return
    const attr = trailGeometry.attributes.position
    attr.setXYZ(pointCount, model.position.x, model.position.y, model.position.z)
    pointCount++
    trailGeometry.setDrawRange(0, pointCount)
    attr.needsUpdate = true
    trailGeometry.computeBoundingSphere()
  }

  // --- 航线坐标（已缩短匀速距离） ---
  const startPos = new THREE.Vector3(0, 0, 0)
  const takeoffEnd = new THREE.Vector3(80, 40, 0)   // 起飞终点
  const cruiseEnd = new THREE.Vector3(180, 40, 0)  // 巡航终点（从400缩短到180）
  const landingEnd = new THREE.Vector3(260, 0, 0)  // 降落终点

  let phase = 'takeoff'
  const takeoffDuration = 3.5 

  const animateFrame = () => {
    animationId = requestAnimationFrame(animateFrame)
    const elapsed = clock.getElapsedTime()

    if (phase === 'takeoff') {
      const t = Math.min(elapsed / takeoffDuration, 1)
      model.position.lerpVectors(startPos, takeoffEnd, t)
      model.rotation.set(0, Math.PI / 2, 0)
      model.rotation.x = -Math.sin(t * Math.PI) * 0.3 
      
      if (t >= 1) { phase = 'cruise'; clock.start() }
    } 
    else if (phase === 'cruise') {
      const dir = new THREE.Vector3().subVectors(cruiseEnd, model.position)
      if (dir.length() < cruiseSpeedPerFrame) {
        model.position.copy(cruiseEnd)
        phase = 'landing'
        clock.start()
      } else {
        model.position.add(dir.normalize().multiplyScalar(cruiseSpeedPerFrame))
        model.rotation.set(0, Math.PI / 2, 0)
      }
    } 
    else if (phase === 'landing') {
      const dir = new THREE.Vector3().subVectors(landingEnd, model.position)
      const dist = dir.length()
      if (dist < landingSpeedPerFrame) {
        model.position.copy(landingEnd)
        model.rotation.set(0, Math.PI / 2, 0)
        phase = 'done'
      } else {
        model.position.add(dir.normalize().multiplyScalar(landingSpeedPerFrame))
        model.rotation.set(0, Math.PI / 2, 0.15) 
      }
    }

    recordPos()
    updateCamera(model.position)
    renderer.render(scene, camera)
  }

  animateFrame()
}

function updateCamera(target) {
  if (!camera) return
  const relativeOffset = cameraOffset.clone()
  const euler = new THREE.Euler(orbitPitch, orbitYaw, 0, 'YXZ')
  relativeOffset.applyQuaternion(new THREE.Quaternion().setFromEuler(euler))
  camera.position.copy(target.clone().add(relativeOffset))
  camera.lookAt(target)
}

function bindDrag(container) {
  const onMouseDown = (e) => { isDragging = true; dragStart.x = e.clientX; dragStart.y = e.clientY }
  const onMouseMove = (e) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    dragStart.x = e.clientX; dragStart.y = e.clientY
    orbitYaw -= dx * 0.005
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * 0.005, -Math.PI / 3, Math.PI / 3)
  }
  const onMouseUp = () => isDragging = false
  container.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onResize() {
  const container = document.getElementById('plane-container')
  if (!container || !camera || !renderer) return
  const width = container.clientWidth
  const height = container.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}
</script>

<style scoped>
.plane-shell {
  width: 100%;
  height: calc(100vh - 80px);
  background: radial-gradient(circle at 50% 50%, #111827, #000);
  border-radius: 12px;
  overflow: hidden;
}
</style>
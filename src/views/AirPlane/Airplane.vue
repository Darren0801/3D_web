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
const cruiseSpeed = 40
const landingSpeed = 20
const maxDelta = 0.05
// 侧面视角相机偏移
const cameraOffset = new THREE.Vector3(0, 15, 80)
const trailColor = 0x00ffff
const cameraDamping = 10
const lookAtDamping = 12

// 鼠标交互
let isDragging = false
let dragStart = { x: 0, y: 0 }
let orbitYaw = 0
let orbitPitch = 0

let smoothedCameraPos = new THREE.Vector3()
let smoothedLookAt = new THREE.Vector3()

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

  const takeoffCurve = new THREE.CatmullRomCurve3(
    [
      startPos.clone(),
      new THREE.Vector3(30, 5, -10),
      new THREE.Vector3(55, 22, 10),
      takeoffEnd.clone(),
    ],
    false,
    'centripetal'
  )
  const landingCurve = new THREE.CatmullRomCurve3(
    [
      cruiseEnd.clone(),
      new THREE.Vector3(210, 45, 0),
      new THREE.Vector3(235, 18, 5),
      landingEnd.clone(),
    ],
    false,
    'centripetal'
  )

  const setOrientationByMotion = (from, to) => {
    if (!model) return
    const dir = to.clone().sub(from)
    if (dir.lengthSq() < 1e-8) return
    const forward = dir.normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward)
    model.quaternion.slerp(q, 0.25)
  }

  let cruiseTarget = cruiseEnd.clone()

  let trailTimeAcc = 0
  const trailRecordInterval = 1 / 30

  const animateFrame = () => {
    animationId = requestAnimationFrame(animateFrame)
    const dt = Math.min(clock.getDelta(), maxDelta)
    const elapsed = clock.getElapsedTime()

    if (phase === 'takeoff') {
      const t = Math.min(elapsed / takeoffDuration, 1)
      const p = takeoffCurve.getPoint(t)
      model.position.copy(p)
      const pAhead = takeoffCurve.getPoint(Math.min(t + 0.002, 1))
      setOrientationByMotion(p, pAhead)
      model.rotation.x += (-Math.sin(t * Math.PI) * 0.25 - model.rotation.x) * 0.12
      
      if (t >= 1) { phase = 'cruise'; clock.start() }
    } 
    else if (phase === 'cruise') {
      const dir = new THREE.Vector3().subVectors(cruiseTarget, model.position)
      const dist = dir.length()
      const step = cruiseSpeed * dt
      if (dist <= step) {
        const prev = model.position.clone()
        model.position.copy(cruiseTarget)
        setOrientationByMotion(prev, model.position)
        phase = 'landing'
        clock.start()
      } else {
        const prev = model.position.clone()
        model.position.add(dir.normalize().multiplyScalar(step))
        setOrientationByMotion(prev, model.position)
      }
    } 
    else if (phase === 'landing') {
      const landingDuration = Math.max(landingCurve.getLength() / landingSpeed, 0.01)
      const t = Math.min(elapsed / landingDuration, 1)
      const p = landingCurve.getPoint(t)
      const prev = model.position.clone()
      model.position.copy(p)
      const pAhead = landingCurve.getPoint(Math.min(t + 0.003, 1))
      setOrientationByMotion(prev, pAhead)
      model.rotation.x += (0.08 - model.rotation.x) * 0.08

      if (t >= 1) {
        model.position.copy(landingEnd)
        phase = 'done'
      }
    }

    trailTimeAcc += dt
    if (trailTimeAcc >= trailRecordInterval) {
      trailTimeAcc = 0
      recordPos()
    }
    updateCamera(model.position, dt)
    renderer.render(scene, camera)
  }

  animateFrame()
}

function updateCamera(target, dt = 0.016) {
  if (!camera) return
  const relativeOffset = cameraOffset.clone()
  const euler = new THREE.Euler(orbitPitch, orbitYaw, 0, 'YXZ')
  relativeOffset.applyQuaternion(new THREE.Quaternion().setFromEuler(euler))

  const desiredPos = target.clone().add(relativeOffset)
  if (smoothedCameraPos.lengthSq() === 0) {
    smoothedCameraPos.copy(desiredPos)
    smoothedLookAt.copy(target)
  }

  const camAlpha = 1 - Math.exp(-cameraDamping * dt)
  const lookAlpha = 1 - Math.exp(-lookAtDamping * dt)
  smoothedCameraPos.lerp(desiredPos, camAlpha)
  smoothedLookAt.lerp(target, lookAlpha)

  camera.position.copy(smoothedCameraPos)
  camera.lookAt(smoothedLookAt)
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
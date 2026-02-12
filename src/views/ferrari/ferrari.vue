<template>
  <div class="ferrari-show-container">
    <div class="ferrari-scene" ref="containerRef"></div>
    <div class="control-panel">
      <h3>法拉利3D模型控制</h3>
      <div class="control-item">
        <label>模型移动速度：</label>
        <input v-model.number="moveSpeed" type="range" min="0" max="0.2" step="0.005">
      </div>
      <div class="control-item">
        <label>车轮旋转速度：</label>
        <input v-model.number="wheelSpeedRatio" type="range" min="0.5" max="3" step="0.1">
      </div>
      <div class="control-group">
        <button @click="toggleMove">
          {{ isMoving ? '停止移动' : '开始移动' }}
        </button>
        <button @click="resetScene">重置视角</button>
      </div>
      <div class="tip">左键旋转/滚轮缩放/右键平移<br>相机已锁定跟随模型</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
// 导入控制器、模型加载器
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

// 导入法拉利模型
import ferrariModelUrl from '../../assets/3Dmodel/ferrari.glb'

// ===================== 1. 响应式状态 =====================
const containerRef = ref(null)
// 模型控制
const moveSpeed = ref(0.05) // 略微增加默认移动速度
const wheelSpeedRatio = ref(1.2)
const isMoving = ref(false)

// Three.js核心对象
let scene, camera, renderer, controls, clock = null
// 对象引用
let ferrariModel = null
const wheels = [] // 存储4个车轮对象
let spotlightTarget = null // 聚光灯目标
let spotLight1, spotLight2 = null // 跟随车身的灯光

// ===================== 2. 工具函数封装 =====================
const loadFerrariModel = (url) => {
  return new Promise((resolve, reject) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/')

    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)
    gltfLoader.load(
      url,
      (gltf) => {
        const model = gltf.scene
        model.name = 'ferrari'
        // 【修改点1】放大模型 (0.15 -> 0.45)
        model.scale.set(0.45, 0.45, 0.45)
        model.position.set(0, 0, 0)

        const wheelReg = /wheel|Wheel|轮胎|车轮/i
        model.traverse((child) => {
          if (child.isMesh && wheelReg.test(child.name)) {
            wheels.push(child)
            child.castShadow = true
          }
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
            if (child.material) {
              child.material.metalness = child.material.metalness || 0.85
              child.material.roughness = child.material.roughness || 0.15
            }
          }
        })
        resolve(model)
      },
      undefined,
      (error) => reject(`模型加载失败：${error.message}`)
    )
  })
}

/** 车轮物理滚动计算 */
const wheelRoll = (moveDistance) => {
  // 随着模型变大，车轮半径在视觉上也变大了，需要调整物理计算的分母
  // 原半径假设0.12，放大3倍后约为 0.36
  const wheelRadius = 0.36
  const rollAngle = (moveDistance / (2 * Math.PI * wheelRadius)) * 2 * Math.PI * wheelSpeedRatio.value
  wheels.forEach((wheel) => {
    wheel.rotation.x += rollAngle
  })
}

// ===================== 3. 初始化场景 =====================
async function initFerrariScene() {
  const container = containerRef.value
  if (!container) return
  clock = new THREE.Clock()

  // 1. 场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a1a)
  scene.fog = new THREE.Fog(0x0a0a1a, 10, 50) // 调整雾化距离适配大模型

  // 2. 相机
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 200)
  // 调整初始相机位置，适应更大的模型
  camera.position.set(0, 5, 10)
  camera.lookAt(0, 0, 0)

  // 3. 渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  container.appendChild(renderer.domElement)

  // 4. 控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2 - 0.1
  controls.minDistance = 3 // 最小距离增大
  controls.maxDistance = 30
  controls.target.set(0, 1.5, 0) // 目标点抬高

  // 5. 加载模型
  try {
    ferrariModel = await loadFerrariModel(ferrariModelUrl)
    scene.add(ferrariModel)
  } catch (error) {
    console.error(error)
  }

  // 6. 地面 (放大地面以适应奔跑)
  const planeGeometry = new THREE.PlaneGeometry(200, 200)
  const planeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111122,
    metalness: 0.9,
    roughness: 0.1,
    side: THREE.DoubleSide
  })
  const ground = new THREE.Mesh(planeGeometry, planeMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.1 // 略微调整地面高度
  ground.receiveShadow = true
  // 注意：我们不把地面加入到“移动循环”中，地面是静止的参照物，车在上面跑
  scene.add(ground)

  // 7. 灯光系统
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)

  // 聚光灯目标 (需要随车移动)
  spotlightTarget = new THREE.Object3D()
  spotlightTarget.position.set(0, 1.5, 0)
  scene.add(spotlightTarget)

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
  dirLight.position.set(20, 30, 20)
  dirLight.castShadow = true
  // 扩大阴影范围
  dirLight.shadow.camera.left = -50
  dirLight.shadow.camera.right = 50
  dirLight.shadow.camera.top = 50
  dirLight.shadow.camera.bottom = -50
  scene.add(dirLight)

  // 车身跟随光1
  spotLight1 = new THREE.SpotLight(0xffddaa, 1, 50, Math.PI / 5, 0.3)
  spotLight1.position.set(10, 10, 0)
  spotLight1.target = spotlightTarget
  spotLight1.castShadow = true
  scene.add(spotLight1)

  // 车身跟随光2
  spotLight2 = new THREE.SpotLight(0xaaaaff, 1, 50, Math.PI / 5, 0.3)
  spotLight2.position.set(-10, 10, 0)
  spotLight2.target = spotlightTarget
  spotLight2.castShadow = true
  scene.add(spotLight2)

  animate()
}

// ===================== 4. 动画循环 (核心逻辑修改) =====================
function animate() {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()
  controls.update()

  if (isMoving.value && ferrariModel) {
    // 计算移动距离
    const moveStep = moveSpeed.value * delta * 60

    // 1. 模型移动
    ferrariModel.position.z += moveStep

    // 2. 【核心修改】相机跟随
    // 相机位置增加相同的移动量
    camera.position.z += moveStep
    // 控制器目标点也要跟随模型移动
    controls.target.z += moveStep

    // 3. 灯光跟随 (防止车跑远了变黑)
    spotlightTarget.position.z += moveStep
    spotLight1.position.z += moveStep
    spotLight2.position.z += moveStep

    // 4. 车轮滚动
    wheelRoll(moveStep)

    // 5. 无限循环逻辑 (同步重置所有对象)
    // 当车跑出50米远时，把所有东西（车、相机、灯）都瞬移回原点
    if (ferrariModel.position.z > 50) {
      const resetDistance = 100 // 向回跳跃的距离 (50 -> -50)
      
      ferrariModel.position.z -= resetDistance
      
      camera.position.z -= resetDistance
      controls.target.z -= resetDistance
      
      spotlightTarget.position.z -= resetDistance
      spotLight1.position.z -= resetDistance
      spotLight2.position.z -= resetDistance
    }
  }

  renderer.render(scene, camera)
}

// ===================== 5. 控制方法 =====================
const toggleMove = () => {
  isMoving.value = !isMoving.value
}

const resetScene = () => {
  isMoving.value = false
  // 重置位置到原点
  const currentZ = ferrariModel ? ferrariModel.position.z : 0
  const offset = -currentZ

  if (ferrariModel) ferrariModel.position.z = 0
  
  // 相机归位
  camera.position.set(0, 5, 10)
  controls.target.set(0, 1.5, 0)
  controls.update()

  // 灯光归位
  if (spotlightTarget) spotlightTarget.position.set(0, 1.5, 0)
  if (spotLight1) spotLight1.position.set(10, 10, 0)
  if (spotLight2) spotLight2.position.set(-10, 10, 0)

  // 车轮归位
  wheels.forEach((wheel) => (wheel.rotation.x = 0))
}

const handleResize = () => {
  const container = containerRef.value
  if (!container || !camera || !renderer) return
  camera.aspect = container.clientWidth / container.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.clientWidth, container.clientHeight)
}

// ===================== 6. 生命周期 =====================
onMounted(() => {
  initFerrariScene()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (!scene || !renderer) return
  window.removeEventListener('resize', handleResize)
  if (controls) controls.dispose()
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose()
      if (obj.material.map) obj.material.map.dispose()
      obj.material.dispose()
    }
  })
  renderer.dispose()
  renderer.domElement.remove()
  scene = null
})
</script>

<style scoped>
.ferrari-show-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background-color: #0a0a1a;
}
.ferrari-scene { width: 100%; height: 100%; }

.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(15, 15, 30, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 24px;
  border-radius: 12px;
  z-index: 100;
  min-width: 280px;
}
.control-panel h3 {
  margin: 0 0 20px 0;
  color: #ff2d55;
  font-size: 18px;
  text-align: center;
}
.control-item {
  margin: 18px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}
.control-item input[type="range"] {
  flex: 1;
  accent-color: #ff2d55;
}
.control-group {
  display: flex;
  gap: 10px;
  margin: 20px 0 10px 0;
}
.control-group button {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: #ff2d55;
  color: #ffffff;
}
.control-group button:hover { background: #ff5a7f; }
.tip {
  margin-top: 15px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}
</style>
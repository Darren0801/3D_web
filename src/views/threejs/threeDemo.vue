<template>
  <div class="three-advanced-container">
    <!-- Three.js画布容器 -->
    <div class="three-scene" ref="containerRef"></div>
    <!-- Vue状态联动控制面板 -->
    <div class="control-panel">
      <h3>3D场景控制面板</h3>
      <div class="control-item">
        <label>立方体旋转速度：</label>
        <input
          type="range"
          v-model.number="cubeRotateSpeed"
          min="0"
          max="0.05"
          step="0.001"
        >
        <span>{{ cubeRotateSpeed }}</span>
      </div>
      <div class="control-item">
        <label>场景雾化：</label>
        <input
          type="checkbox"
          v-model="isFogEnable"
          @change="toggleFog"
        >
      </div>
      <div class="control-item">
        <button @click="resetScene">重置场景视角</button>
        <button @click="toggleModelShow" :class="{ active: isModelShow }">
          {{ isModelShow ? '隐藏模型' : '显示模型' }}
        </button>
      </div>
      <div class="tip">点击3D物体可查看选中状态</div>
    </div>
    <!-- 选中物体提示 -->
    <div class="select-tip" v-if="selectObjName">{{ '选中：' + selectObjName }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
// 导入Three.js核心库
import * as THREE from 'three'
// 导入控制器和加载器（进阶核心：模型/纹理加载）
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { TextureLoader } from 'three/src/loaders/TextureLoader.js'

// ===================== 1. 基础引用和Vue响应式状态 =====================
// 画布容器DOM引用
const containerRef = ref(null)
// Vue响应式状态（联动3D场景，核心进阶点）
const cubeRotateSpeed = ref(0.01) // 立方体旋转速度
const isFogEnable = ref(true)     // 是否开启雾化
const isModelShow = ref(true)     // 外部模型是否显示
const selectObjName = ref('')     // 选中的3D物体名称
// Three.js核心对象（全局保存）
let scene, camera, renderer, controls, raycaster, mouse = null
// 3D物体对象（单独保存，方便操作）
let cube, plane, gltfModel = null
// 加载器实例（全局，避免重复创建）
const textureLoader = new TextureLoader()
const gltfLoader = new GLTFLoader()

// ===================== 2. 工具函数封装（模块化，进阶规范）=====================
/**
 * 加载纹理贴图（封装复用，处理加载失败）
 * @param {string} url 纹理路径
 * @returns {THREE.Texture} 纹理对象
 */
const loadTexture = (url) => {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        // 纹理平铺和拉伸设置（避免图片变形）
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(4, 4) // 平铺次数
        texture.needsUpdate = true
        resolve(texture)
      },
      (progress) => console.log('纹理加载中：', (progress.loaded / progress.total) * 100 + '%'),
      (error) => reject('纹理加载失败：' + error.message)
    )
  })
}

/**
 * 加载外部glTF模型（封装复用，统一缩放和位置）
 * @param {string} url 模型路径
 * @param {THREE.Vector3} position 模型位置
 * @param {number} scale 模型缩放比例
 * @returns {THREE.Object3D} 模型对象
 */
const loadGLTFModel = (url, position, scale = 1) => {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        const model = gltf.scene
        // 设置模型名称（用于点击识别）
        model.name = 'externalModel'
        // 统一缩放和位置
        model.scale.set(scale, scale, scale)
        model.position.copy(position)
        // 模型所有子物体开启阴影
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        resolve(model)
      },
      (progress) => console.log('模型加载中：', (progress.loaded / progress.total) * 100 + '%'),
      (error) => reject('模型加载失败：' + error.message)
    )
  })
}

/**
 * 射线检测：实现鼠标点击选中3D物体（进阶核心交互）
 */
const raycastSelect = (event) => {
  if (!raycaster || !mouse || !scene || !camera) return
  // 将鼠标坐标转为Three.js标准化设备坐标（NDC：-1 ~ 1）
  mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1
  mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
  // 更新射线检测的起点和方向（从相机到鼠标位置）
  raycaster.setFromCamera(mouse, camera)
  // 检测射线与场景中所有可交互物体的交集
  const intersects = raycaster.intersectObjects(scene.children, true)
  if (intersects.length > 0) {
    const selectObj = intersects[0].object
    // 取最顶层父物体名称（避免选中模型子部件）
    selectObjName.value = selectObj.parent.name || selectObj.name
  } else {
    selectObjName.value = '' // 未选中则清空
  }
}

// ===================== 3. 初始化Three.js进阶场景 =====================
async function initThree() {
  const container = containerRef.value
  if (!container) return

  // ---------- 1. 基础场景/相机/渲染器（优化进阶配置） ----------
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e) // 深色背景（更显光影）
  // 开启雾化（进阶视觉效果：随距离变模糊，增强空间感）
  if (isFogEnable.value) {
    scene.fog = new THREE.Fog(0x1a1a2e, 10, 30) // 雾化颜色/近距/远距
  }

  // 透视相机（优化近远裁剪面，提升性能）
  camera = new THREE.PerspectiveCamera(
    70,
    container.clientWidth / container.clientHeight,
    0.5, // 近裁剪面后移，减少检测范围
    50   // 远裁剪面前移，提升渲染性能
  )
  camera.position.set(3, 4, 8) // 调整视角，更适合多物体场景
  camera.lookAt(0, 0, 0)

  // 渲染器（新增抗锯齿级别、色调映射，提升画面质感）
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance' // 优先使用高性能GPU
  })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap // 软阴影（更真实，轻微性能损耗）
  renderer.toneMapping = THREE.ACESFilmicToneMapping // 色调映射，提升色彩表现
  renderer.toneMappingExposure = 1.2 // 曝光度
  container.appendChild(renderer.domElement)

  // ---------- 2. 轨道控制器（新增视角限制，优化交互） ----------
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2 - 0.1 // 限制上下旋转角度，避免俯视
  controls.minDistance = 3 // 最小缩放距离
  controls.maxDistance = 20 // 最大缩放距离
  controls.target.set(0, 0, 0) // 控制器旋转中心

  // ---------- 3. 射线检测初始化（鼠标点击交互核心） ----------
  raycaster = new THREE.Raycaster() // 射线检测器
  mouse = new THREE.Vector2()      // 鼠标坐标容器
  // 监听画布鼠标点击事件
  renderer.domElement.addEventListener('click', raycastSelect)

  // ---------- 4. 加载纹理并创建带贴图的3D物体（进阶：纹理贴图） ----------
  try {
    // 加载立方体和地面纹理（异步加载，避免阻塞）
    const cubeTexture = await loadTexture('/three-assets/cube-texture.jpg')
    const planeTexture = await loadTexture('/three-assets/plane-texture.jpg')

    // 带纹理的立方体（优化材质，添加凹凸贴图质感，基础版升级）
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2)
    const cubeMaterial = new THREE.MeshStandardMaterial({
      map: cubeTexture, // 基础颜色纹理
      metalness: 0.5,
      roughness: 0.2,
      side: THREE.DoubleSide // 双面渲染，避免纹理背面不可见
    })
    cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
    cube.name = 'cube' // 设置名称，用于点击识别
    cube.castShadow = true
    scene.add(cube)

    // 带纹理的地面（扩大尺寸，优化阴影接收）
    const planeGeometry = new THREE.PlaneGeometry(15, 15)
    const planeMaterial = new THREE.MeshStandardMaterial({
      map: planeTexture,
      metalness: 0.1,
      roughness: 0.8
    })
    plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.name = 'plane'
    plane.rotation.x = -Math.PI / 2
    plane.position.y = -1
    plane.receiveShadow = true
    // 地面添加阴影偏置，避免阴影闪烁（进阶优化）
    plane.material.shadowSide = THREE.FrontSide
    scene.add(plane)

  } catch (error) {
    console.error('纹理加载异常：', error)
    // 纹理加载失败降级：使用纯色材质
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.7 })
    cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), cubeMaterial)
    cube.name = 'cube'
    cube.castShadow = true
    scene.add(cube)
  }

  // ---------- 5. 加载外部3D模型（进阶核心：glTF模型加载） ----------
  try {
    gltfModel = await loadGLTFModel('/three-assets/model.glb', new THREE.Vector3(2, 0, 1), 0.8)
    scene.add(gltfModel)
  } catch (error) {
    console.error('模型加载异常：', error)
    // 模型加载失败降级：创建一个球体替代
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xff6b6b, metalness: 0.6 })
    )
    sphere.name = 'sphere'
    sphere.position.set(2, 0, 1)
    sphere.castShadow = true
    scene.add(sphere)
    gltfModel = sphere // 赋值给全局，方便后续控制
  }

  // ---------- 6. 进阶灯光系统（多光源组合，更真实的光影效果） ----------
  // 环境光（降低强度，避免画面过亮）
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
  scene.add(ambientLight)
  // 平行光主光源（优化阴影范围，避免阴影裁切）
  const dirLightMain = new THREE.DirectionalLight(0xffffff, 0.9)
  dirLightMain.position.set(8, 12, 6)
  dirLightMain.castShadow = true
  // 调整平行光阴影相机范围（进阶：避免物体阴影超出范围）
  dirLightMain.shadow.camera.left = -10
  dirLightMain.shadow.camera.right = 10
  dirLightMain.shadow.camera.top = 10
  dirLightMain.shadow.camera.bottom = -10
  dirLightMain.shadow.mapSize.set(4096, 4096) // 更高分辨率阴影
  scene.add(dirLightMain)
  // 辅助光：补光（解决物体背面过暗问题）
  const dirLightHelper = new THREE.DirectionalLight(0x404080, 0.4)
  dirLightHelper.position.set(-8, 8, -6)
  scene.add(dirLightHelper)
  // 点光源：局部照明（进阶，增强场景层次感）
  const pointLight = new THREE.PointLight(0xffff00, 0.5, 10)
  pointLight.position.set(0, 3, 0)
  pointLight.castShadow = true
  scene.add(pointLight)

  // ---------- 7. 启动动画循环 ----------
  animate()
}

// ===================== 4. 进阶动画循环（多物体联动，状态驱动） =====================
function animate() {
  requestAnimationFrame(animate)

  // 控制器阻尼更新
  if (controls) controls.update()

  // 响应式状态驱动动画：Vue变量控制旋转速度（核心进阶：状态联动）
  if (cube) {
    cube.rotation.y += cubeRotateSpeed.value
    cube.rotation.x += cubeRotateSpeed.value * 0.5 // 联动x轴旋转，比例缩放
  }

  // 外部模型跟随立方体轻微旋转（多物体联动动画）
  if (gltfModel && isModelShow.value) {
    gltfModel.rotation.y += cubeRotateSpeed.value * 0.8
  }

  // 持续渲染
  if (renderer && scene && camera) renderer.render(scene, camera)
}

// ===================== 5. 场景控制方法（Vue事件触发，进阶交互） =====================
/** 重置场景视角 */
const resetScene = () => {
  if (!camera || !controls) return
  camera.position.set(3, 4, 8)
  controls.target.set(0, 0, 0)
  selectObjName.value = ''
  cubeRotateSpeed.value = 0.01 // 重置旋转速度
}

/** 切换外部模型显示/隐藏 */
const toggleModelShow = () => {
  if (!gltfModel) return
  gltfModel.visible = isModelShow.value
}

/** 切换场景雾化效果 */
const toggleFog = () => {
  if (!scene) return
  scene.fog = isFogEnable.value ? new THREE.Fog(0x1a1a2e, 10, 30) : null
}

/** 窗口尺寸自适应（优化版） */
const handleResize = () => {
  const container = containerRef.value
  if (!container || !camera || !renderer) return
  camera.aspect = container.clientWidth / container.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
}

// ===================== 6. Vue3生命周期和状态监听（进阶优化） =====================
// 组件挂载后初始化
onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

// 组件卸载前销毁所有资源（进阶版：更彻底的资源释放）
onUnmounted(() => {
  if (!scene || !renderer) return

  // 1. 移除事件监听
  renderer.domElement.removeEventListener('click', raycastSelect)
  window.removeEventListener('resize', handleResize)

  // 2. 销毁射线检测器和控制器
  if (raycaster) raycaster = null
  if (controls) controls.dispose()

  // 3. 遍历场景释放所有资源（几何体/材质/纹理/模型）
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose()
      // 释放材质和纹理
      if (obj.material.map) obj.material.map.dispose()
      obj.material.dispose()
    }
    if (obj.isLight) obj.dispose() // 释放灯光资源
  })

  // 4. 销毁渲染器和场景
  renderer.dispose()
  renderer.domElement.remove()
  scene.clear()

  // 5. 置空所有全局对象，方便GC
  scene = camera = renderer = controls = cube = plane = gltfModel = null
})

// ===================== 7. Vue响应式状态监听（核心：状态驱动3D场景） =====================
// 监听雾化状态变化，实时切换
watch(isFogEnable, (newVal) => {
  if (scene) {
    scene.fog = newVal ? new THREE.Fog(0x1a1a2e, 10, 30) : null
  }
})

// 监听模型显示状态，实时更新
watch(isModelShow, (newVal) => {
  if (gltfModel) {
    gltfModel.visible = newVal
  }
})
</script>

<style scoped>
.three-advanced-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.three-scene {
  width: 100%;
  height: 100%;
}

/* 控制面板样式：悬浮右侧，不遮挡场景 */
.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 20px;
  border-radius: 8px;
  z-index: 100;
  min-width: 240px;
}

.control-item {
  margin: 15px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.control-item input[type="range"] {
  flex: 1;
  min-width: 120px;
}

.control-item button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #00ffff;
  color: #000;
  font-weight: 500;
  transition: all 0.3s;
}

.control-item button.active {
  background: #ff6b6b;
  color: #fff;
}

.control-item button:hover {
  opacity: 0.9;
  transform: scale(1.05);
}

.tip {
  font-size: 12px;
  color: #cccccc;
  margin-top: 10px;
}

/* 选中物体提示 */
.select-tip {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #00ffff;
  padding: 8px 16px;
  border-radius: 4px;
  z-index: 100;
  font-size: 14px;
}
</style>
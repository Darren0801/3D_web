<template>
  <div class="airmap">
    <div class="toolbar">
      <button class="btn" @click="startFlight">✈️ 开始京沪航线飞行</button>
      <div class="status-tip">当前状态：{{ flightStatus }}</div>
    </div>
    <div class="viewer" ref="viewerEl"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

// --- 资源配置 ---
// 建议确保模型放在 src/assets/3Dmodel/ 下，或者直接放 public/ 下使用字符串路径
import airModelRaw from '@/assets/3Dmodel/Cesium_Air.glb?url'
const airModelUrl = new URL(airModelRaw, import.meta.url).href

const viewerEl = ref(null)
const viewer = ref(null)
const flightStatus = ref('准备就绪')

let airplaneEntity = null

// 坐标配置
const SH = { lon: 121.47, lat: 31.23, height: 0 }
const BJ = { lon: 116.4, lat: 39.9, height: 0 }
const CRUISE_HEIGHT = 10000 // 巡航高度 10km

/**
 * 构建飞行路径采样数据
 */
const createFlightPositionProperty = (startTime) => {
  const takeoffSeconds = 120   // 增加起飞时间，让爬升更平缓
  const cruiseSeconds = 600    // 巡航时间
  const landingSeconds = 120   // 降落时间
  const totalSeconds = takeoffSeconds + cruiseSeconds + landingSeconds

  const endTime = Cesium.JulianDate.addSeconds(startTime, totalSeconds, new Cesium.JulianDate())
  const prop = new Cesium.SampledPositionProperty()

  // 使用埃尔米特多项式插值，让转弯和升降更圆滑
  prop.setInterpolationOptions({
    interpolationDegree: 2,
    interpolationAlgorithm: Cesium.HermitePolynomialApproximation
  })

  // 1. 起点：上海
  prop.addSample(startTime, Cesium.Cartesian3.fromDegrees(SH.lon, SH.lat, SH.height))

  // 计算航线大圆路径（测地线）
  const geodesic = new Cesium.EllipsoidGeodesic(
    Cesium.Cartographic.fromDegrees(SH.lon, SH.lat),
    Cesium.Cartographic.fromDegrees(BJ.lon, BJ.lat)
  )

  // 2. 爬升段：边飞边升，在航线 10% 处达到巡航高度
  const takeoffPoint = geodesic.interpolateUsingFraction(0.1)
  const takeoffTime = Cesium.JulianDate.addSeconds(startTime, takeoffSeconds, new Cesium.JulianDate())
  prop.addSample(takeoffTime, Cesium.Cartesian3.fromRadians(takeoffPoint.longitude, takeoffPoint.latitude, CRUISE_HEIGHT))

  // 3. 巡航段：在航线中间添加采样点以贴合地球表面
  const cruiseSamples = 10
  for (let i = 1; i <= cruiseSamples; i++) {
    const fraction = 0.1 + (i / (cruiseSamples + 1)) * 0.8 // 在 10% 到 90% 之间
    const carto = geodesic.interpolateUsingFraction(fraction)
    const timeOffset = takeoffSeconds + (i / (cruiseSamples + 1)) * cruiseSeconds
    const time = Cesium.JulianDate.addSeconds(startTime, timeOffset, new Cesium.JulianDate())
    prop.addSample(time, Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, CRUISE_HEIGHT))
  }

  // 4. 准备降落点：航线 90% 处开始下落
  const landingStartPoint = geodesic.interpolateUsingFraction(0.9)
  const landingStartTime = Cesium.JulianDate.addSeconds(startTime, takeoffSeconds + cruiseSeconds, new Cesium.JulianDate())
  prop.addSample(landingStartTime, Cesium.Cartesian3.fromRadians(landingStartPoint.longitude, landingStartPoint.latitude, CRUISE_HEIGHT))

  // 5. 终点：北京
  prop.addSample(endTime, Cesium.Cartesian3.fromDegrees(BJ.lon, BJ.lat, BJ.height))

  return { prop, startTime, endTime }
}

const startFlight = async () => {
  if (!viewer.value) return
  flightStatus.value = '飞行中...'

  // 清理旧实体
  if (airplaneEntity) {
    viewer.value.entities.remove(airplaneEntity)
  }

  const startTime = Cesium.JulianDate.now()
  const { prop: position, endTime } = createFlightPositionProperty(startTime)

  // 创建飞机实体
  airplaneEntity = viewer.value.entities.add({
    availability: new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({ start: startTime, stop: endTime })
    ]),
    position,
    // 自动计算朝向
    orientation: new Cesium.VelocityOrientationProperty(position),
    model: {
      uri: airModelUrl,
      minimumPixelSize: 128,
      maximumScale: 1000,
      // 解决某些解码错误的尝试
      incrementallyLoadTextures: true,
      runAnimations: true
    },
    path: {
      show: true,
      width: 8,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.25,
        color: Cesium.Color.fromCssColorString('#60a5fa')
      }),
      leadTime: 0,
      trailTime: 1000
    }
  })

  // 时钟设置
  const v = viewer.value
  v.clock.startTime = startTime.clone()
  v.clock.stopTime = endTime.clone()
  v.clock.currentTime = startTime.clone()
  v.clock.clockRange = Cesium.ClockRange.CLAMPED
  v.clock.multiplier = 30 // 加速 30 倍展示
  v.clock.shouldAnimate = true

  // 视角跟随
  v.trackedEntity = airplaneEntity
  
  // 给用户一个全景预览后锁定
  v.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(119, 35, 1500000),
    duration: 2,
    complete: () => {
      v.trackedEntity = airplaneEntity
    }
  })
}

onMounted(() => {
  if (!viewerEl.value) return

  // 初始化 Viewer
  viewer.value = new Cesium.Viewer(viewerEl.value, {
    imageryProvider: new Cesium.OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/'
    }),
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    animation: true,
    timeline: true,
    geocoder: false,
    homeButton: false,
    baseLayerPicker: false,
    sceneModePicker: true,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shouldAnimate: true,
  })

  // 基础环境设置
  const scene = viewer.value.scene
  scene.globe.depthTestAgainstTerrain = false // 关闭地形深度检测防止飞机入地
  scene.globe.enableLighting = true

  scene.renderError.addEventListener((err) => {
    console.error('Scene renderError:', err)
    flightStatus.value = '渲染错误（请查看控制台 Network / Console）'
  })

  const layer = viewer.value.imageryLayers.get(0)
  layer?.imageryProvider?.errorEvent?.addEventListener((err) => {
    console.error('ImageryProvider error:', err)
  })
})

onBeforeUnmount(() => {
  if (viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.trackedEntity = undefined
    viewer.value.destroy()
  }
  viewer.value = null
  airplaneEntity = null
})
</script>

<style scoped>
.airmap {
  width: 100%;
  height: 100vh;
  background: #000;
  overflow: hidden;
}

.viewer {
  width: 100%;
  height: 100%;
}

.toolbar {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn {
  padding: 12px 24px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.btn:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.status-tip {
  color: white;
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 14px;
}
</style>
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'

const viewerEl = ref(null)
const viewer = ref(null)

// 设定中心经纬度（可按需更改）
const center = {
  lon: 121.587401,
  lat: 31.186074,
  height: 100,
}

onMounted(() => {
  if (!viewerEl.value) return

  viewer.value = new Cesium.Viewer(viewerEl.value, {
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    baseLayerPicker: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shouldAnimate: true,
  })

  // 设置地形与光照
  viewer.value.scene.globe.depthTestAgainstTerrain = true
  viewer.value.scene.globe.enableLighting = true

  // 定位到中心点并限定 1 公里范围可视
  const centerCartesian = Cesium.Cartesian3.fromDegrees(
    center.lon,
    center.lat,
    center.height
  )

  viewer.value.camera.flyTo({
    destination: centerCartesian,
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },
    duration: 1.8,
  })

  // 添加 1 公里范围圆形覆盖层
  viewer.value.entities.add({
    position: centerCartesian,
    name: '1km-range',
    ellipse: {
      semiMinorAxis: 1000.0,
      semiMajorAxis: 1000.0,
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString('#4ade80').withAlpha(0.25)
      ),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('#22c55e'),
      outlineWidth: 2,
      height: 0,
    },
  })
})

onBeforeUnmount(() => {
  if (viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.destroy()
  }
})
</script>

<template>
  <div class="map-container" ref="viewerEl"></div>
</template>

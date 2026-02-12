<!-- 主页面 -->

<script setup>
import { ref, shallowRef } from 'vue'
import CesiumMap from '../components/HelloWorld.vue'
import MarsMap from '../components/MarsMap.vue'
import AirPlane from './AirPlane/Airplane.vue'
import ThreeDemo from './threejs/threeDemo.vue'
// import Ferrari from './ferrari/ferrari.vue'
import AirMap from './airMap/airMap.vue'

// 维护一份配置即可扩展按钮与组件
const modes = [
//   { key: 'airMap', label: 'airMap', component: AirMap },
//   { key: 'ferrari', label: 'ferrari', component: Ferrari },
  { key: 'three', label: 'threeDemo', component: ThreeDemo },
  { key: 'AirPlane', label: 'AirPlane', component: AirPlane },
  { key: 'cesium', label: '原生 Cesium', component: CesiumMap },
  { key: 'mars', label: 'Mars3D 场景', component: MarsMap }
]

const activeKey = ref(modes[0].key)
const ActiveComponent = shallowRef(modes[0].component)

const switchMode = (mode) => {
  activeKey.value = mode.key
  ActiveComponent.value = mode.component
}
</script>

<template>
  <div class="page">
    <header class="app-bar">
      <div class="brand">地图模式切换</div>
      <div class="map-toggle">
        <button
          v-for="mode in modes"
          :key="mode.key"
          class="toggle-btn"
          :class="{ active: activeKey === mode.key }"
          @click="switchMode(mode)"
        >
          {{ mode.label }}
        </button>
      </div>
    </header>
    <main class="map-shell">
      <component :is="ActiveComponent" />
    </main>
  </div>
</template>
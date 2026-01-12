<script setup>
import { ref } from 'vue'
import CesiumMap from './components/HelloWorld.vue'
import MarsMap from './components/MarsMap.vue'

const mode = ref('cesium')
</script>

<template>
  <div class="page">
    <header class="app-bar">
      <div class="brand">地图模式切换</div>
      <div class="map-toggle">
        <button
          class="toggle-btn"
          :class="{ active: mode === 'cesium' }"
          @click="mode = 'cesium'"
        >
          原生 Cesium
        </button>
        <button
          class="toggle-btn"
          :class="{ active: mode === 'mars' }"
          @click="mode = 'mars'"
        >
          Mars3D 场景
        </button>
      </div>
    </header>
    <main class="map-shell">
      <CesiumMap v-if="mode === 'cesium'" />
      <MarsMap v-else />
    </main>
  </div>
</template>

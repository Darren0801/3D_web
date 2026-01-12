<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as mars3d from 'mars3d'

const mapEl = ref(null)
const mapRef = ref(null)

onMounted(() => {
  if (!mapEl.value) return

  const options = {
    scene: {
      center: { lat: 31.186074, lng: 121.587401, alt: 800, heading: 0, pitch: -35 },
    },
    basemaps: [
      {
        name: 'OpenStreetMap',
        type: 'xyz',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        minimumLevel: 1,
        maximumLevel: 18,
        show: true,
      },
    ],
    layers: [],
    control: {
      baseLayerPicker: false,
      navigationHelpButton: false,
      infoBox: false,
      fullscreenButton: false,
    },
  }

  mapRef.value = new mars3d.Map(mapEl.value, options)
})

onBeforeUnmount(() => {
  if (mapRef.value) {
    mapRef.value.destroy()
  }
})
</script>

<template>
  <div class="map-container" ref="mapEl"></div>
</template>

<template>
  <div class="excalidraw-container">
    <div class="excalidraw-header">
      <span class="excalidraw-title">{{ title }}</span>
      <button class="expand-btn" @click="toggleExpand" title="Fullscreen">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
          <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        </svg>
      </button>
    </div>
    <div class="excalidraw-frame" :style="{ height: height + 'px' }">
      <div v-if="loading" class="loading-state">Loading diagram...</div>
      <iframe
        :src="url"
        :title="title"
        frameborder="0"
        allowfullscreen
        @load="loading = false"
      />
    </div>

    <Teleport to="body">
      <div v-if="isExpanded" class="modal-overlay" @click.self="toggleExpand">
        <div class="modal-content">
          <iframe
            :src="url"
            :title="title"
            frameborder="0"
            allowfullscreen
          />
          <button class="close-btn" @click="toggleExpand">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  url: { type: String, required: true },
  title: { type: String, default: "Excalidraw Diagram" },
  height: { type: [String, Number], default: 500 },
});

const isExpanded = ref(false);
const loading = ref(true);

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
  if (isExpanded.value) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
};
</script>

<style scoped>
.excalidraw-container {
  position: relative;
  width: 100%;
  margin: 1rem 0;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  overflow: hidden;
}

.excalidraw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}

.excalidraw-title {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
}

.expand-btn {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
  color: var(--vp-c-text-1);
}

.expand-btn:hover {
  opacity: 1;
  background: var(--vp-c-bg-soft);
}

.excalidraw-frame {
  position: relative;
  width: 100%;
  background: #fff;
}

.excalidraw-frame iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.loading-state {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  width: 95vw;
  height: 95vh;
  border-radius: 8px;
  overflow: hidden;
}

.modal-content iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
  z-index: 10;
  color: var(--vp-c-text-1);
}

.close-btn:hover {
  opacity: 1;
}
</style>

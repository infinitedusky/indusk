<template>
  <FullscreenDiagram>
    <div class="excalidraw-embed" ref="containerRef">
      <div v-if="loading" class="loading-state">Loading diagram...</div>
      <div v-if="error" class="error-state">{{ error }}</div>
    </div>
  </FullscreenDiagram>
</template>

<script setup>
import { onMounted, ref } from "vue";

const props = defineProps({
  src: { type: String, required: true },
  title: { type: String, default: "Excalidraw Diagram" },
});

const containerRef = ref(null);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    const res = await fetch(props.src);
    if (!res.ok) throw new Error(`Failed to load ${props.src}`);
    const data = await res.json();

    const { exportToSvg } = await import("@excalidraw/utils");

    const svg = await exportToSvg({
      elements: data.elements || [],
      appState: {
        exportWithDarkMode: false,
        exportBackground: true,
        viewBackgroundColor: data.appState?.viewBackgroundColor || "#ffffff",
        ...(data.appState || {}),
      },
      files: data.files || null,
      exportPadding: 16,
    });

    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.removeAttribute("width");
    svg.removeAttribute("height");

    if (containerRef.value) {
      containerRef.value.appendChild(svg);
    }
  } catch (e) {
    console.error("ExcalidrawEmbed error:", e);
    error.value = `Failed to render diagram: ${e.message}`;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.excalidraw-embed {
  min-height: 200px;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.error-state {
  color: var(--vp-c-danger-1);
}
</style>

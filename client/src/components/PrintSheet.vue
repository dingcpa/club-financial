<template>
  <Teleport to="body">
    <div class="print-sheet">
      <slot />
    </div>
  </Teleport>
</template>

<script setup>
// 列印版容器：Teleport 到 body，樣式見 src/print.css（螢幕隱藏、@media print 顯示）
</script>

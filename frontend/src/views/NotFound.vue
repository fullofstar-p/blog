<template>
  <div class="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center md:px-6 md:py-24">
    <p class="rotate-[-2deg] font-serif text-7xl italic text-pencil/20 md:text-9xl" aria-hidden="true">
      404
    </p>
    <h1 class="mt-4 font-serif text-3xl italic text-pencil md:text-5xl">
      这一页被撕掉了
    </h1>
    <p class="mt-4 max-w-md font-serif text-base leading-relaxed text-ink-500">
      你要找的页面不存在、被移走了，或者从来只是草稿上的一行字。
    </p>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <RouterLink :to="{ name: 'home' }" class="sketch-btn sketch-btn-primary min-h-[44px] px-5">
        回到首页
      </RouterLink>
      <RouterLink :to="{ name: 'archive' }" class="sketch-btn min-h-[44px] px-5">翻阅归档</RouterLink>
    </div>
  </div>
</template>

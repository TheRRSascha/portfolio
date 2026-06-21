<template>
  <div class="reader-container">

    <div v-if="!dataLoaded" class="setup-screen">
      <h2 class="title">Tales of Demons and Gods</h2>

      <div v-if="isLoadingList" class="loading-wrapper">
        <div class="spinner"></div>
        <p class="loading-text">Fetching chapter list...</p>
      </div>

      <div v-else class="search-wrapper">
        <div class="input-relative">
          <input
              type="text"
              v-model="searchQuery"
              class="search-input"
              placeholder="Type chapter number (e.g. 127)..."
              @focus="isDropdownOpen = true"
              :disabled="isFetchingManga"
          />
          <button
              @click="isDropdownOpen = !isDropdownOpen"
              class="dropdown-arrow-btn"
              type="button"
              :disabled="isFetchingManga"
          >
            ▼
          </button>
        </div>

        <ul v-if="isDropdownOpen && filteredChapters.length > 0" class="results-list">
          <li
              v-for="chapter in filteredChapters"
              :key="chapter.url"
              @click="selectChapter(chapter)"
              class="result-item"
          >
            {{ chapter.title }}
          </li>
        </ul>
        <ul v-else-if="isDropdownOpen && searchQuery" class="results-list">
          <li class="result-item no-results">No matching chapters found</li>
        </ul>

        <div v-if="isFetchingManga" class="loading-wrapper inline-loader">
          <div class="spinner small"></div>
          <p class="loading-text">Downloading pages...</p>
        </div>
      </div>
    </div>

    <div v-else class="content-screen">
      <div class="sticky-header">
        <select v-model="selectedUrl" class="mini-dropdown">
          <option v-for="chapter in baseChapterList" :key="chapter.url" :value="chapter.url">
            {{ chapter.title }}
          </option>
        </select>
      </div>

      <div v-for="(item, index) in mangaContent" :key="index" class="manga-item">
        <div v-if="item.type === 'divider'" class="separator">
          {{ item.text }}
        </div>
        <img
            v-else
            :src="item.src"
            class="manga-img"
            loading="lazy"
            alt="manga page"
        />
      </div>

      <div class="nav-container">
        <button
            v-if="nextUrl"
            class="next-chapter-btn"
            :disabled="isFetchingManga"
            @click="loadNextBatch"
        >
          <span v-if="isFetchingManga">Loading Next Chapter...</span>
          <span v-else>Next Chapter ➔</span>
        </button>
        <p v-else class="end-text">🎉 Latest Chapter Reached!</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

// Reactive Navigation and Content States
const chapterListRaw = ref([]);
const selectedUrl = ref('');
const searchQuery = ref('');
const isDropdownOpen = ref(false);
const mangaContent = ref([]);
const nextUrl = ref('');

const dataLoaded = ref(false);
const isLoadingList = ref(true);
const isFetchingManga = ref(false);

const CACHE_KEY = 'manga_chapters_cache_v3';

onMounted(async () => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (parsed && parsed.length > 0) {
        chapterListRaw.value = parsed;
        isLoadingList.value = false;
        fetchLiveUpdates();
        return;
      }
    }
    await fetchLiveUpdates();
  } catch (err) {
    console.error("Failed to load chapters", err);
  } finally {
    isLoadingList.value = false;
  }
});

async function fetchLiveUpdates() {
  try {
    const response = await fetch('/api/chapters');
    const data = await response.json();

    if (data && data.chapters && data.chapters.length > 0) {
      chapterListRaw.value = data.chapters;
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.chapters));
    }
  } catch (e) {
    console.warn("Update fetch skipped or blocked:", e.message);
  }
}

// 1. Map list into normalized numeric values
const baseChapterList = computed(() => {
  let list = [];
  if (chapterListRaw.value && chapterListRaw.value.length > 0) {
    list = chapterListRaw.value;
  } else {
    for (let i = 485; i >= 1; i--) {
      list.push({
        title: `Chapter ${i}`,
        url: `https://mangazin.org/manga/tales-of-demons-and-gods-manhua/chapter-${i}/`
      });
    }
  }

  return list.map(chapter => {
    const match = chapter.url.match(/chapter-(\d+)/i) || chapter.title.match(/(\d+)/);
    return {
      ...chapter,
      chapterNumber: match ? match[1] : ''
    };
  });
});

// 2. Strict mapping search match filter
const filteredChapters = computed(() => {
  const query = searchQuery.value.trim();
  if (!query) return baseChapterList.value;

  const isQueryNumeric = /^\d+$/.test(query);

  return baseChapterList.value.filter(chapter => {
    if (isQueryNumeric) {
      return chapter.chapterNumber === query || chapter.chapterNumber.startsWith(query);
    }
    return chapter.title.toLowerCase().includes(query.toLowerCase());
  });
});

function selectChapter(chapter) {
  searchQuery.value = chapter.title;
  selectedUrl.value = chapter.url;
  isDropdownOpen.value = false;
}

watch(selectedUrl, (newUrl) => {
  if (newUrl && !isFetchingManga.value) {
    if (mangaContent.value.length === 0 || !mangaContent.value.some(item => item.url === newUrl)) {
      loadManga(newUrl, false);
    }
  }
});

function loadNextBatch() {
  if (nextUrl.value) {
    // Crucial Change: Setting this to false now replaces images instead of appending them
    loadManga(nextUrl.value, false);
  }
}

async function loadManga(urlToFetch, appendContent = false) {
  if (!urlToFetch) return;
  isFetchingManga.value = true;

  try {
    const response = await fetch(`/api/scrape?url=${encodeURIComponent(urlToFetch)}`);
    const data = await response.json();

    if (appendContent) {
      mangaContent.value = [...mangaContent.value, ...data.content];
    } else {
      // Replaces current data arrays with the fresh chapter content
      mangaContent.value = data.content;
      // Instantly forces focus context back to the top of the browser view viewport
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    nextUrl.value = data.nextUrl;
    dataLoaded.value = true;
  } catch (err) {
    console.error("Failed processing parameters:", err);
    alert("Error loading layout resources.");
  } finally {
    isFetchingManga.value = false;
  }
}
</script>

<style>
html, body {
  margin: 0 !important;
  padding: 0 !important;
  background-color: #0a0a0a !important;
}
</style>

<style scoped>
.reader-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0a0a0a;
  color: #e5e5e5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100vw;
  overflow-x: hidden;
}

.setup-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 30px 20px;
  text-align: center;
}

.title {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 40px;
  background: linear-gradient(135deg, #ff8a00, #da1b60);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.search-wrapper {
  width: 100%;
  max-width: 450px;
  position: relative;
  text-align: left;
}

.input-relative {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: 16px 50px 16px 16px;
  background: #1a1a1a;
  color: #fff;
  border: 2px solid #2a2a2a;
  border-radius: 12px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  border-color: #ff8a00;
}

.dropdown-arrow-btn {
  position: absolute;
  right: 4px;
  height: 80%;
  width: 40px;
  background: transparent;
  border: none;
  color: #ff8a00;
  cursor: pointer;
  font-size: 12px;
}

.results-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1a1a1a;
  border: 2px solid #2a2a2a;
  border-top: none;
  border-radius: 0 0 12px 12px;
  max-height: 250px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}

.result-item {
  padding: 14px 16px;
  cursor: pointer;
  font-size: 15px;
  border-bottom: 1px solid #222;
  transition: background 0.1s;
}

.result-item:hover {
  background: #2a2a2a;
  color: #ff8a00;
}

.result-item:last-child {
  border-bottom: none;
}

.no-results {
  color: #777;
  cursor: default;
  padding: 14px 16px;
}

.loading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
}
.spinner {
  width: 40px; height: 40px;
  border: 4px solid rgba(255,138,0, 0.1);
  border-left-color: #ff8a00;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinner.small { width: 24px; height: 24px; border-width: 3px; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 15px; color: #a0a0a0; }

.sticky-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(10, 10, 10, 0.85);
  backdrop-filter: blur(12px);
  padding: 10px;
  border-bottom: 1px solid #1a1a1a;
  display: flex;
  justify-content: center;
}

.mini-dropdown {
  width: 100%;
  max-width: 400px;
  padding: 8px 12px;
  background: #1f1f1f;
  color: #fff;
  border: 1px solid #333;
  border-radius: 6px;
  font-size: 14px;
}

.content-screen { width: 100%; }
.manga-item { width: 100%; background: #000; }
.manga-img {
  width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  max-width: 720px;
}

.separator {
  background: linear-gradient(90deg, #111, #222, #111);
  padding: 12px;
  color: #ff8a00;
  text-align: center;
  font-size: 13px;
  letter-spacing: 2px;
  font-weight: 700;
  text-transform: uppercase;
}

.nav-container {
  padding: 40px 15px 60px 15px;
  background: #0a0a0a;
  display: flex;
  justify-content: center;
}

.next-chapter-btn {
  width: 100%;
  max-width: 500px;
  padding: 20px;
  background: linear-gradient(135deg, #ff8a00, #e52e71);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(229, 46, 113, 0.3);
}

.next-chapter-btn:disabled {
  background: #222;
  color: #666;
  box-shadow: none;
}

.end-text {
  font-size: 16px;
  color: #666;
  font-weight: 600;
}
</style>
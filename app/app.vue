<template>
  <div class="reader-container">

    <div v-if="!dataLoaded" class="setup-screen">
      <h2 class="title">Tales of Demons and Gods</h2>

      <div v-if="isLoadingList" class="loading-wrapper">
        <div class="spinner"></div>
        <p class="loading-text">Fetching chapter list...</p>
      </div>

      <div v-else class="dropdown-wrapper">
        <label for="chapter-select" class="sr-only">Choose a starting chapter</label>
        <select
            id="chapter-select"
            v-model="selectedUrl"
            class="chapter-dropdown"
            :disabled="isFetchingManga"
        >
          <option disabled value="">Please select a starting chapter</option>
          <option v-for="chapter in chapterList" :key="chapter.url" :value="chapter.url">
            {{ chapter.title }}
          </option>
        </select>

        <div v-if="isFetchingManga" class="loading-wrapper inline-loader">
          <div class="spinner small"></div>
          <p class="loading-text">Downloading pages...</p>
        </div>
      </div>
    </div>

    <div v-else class="content-screen">
      <div class="sticky-header">
        <select v-model="selectedUrl" class="mini-dropdown">
          <option v-for="chapter in chapterList" :key="chapter.url" :value="chapter.url">
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
          <span v-if="isFetchingManga">Loading Next Chapters...</span>
          <span v-else>Next Chapters ➔</span>
        </button>
        <p v-else class="end-text">🎉 Latest Chapter Reached!</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

// Reactive State Configuration Variables
const chapterList = ref([]);
const selectedUrl = ref('');
const mangaContent = ref([]);
const nextUrl = ref('');

const dataLoaded = ref(false);
const isLoadingList = ref(true);
const isFetchingManga = ref(false);

// Auto-trigger manga fetch immediately when user picks a dropdown menu option
watch(selectedUrl, (newUrl) => {
  if (newUrl && !isFetchingManga.value) {
    // Only auto-trigger if we aren't appending structural continuation rows via bottom triggers
    if (mangaContent.value.length === 0 || !mangaContent.value.some(item => item.url === newUrl)) {
      loadManga(newUrl, false);
    }
  }
});

// Fetch the base chapter list on hook registration mounting loops
onMounted(async () => {
  try {
    const response = await fetch('/api/chapters');
    const data = await response.json();
    chapterList.value = data.chapters;
  } catch (err) {
    console.error("Failed to load chapters via Nuxt api handler", err);
  } finally {
    isLoadingList.value = false;
  }
});

// Wrapper function to explicitly handle Next Batch mutations
function loadNextBatch() {
  if (nextUrl.value) {
    loadManga(nextUrl.value, true);
  }
}

// core fetch abstraction module
async function loadManga(urlToFetch, appendContent = false) {
  if (!urlToFetch) return;

  isFetchingManga.value = true;

  try {
    const response = await fetch(`/api/scrape?url=${encodeURIComponent(urlToFetch)}`);
    const data = await response.json();

    if (appendContent) {
      // Append the new images to your ongoing array instead of blowing away state data
      mangaContent.value = [...mangaContent.value, ...data.content];
    } else {
      // Reset layout viewing metrics on a totally fresh selection choice
      mangaContent.value = data.content;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    nextUrl.value = data.nextUrl;
    dataLoaded.value = true;
  } catch (err) {
    console.error("Failed structural processing parameters parsing layout details:", err);
    alert("Error fetching page resources. Review background terminal details.");
  } finally {
    isFetchingManga.value = false;
  }
}
</script>

<style scoped>
/* Mobile First Layout Scopes */
.reader-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #0a0a0a;
  color: #e5e5e5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;
}

/* Setup Screen styling */
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
  letter-spacing: -0.5px;
  margin-bottom: 40px;
  background: linear-gradient(135deg, #ff8a00, #da1b60);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.dropdown-wrapper {
  width: 100%;
  max-width: 500px;
}

.chapter-dropdown {
  width: 100%;
  padding: 16px;
  background: #1a1a1a;
  color: #fff;
  border: 2px solid #2a2a2a;
  border-radius: 12px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ff8a00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>");
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 18px;
}

.chapter-dropdown:focus {
  border-color: #ff8a00;
}

/* Spinner Animation Module Layout Elements */
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
.loading-text { font-size: 15px; color: #a0a0a0; font-weight: 500; }

/* Sticky Reader Controls Header */
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

/* Manga Panel Images Display adjustments */
.content-screen { width: 100%; }
.manga-item { width: 100%; background: #000; }
.manga-img {
  width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  max-width: 720px; /* Great balance width config constraint for desktop scaling monitors */
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
  border-top: 1px solid #1f1f1f;
  border-bottom: 1px solid #1f1f1f;
}

/* Navigation footer elements block */
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
  transition: transform 0.15s ease, opacity 0.2s;
}

.next-chapter-btn:active {
  transform: scale(0.98);
}

.next-chapter-btn:disabled {
  background: #222;
  color: #666;
  box-shadow: none;
  cursor: not-allowed;
}

.end-text {
  font-size: 16px;
  color: #666;
  font-weight: 600;
  letter-spacing: 0.5px;
}
</style>
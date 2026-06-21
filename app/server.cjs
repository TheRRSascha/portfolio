const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the compiled Vue frontend files
app.use(express.static(path.join(__dirname, 'dist')));

const BASE_URL = 'https://mangazin.org';
const MANGA_URL = `${BASE_URL}/manga/tales-of-demons-and-gods-manhua/`;

// Helper: Extract major chapter
const getMajorChapter = (url) => {
    if (!url) return null;
    const match = url.match(/chapter-(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
};

// Helper: Get next URL
const getNextUrl = ($, currentUrl) => {
    const nextBtn = $('.next_page, .nav-next a, a.next, .btn.next').first();
    let href = nextBtn.attr('href');
    if (!href) return null;
    if (href.startsWith('/')) href = `${BASE_URL}${href}`;
    return href;
};

// --- Endpoint: Get full list of chapters ---
app.get('/api/chapters', async (req, res) => {
    console.log(`\n=== [DEBUG] Incoming request to /api/chapters at ${new Date().toISOString()} ===`);
    try {
        console.log(`[DEBUG] Attempting to fetch main manga page: ${MANGA_URL}`);
        const response = await axios.get(MANGA_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 10000 // 10 second timeout
        });

        console.log(`[DEBUG] Main page fetch successful. Status: ${response.status}`);
        const $ = cheerio.load(response.data);
        let chapters = [];

        const selectors = '.wp-manga-chapter > a, #chapterlist ul li a, .chapter-list li a, .listing-chapters_wrap a, li.chapter a, .chapters-list a';
        console.log(`[DEBUG] Querying DOM with static selectors...`);

        $(selectors).each((i, el) => {
            const title = $(el).text().trim().replace(/\s+/g, ' ');
            const url = $(el).attr('href');
            if (url && url.includes('chapter-')) {
                chapters.push({ title, url });
            }
        });

        console.log(`[DEBUG] Static selectors found ${chapters.length} chapters.`);

        // Trigger AJAX bypass if static fails
        if (chapters.length === 0) {
            console.log("[DEBUG] Chapters empty on main page structure. Finding IDs for AJAX bypass...");

            const mangaId = $('#manga-chapters-holder').attr('data-id') ||
                $('.rating-post-id').val() ||
                $('#wp-manga-js-extra').text().match(/"manga_id":"(\d+)"/)?.[1];

            console.log(`[DEBUG] Detected Manga ID: ${mangaId || 'NOT FOUND'}`);

            if (mangaId) {
                const ajaxUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
                console.log(`[DEBUG] Dispatching AJAX bypass request to: ${ajaxUrl}`);

                const ajaxResponse = await axios.post(ajaxUrl, `action=manga_get_chapters&manga=${mangaId}`, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': MANGA_URL
                    }
                });

                console.log(`[DEBUG] AJAX response received. Status: ${ajaxResponse.status}`);
                const $ajax = cheerio.load(ajaxResponse.data);

                $ajax('li.wp-manga-chapter a, .wp-manga-chapter > a, a').each((i, el) => {
                    const title = $ajax(el).text().trim().replace(/\s+/g, ' ');
                    const url = $ajax(el).attr('href');
                    if (url && url.includes('chapter-')) {
                        chapters.push({ title, url });
                    }
                });
                console.log(`[DEBUG] AJAX parser parsed ${chapters.length} chapters.`);
            } else {
                console.log("[WARN] Could not locate Manga ID in the DOM to run AJAX bypass.");
            }
        }

        console.log(`=== [DEBUG] Request complete. Sending ${chapters.length} chapters to client ===\n`);
        res.json({ chapters });

    } catch (error) {
        console.error("!!! [ERROR] Error fetching chapters:", error.message);
        if (error.response) {
            console.error(`[ERROR] Server responded with status: ${error.response.status}`);
        }
        res.status(500).json({ error: 'Failed to fetch chapters', details: error.message });
    }
});

// --- Endpoint: Scrape 5 chapters of images ---
app.get('/api/scrape', async (req, res) => {
    let nextUrlToFollow = req.query.url;
    if (!nextUrlToFollow) return res.status(400).json({ error: 'URL required' });

    let currentMajorChapter = getMajorChapter(nextUrlToFollow);
    if (!currentMajorChapter) return res.status(400).json({ error: 'Invalid chapter URL' });

    const FULL_CHAPTERS_TO_LOAD = 5;
    const MAX_FETCHES = 25;
    const targetLimitChapter = currentMajorChapter + FULL_CHAPTERS_TO_LOAD;

    let content = [];
    let fetchCount = 0;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': BASE_URL
    };

    try {
        while (nextUrlToFollow && fetchCount < MAX_FETCHES) {
            let nextMajorChapter = getMajorChapter(nextUrlToFollow);
            if (nextMajorChapter && nextMajorChapter >= targetLimitChapter) break;

            fetchCount++;
            let urlSlug = nextUrlToFollow.split('/').filter(Boolean).pop();

            const response = await axios.get(nextUrlToFollow, { headers });
            const $ = cheerio.load(response.data);
            const images = $('.reading-content img, .page-break img, .entry-content img');

            if (images.length > 0) {
                content.push({ type: 'divider', text: urlSlug.replace(/-/g, ' ') });
                images.each((i, img) => {
                    let src = $(img).attr('data-src') || $(img).attr('data-lazy-src') || $(img).attr('src');
                    if (src && src.trim() !== "") {
                        content.push({ type: 'image', src: src.trim() });
                    }
                });
            } else {
                break;
            }

            nextUrlToFollow = getNextUrl($, nextUrlToFollow);
        }

        res.json({ content, nextUrl: nextUrlToFollow });
    } catch (error) {
        console.error("Scraping error:", error.message);
        res.status(500).json({ error: 'Failed to scrape chapters' });
    }
});

// --- Catch-all Route for Vue SPA ---
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Full-Stack App Running on port ${PORT}`));
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://mangazin.org';
const MANGA_URL = `${BASE_URL}/manga/tales-of-demons-and-gods-manhua/`;

export default defineEventHandler(async (event) => {
    console.log(`\n=== [NUXT DEBUG] Hit /api/chapters endpoint at ${new Date().toISOString()} ===`);

    try {
        console.log(`[DEBUG] Fetching: ${MANGA_URL}`);
        const response = await axios.get(MANGA_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 10000
        });

        console.log(`[DEBUG] Status code received: ${response.status}`);
        const $ = cheerio.load(response.data);
        let chapters = [];

        const selectors = '.wp-manga-chapter > a, #chapterlist ul li a, .chapter-list li a, .listing-chapters_wrap a, li.chapter a, .chapters-list a';

        $(selectors).each((i, el) => {
            const title = $(el).text().trim().replace(/\s+/g, ' ');
            const url = $(el).attr('href');
            if (url && url.includes('chapter-')) {
                chapters.push({ title, url });
            }
        });

        console.log(`[DEBUG] Initial parse found ${chapters.length} chapters.`);

        if (chapters.length === 0) {
            console.log("[DEBUG] Static list empty. Attempting WordPress AJAX bypass...");

            const mangaId = $('#manga-chapters-holder').attr('data-id') ||
                $('.rating-post-id').val() ||
                $('#wp-manga-js-extra').text().match(/"manga_id":"(\d+)"/)?.[1];

            console.log(`[DEBUG] Manga ID: ${mangaId || 'NOT FOUND'}`);

            if (mangaId) {
                const ajaxUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
                console.log(`[DEBUG] Dispatching admin-ajax POST to: ${ajaxUrl}`);

                const ajaxResponse = await axios.post(ajaxUrl, `action=manga_get_chapters&manga=${mangaId}`, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': MANGA_URL
                    }
                });

                console.log(`[DEBUG] AJAX responded with status: ${ajaxResponse.status}`);
                const $ajax = cheerio.load(ajaxResponse.data);

                $ajax('li.wp-manga-chapter a, .wp-manga-chapter > a, a').each((i, el) => {
                    const title = $ajax(el).text().trim().replace(/\s+/g, ' ');
                    const url = $ajax(el).attr('href');
                    if (url && url.includes('chapter-')) {
                        chapters.push({ title, url });
                    }
                });
                console.log(`[DEBUG] Final parsed count via AJAX: ${chapters.length}`);
            }
        }

        console.log(`=== [NUXT DEBUG] Returning ${chapters.length} chapters to app ===\n`);
        return { chapters };

    } catch (error) {
        console.error("!!! [NUXT ERROR] Failed to fetch chapters:", error.message);
        throw createError({
            statusCode: 500,
            statusMessage: `Backend processing error: ${error.message}`,
        });
    }
});
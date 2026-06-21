import axios from 'axios';
import * as cheerio from 'cheerio';
import jwt from 'jsonwebtoken';

const BASE_URL = 'https://mangazin.org';
const MANGA_URL = `${BASE_URL}/manga/tales-of-demons-and-gods-manhua/`;

// Secure Token Verifier Helper
function verifyAuth(event) {
    const authHeader = getHeader(event, 'authorization');
    const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    const config = useRuntimeConfig();
    const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET;

    if (!token) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized access' });
    }
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw createError({ statusCode: 403, statusMessage: 'Invalid or expired session token' });
    }
}

export default defineEventHandler(async (event) => {
    // 🛡️ BLOCK UNAUTHORIZED REQUESTS RIGHT HERE
    verifyAuth(event);

    console.log(`\n=== [NUXT DEBUG] Hit /api/chapters endpoint ===`);
    try {
        const response = await axios.get(MANGA_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 10000
        });

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

        if (chapters.length === 0) {
            const mangaId = $('#manga-chapters-holder').attr('data-id') ||
                $('.rating-post-id').val() ||
                $('#wp-manga-js-extra').text().match(/"manga_id":"(\d+)"/)?.[1];

            if (mangaId) {
                const ajaxUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
                const ajaxResponse = await axios.post(ajaxUrl, `action=manga_get_chapters&manga=${mangaId}`, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': MANGA_URL
                    }
                });

                const $ajax = cheerio.load(ajaxResponse.data);
                $ajax('li.wp-manga-chapter a, .wp-manga-chapter > a, a').each((i, el) => {
                    const title = $ajax(el).text().trim().replace(/\s+/g, ' ');
                    const url = $ajax(el).attr('href');
                    if (url && url.includes('chapter-')) {
                        chapters.push({ title, url });
                    }
                });
            }
        }

        return { chapters };
    } catch (error) {
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || `Backend processing error: ${error.message}`,
        });
    }
});
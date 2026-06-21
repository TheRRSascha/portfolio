import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://mangazin.org';

const getMajorChapter = (url) => {
    if (!url) return null;
    const match = url.match(/chapter-(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
};

const getNextUrl = ($, currentUrl) => {
    const nextBtn = $('.next_page, .nav-next a, a.next, .btn.next').first();
    let href = nextBtn.attr('href');
    if (!href) return null;
    if (href.startsWith('/')) href = `${BASE_URL}${href}`;
    return href;
};

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    let nextUrlToFollow = query.url;

    if (!nextUrlToFollow) {
        throw createError({ statusCode: 400, statusMessage: 'URL required' });
    }

    let currentMajorChapter = getMajorChapter(nextUrlToFollow);
    if (!currentMajorChapter) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid chapter URL structure' });
    }

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

        return { content, nextUrl: nextUrlToFollow };
    } catch (error) {
        throw createError({ statusCode: 500, statusMessage: error.message });
    }
});
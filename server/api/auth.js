import jwt from 'jsonwebtoken';

// In-memory store for rate limiting.
// Note: This resets if your DigitalOcean app restarts, which is perfectly fine for basic brute-force protection.
const attemptTracker = new Map();

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { password } = body;

    // Extract the client's IP address
    const clientIp = getRequestHeader(event, 'x-forwarded-for') || event.node.req.socket.remoteAddress || 'unknown';

    // 1. Check if the IP is currently locked out
    const record = attemptTracker.get(clientIp) || { count: 0, lockUntil: 0 };
    if (Date.now() < record.lockUntil) {
        const remainingMinutes = Math.ceil((record.lockUntil - Date.now()) / 60000);
        console.warn(`[SECURITY] Blocked login attempt from locked IP: ${clientIp}`);

        throw createError({
            statusCode: 429,
            statusMessage: `Too many failed attempts. Locked for ${remainingMinutes} minute(s).`
        });
    }

    const config = useRuntimeConfig();
    const MASTER_PASSWORD = config.readerPassword || process.env.READER_PASSWORD;
    const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET;

    if (!MASTER_PASSWORD || !JWT_SECRET) {
        throw createError({ statusCode: 500, statusMessage: 'Server configuration error.' });
    }

    // 2. Validate Password
    if (password === MASTER_PASSWORD) {
        // Success: clear failures and log it
        attemptTracker.delete(clientIp);
        console.log(`[AUTH SUCCESS] Successful login from IP: ${clientIp}`);

        const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '7d' });
        return { success: true, token };
    }

    // 3. Handle Failure
    record.count += 1;
    console.log(`[AUTH FAILED] Incorrect password from IP: ${clientIp}. Attempt ${record.count}/3.`);

    if (record.count >= 3) {
        // Lock for 5 minutes (5 * 60 * 1000 milliseconds)
        record.lockUntil = Date.now() + 5 * 60 * 1000;
        attemptTracker.set(clientIp, record);

        console.warn(`[SECURITY] IP ${clientIp} locked out for 5 minutes due to 3 failed attempts.`);

        throw createError({
            statusCode: 429,
            statusMessage: 'Too many failed attempts. Locked for 5 minutes.'
        });
    } else {
        attemptTracker.set(clientIp, record);
        throw createError({
            statusCode: 401,
            statusMessage: `Incorrect password. ${3 - record.count} attempt(s) remaining.`
        });
    }
});
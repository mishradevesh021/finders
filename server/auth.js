const crypto = require('node:crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'finders_ultra_secure_secret_key_2026_987413526';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Secure password hashing with PBKDF2
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, hash, salt) {
    const calculatedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calculatedHash, 'hex'));
}

// Lightweight secure signed session token
function createToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
        ...payload,
        exp: Date.now() + TOKEN_EXPIRY_MS
    })).toString('base64url');
    
    const signature = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');
        
    return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');
        
    if (signature !== expectedSig) return null;
    
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) {
            return null; // Expired
        }
        return payload;
    } catch {
        return null;
    }
}

function extractUserFromRequest(req, db) {
    const authHeader = req.headers['authorization'];
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    } else if (req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
            const [k, v] = c.trim().split('=');
            if (k && v) acc[k] = decodeURIComponent(v);
            return acc;
        }, {});
        token = cookies['finders_token'];
    }

    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload || !payload.id) return null;

    // Verify user exists and is not suspended
    const user = db.get('SELECT id, email, role, full_name, phone, avatar_url, city, locality, lat, lng, is_suspended FROM users WHERE id = ?', [payload.id]);
    if (!user || user.is_suspended) return null;

    return user;
}

module.exports = {
    hashPassword,
    verifyPassword,
    createToken,
    verifyToken,
    extractUserFromRequest
};

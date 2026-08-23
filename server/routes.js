const crypto = require('node:crypto');
const db = require('../database/db');
const { hashPassword, verifyPassword, createToken, extractUserFromRequest } = require('./auth');
const { classifyProblem, calculateDistance, rankWorkers } = require('./ai');

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve({});
            }
        });
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
    });
    res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
    sendJson(res, statusCode, { error: message, success: false });
}

// Notification Helper
function createNotification(userId, title, message, type = 'GENERAL', link = null) {
    try {
        const id = 'notif_' + crypto.randomUUID().slice(0, 8);
        db.run(`
            INSERT INTO notifications (id, user_id, title, message, type, link)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, userId, title, message, type, link]);
    } catch (err) {
        console.error('Failed to create notification:', err);
    }
}

async function handleApiRequest(req, res, url) {
    const pathname = url.pathname;
    const method = req.method;
    const user = extractUserFromRequest(req, db);

    // ==========================================
    // AUTHENTICATION ROUTES
    // ==========================================

    // POST /api/auth/register
    if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await parseBody(req);
        const {
            email, password, role, fullName, phone,
            city = 'Bengaluru', locality = 'Indiranagar',
            // Worker specific fields
            primaryServiceId, experienceYears = 1, bio = '',
            startingPrice = 250, skills = []
        } = body;

        if (!email || !password || !role || !fullName || !phone) {
            return sendError(res, 400, 'Please fill in all required fields.');
        }

        if (!['CUSTOMER', 'WORKER'].includes(role)) {
            return sendError(res, 400, 'Invalid role choice.');
        }

        if (password.length < 6) {
            return sendError(res, 400, 'Password must be at least 6 characters.');
        }

        const existing = db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        if (existing) {
            return sendError(res, 409, 'An account with this email address already exists.');
        }

        const userId = 'usr_' + crypto.randomUUID().slice(0, 10);
        const { hash, salt } = hashPassword(password);
        const defaultAvatar = role === 'WORKER' 
            ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

        // Default Lat/Lng for Bengaluru
        const lat = 12.9716 + (Math.random() - 0.5) * 0.04;
        const lng = 77.5946 + (Math.random() - 0.5) * 0.04;

        db.run(`
            INSERT INTO users (id, email, password_hash, salt, role, full_name, phone, avatar_url, city, locality, lat, lng)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, email.toLowerCase().trim(), hash, salt, role, fullName.trim(), phone.trim(), defaultAvatar, city, locality, lat, lng]);

        if (role === 'CUSTOMER') {
            db.run(`
                INSERT INTO customer_profiles (user_id, preferred_locality, saved_addresses_json)
                VALUES (?, ?, ?)
            `, [userId, locality, JSON.stringify([{ tag: 'Home', address: `${locality}, ${city}` }])]);
        } else if (role === 'WORKER') {
            const serviceId = primaryServiceId || 'srv_elec';
            db.run(`
                INSERT INTO worker_profiles (
                    user_id, primary_service_id, experience_years, bio, skills_json,
                    is_available, starting_price, is_verified, rating_avg, reviews_count
                ) VALUES (?, ?, ?, ?, ?, 1, ?, 0, 5.0, 0)
            `, [userId, serviceId, Number(experienceYears), bio || 'Professional service provider', JSON.stringify(skills), Number(startingPrice)]);
        }

        const token = createToken({ id: userId, email: email.toLowerCase().trim(), role, fullName });
        const createdUser = db.get('SELECT id, email, role, full_name, phone, avatar_url, city, locality, lat, lng FROM users WHERE id = ?', [userId]);

        return sendJson(res, 201, {
            success: true,
            token,
            user: createdUser,
            message: 'Registration successful!'
        });
    }

    // POST /api/auth/login
    if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req);
        const { email, password } = body;

        if (!email || !password) {
            return sendError(res, 400, 'Email and password are required.');
        }

        const foundUser = db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        if (!foundUser) {
            return sendError(res, 401, 'Invalid email or password.');
        }

        if (foundUser.is_suspended) {
            return sendError(res, 403, 'This account has been suspended for safety violations. Please contact support.');
        }

        const isValid = verifyPassword(password, foundUser.password_hash, foundUser.salt);
        if (!isValid) {
            return sendError(res, 401, 'Invalid email or password.');
        }

        const token = createToken({
            id: foundUser.id,
            email: foundUser.email,
            role: foundUser.role,
            fullName: foundUser.full_name
        });

        const safeUser = {
            id: foundUser.id,
            email: foundUser.email,
            role: foundUser.role,
            fullName: foundUser.full_name,
            phone: foundUser.phone,
            avatarUrl: foundUser.avatar_url,
            city: foundUser.city,
            locality: foundUser.locality,
            lat: foundUser.lat,
            lng: foundUser.lng
        };

        return sendJson(res, 200, {
            success: true,
            token,
            user: safeUser,
            message: 'Login successful!'
        });
    }

    // POST /api/auth/demo-login (Quick 1-click test switcher)
    if (pathname === '/api/auth/demo-login' && method === 'POST') {
        const body = await parseBody(req);
        const { accountType } = body; // 'customer', 'worker_rahul', 'worker_suresh', 'admin'

        let email = 'customer@finders.com';
        if (accountType === 'worker_rahul' || accountType === 'worker') {
            email = 'electrician@finders.com';
        } else if (accountType === 'worker_suresh') {
            email = 'plumber@finders.com';
        } else if (accountType === 'admin') {
            email = 'admin@finders.com';
        }

        const foundUser = db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!foundUser) {
            return sendError(res, 404, 'Demo account not found. Please run seed script.');
        }

        const token = createToken({
            id: foundUser.id,
            email: foundUser.email,
            role: foundUser.role,
            fullName: foundUser.full_name
        });

        return sendJson(res, 200, {
            success: true,
            token,
            user: {
                id: foundUser.id,
                email: foundUser.email,
                role: foundUser.role,
                fullName: foundUser.full_name,
                phone: foundUser.phone,
                avatarUrl: foundUser.avatar_url,
                city: foundUser.city,
                locality: foundUser.locality,
                lat: foundUser.lat,
                lng: foundUser.lng
            }
        });
    }

    // GET /api/auth/me
    if (pathname === '/api/auth/me' && method === 'GET') {
        if (!user) return sendError(res, 401, 'Unauthorized');

        let extraProfile = {};
        if (user.role === 'WORKER') {
            extraProfile = db.get('SELECT * FROM worker_profiles WHERE user_id = ?', [user.id]) || {};
        } else if (user.role === 'CUSTOMER') {
            extraProfile = db.get('SELECT * FROM customer_profiles WHERE user_id = ?', [user.id]) || {};
        }

        return sendJson(res, 200, {
            user,
            profile: extraProfile
        });
    }

    // ==========================================
    // SERVICES & DISCOVERY
    // ==========================================

    // GET /api/services
    if (pathname === '/api/services' && method === 'GET') {
        const services = db.all('SELECT * FROM services ORDER BY is_popular DESC, name ASC');
        return sendJson(res, 200, { services });
    }

    // GET /api/workers
    if (pathname === '/api/workers' && method === 'GET') {
        const serviceSlug = url.searchParams.get('service');
        const serviceId = url.searchParams.get('serviceId');
        const query = (url.searchParams.get('query') || '').trim();
        const availableOnly = url.searchParams.get('available') === 'true';
        const verifiedOnly = url.searchParams.get('verified') === 'true';
        const userLat = parseFloat(url.searchParams.get('lat')) || (user ? user.lat : 12.9784);
        const userLng = parseFloat(url.searchParams.get('lng')) || (user ? user.lng : 77.6408);

        let targetServiceId = serviceId;
        if (!targetServiceId && serviceSlug && serviceSlug !== 'all') {
            const s = db.get('SELECT id FROM services WHERE slug = ?', [serviceSlug]);
            if (s) targetServiceId = s.id;
        }

        let sql = `
            SELECT 
                u.id, u.full_name, u.phone, u.avatar_url, u.city, u.locality, u.lat, u.lng,
                wp.primary_service_id, wp.secondary_services_json, wp.experience_years,
                wp.bio, wp.skills_json, wp.working_hours, wp.is_available,
                wp.service_radius_km, wp.starting_price, wp.pricing_model,
                wp.languages_json, wp.is_verified, wp.verification_badge,
                wp.rating_avg, wp.reviews_count, wp.completed_jobs_count, wp.response_rate,
                s.name as service_name, s.slug as service_slug, s.icon as service_icon, s.category as service_category
            FROM users u
            JOIN worker_profiles wp ON u.id = wp.user_id
            JOIN services s ON wp.primary_service_id = s.id
            WHERE u.role = 'WORKER' AND u.is_suspended = 0
        `;
        const params = [];

        if (targetServiceId) {
            sql += ` AND (wp.primary_service_id = ? OR wp.secondary_services_json LIKE ?)`;
            params.push(targetServiceId, `%${targetServiceId}%`);
        }

        if (availableOnly) {
            sql += ` AND wp.is_available = 1`;
        }

        if (verifiedOnly) {
            sql += ` AND wp.is_verified = 1`;
        }

        if (query) {
            sql += ` AND (u.full_name LIKE ? OR wp.bio LIKE ? OR wp.skills_json LIKE ? OR s.name LIKE ?)`;
            const q = `%${query}%`;
            params.push(q, q, q, q);
        }

        const rawWorkers = db.all(sql, params);

        // Run smart ranking and distance calculations
        const ranked = rankWorkers(rawWorkers, {
            targetServiceId,
            customerLat: userLat,
            customerLng: userLng
        });

        // Hide phone numbers for general discovery privacy
        const sanitizedWorkers = ranked.map(w => ({
            ...w,
            phone: 'Confidential (Available on request)'
        }));

        return sendJson(res, 200, { workers: sanitizedWorkers });
    }

    // GET /api/workers/:id
    if (pathname.startsWith('/api/workers/') && method === 'GET') {
        const workerId = pathname.split('/')[3];
        const worker = db.get(`
            SELECT 
                u.id, u.full_name, u.avatar_url, u.city, u.locality, u.lat, u.lng,
                wp.primary_service_id, wp.secondary_services_json, wp.experience_years,
                wp.bio, wp.skills_json, wp.working_hours, wp.is_available,
                wp.service_radius_km, wp.starting_price, wp.pricing_model,
                wp.languages_json, wp.is_verified, wp.verification_badge,
                wp.rating_avg, wp.reviews_count, wp.completed_jobs_count, wp.response_rate,
                s.name as service_name, s.slug as service_slug, s.icon as service_icon, s.category as service_category
            FROM users u
            JOIN worker_profiles wp ON u.id = wp.user_id
            JOIN services s ON wp.primary_service_id = s.id
            WHERE u.id = ? AND u.role = 'WORKER'
        `, [workerId]);

        if (!worker) return sendError(res, 404, 'Worker profile not found.');

        // Calculate distance from requesting user
        const customerLat = user ? user.lat : 12.9784;
        const customerLng = user ? user.lng : 77.6408;
        const distance = calculateDistance(customerLat, customerLng, worker.lat, worker.lng);

        // Fetch reviews
        const reviews = db.all(`
            SELECT r.*, u.full_name as customer_name, u.avatar_url as customer_avatar
            FROM reviews r
            JOIN users u ON r.customer_id = u.id
            WHERE r.worker_id = ?
            ORDER BY r.created_at DESC
        `, [workerId]);

        return sendJson(res, 200, {
            worker: {
                ...worker,
                distanceKm: distance
            },
            reviews
        });
    }

    // POST /api/workers/availability (Worker Dashboard toggle)
    if (pathname === '/api/workers/availability' && method === 'POST') {
        if (!user || user.role !== 'WORKER') return sendError(res, 403, 'Worker access required.');
        const body = await parseBody(req);
        const { isAvailable, serviceRadiusKm, startingPrice, workingHours } = body;

        db.run(`
            UPDATE worker_profiles
            SET is_available = COALESCE(?, is_available),
                service_radius_km = COALESCE(?, service_radius_km),
                starting_price = COALESCE(?, starting_price),
                working_hours = COALESCE(?, working_hours)
            WHERE user_id = ?
        `, [isAvailable !== undefined ? (isAvailable ? 1 : 0) : null, serviceRadiusKm, startingPrice, workingHours, user.id]);

        return sendJson(res, 200, { success: true, message: 'Worker settings updated.' });
    }

    // POST /api/workers/verify (Submit verification documents)
    if (pathname === '/api/workers/verify' && method === 'POST') {
        if (!user || user.role !== 'WORKER') return sendError(res, 403, 'Worker access required.');
        const body = await parseBody(req);
        const { idType, idNumber, documentName, certName } = body;

        if (!idType || !idNumber || !documentName) {
            return sendError(res, 400, 'Please provide ID Type, ID Number and Document Name.');
        }

        const verId = 'ver_' + crypto.randomUUID().slice(0, 8);
        db.run(`
            INSERT INTO worker_verifications (id, worker_id, id_type, id_number, document_name, cert_name, status, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
        `, [verId, user.id, idType, idNumber, documentName, certName || null]);

        return sendJson(res, 200, { success: true, message: 'Verification request submitted for admin review.' });
    }

    // ==========================================
    // AI NLP SEARCH & CLASSIFICATION
    // ==========================================

    // POST /api/ai/classify
    if (pathname === '/api/ai/classify' && method === 'POST') {
        const body = await parseBody(req);
        const { text } = body;

        if (!text || text.trim() === '') {
            return sendError(res, 400, 'Input text is required.');
        }

        const allServices = db.all('SELECT * FROM services');
        const classification = classifyProblem(text, allServices);

        return sendJson(res, 200, { classification });
    }

    // POST /api/ai/search (Conversational Natural Language Search)
    if (pathname === '/api/ai/search' && method === 'POST') {
        const body = await parseBody(req);
        const { query, customerLat = 12.9784, customerLng = 77.6408 } = body;

        if (!query || query.trim() === '') {
            return sendError(res, 400, 'Search query is required.');
        }

        const allServices = db.all('SELECT * FROM services');
        const classification = classifyProblem(query, allServices);

        // Find matching workers for this classified service
        const rawWorkers = db.all(`
            SELECT 
                u.id, u.full_name, u.avatar_url, u.city, u.locality, u.lat, u.lng,
                wp.primary_service_id, wp.secondary_services_json, wp.experience_years,
                wp.bio, wp.skills_json, wp.working_hours, wp.is_available,
                wp.service_radius_km, wp.starting_price, wp.pricing_model,
                wp.languages_json, wp.is_verified, wp.verification_badge,
                wp.rating_avg, wp.reviews_count, wp.completed_jobs_count, wp.response_rate,
                s.name as service_name, s.slug as service_slug, s.icon as service_icon
            FROM users u
            JOIN worker_profiles wp ON u.id = wp.user_id
            JOIN services s ON wp.primary_service_id = s.id
            WHERE u.role = 'WORKER' AND u.is_suspended = 0
        `);

        const rankedWorkers = rankWorkers(rawWorkers, {
            targetServiceId: classification.serviceId,
            customerLat,
            customerLng
        });

        return sendJson(res, 200, {
            classification,
            workers: rankedWorkers
        });
    }

    // ==========================================
    // SERVICE REQUESTS & JOB LIFECYCLE
    // ==========================================

    // POST /api/requests (Create new service request)
    if (pathname === '/api/requests' && method === 'POST') {
        if (!user || user.role !== 'CUSTOMER') {
            return sendError(res, 403, 'Please login as a Customer to request services.');
        }

        const body = await parseBody(req);
        const {
            workerId, serviceId, title, description,
            locality, serviceAddress, preferredTime, budget = null,
            images = []
        } = body;

        if (!workerId || !title || !description || !serviceAddress || !preferredTime) {
            return sendError(res, 400, 'Please complete all required request details.');
        }

        const worker = db.get('SELECT u.id, u.full_name, wp.primary_service_id FROM users u JOIN worker_profiles wp ON u.id = wp.user_id WHERE u.id = ? AND u.role = "WORKER"', [workerId]);
        if (!worker) return sendError(res, 404, 'Selected worker is not available.');

        const resolvedServiceId = serviceId || worker.primary_service_id;
        const requestId = 'req_' + crypto.randomUUID().slice(0, 10);
        const lat = user.lat || 12.9784;
        const lng = user.lng || 77.6408;

        db.run(`
            INSERT INTO service_requests (
                id, customer_id, worker_id, service_id, title, description,
                images_json, locality, service_address, lat, lng, preferred_time, budget, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED')
        `, [
            requestId, user.id, workerId, resolvedServiceId, title.trim(), description.trim(),
            JSON.stringify(images), locality || user.locality, serviceAddress.trim(),
            lat, lng, preferredTime, budget ? Number(budget) : null
        ]);

        // Send notification to worker
        createNotification(
            workerId,
            '🔔 New Service Request',
            `${user.full_name} sent a request: "${title}". Preferred time: ${preferredTime}`,
            'NEW_REQUEST',
            `/requests/${requestId}`
        );

        return sendJson(res, 201, {
            success: true,
            requestId,
            message: 'Service request sent successfully to ' + worker.full_name + '!'
        });
    }

    // GET /api/requests (List user requests)
    if (pathname === '/api/requests' && method === 'GET') {
        if (!user) return sendError(res, 401, 'Unauthorized');

        let sql = '';
        let params = [];

        if (user.role === 'CUSTOMER') {
            sql = `
                SELECT 
                    sr.*,
                    w.full_name as worker_name, w.avatar_url as worker_avatar, w.phone as worker_phone,
                    wp.rating_avg as worker_rating, wp.verification_badge,
                    s.name as service_name, s.icon as service_icon
                FROM service_requests sr
                JOIN users w ON sr.worker_id = w.id
                JOIN worker_profiles wp ON w.id = wp.user_id
                JOIN services s ON sr.service_id = s.id
                WHERE sr.customer_id = ?
                ORDER BY sr.created_at DESC
            `;
            params = [user.id];
        } else if (user.role === 'WORKER') {
            sql = `
                SELECT 
                    sr.*,
                    c.full_name as customer_name, c.avatar_url as customer_avatar, c.phone as customer_phone,
                    s.name as service_name, s.icon as service_icon
                FROM service_requests sr
                JOIN users c ON sr.customer_id = c.id
                JOIN services s ON sr.service_id = s.id
                WHERE sr.worker_id = ?
                ORDER BY sr.created_at DESC
            `;
            params = [user.id];
        } else if (user.role === 'ADMIN') {
            sql = `
                SELECT 
                    sr.*,
                    c.full_name as customer_name, w.full_name as worker_name,
                    s.name as service_name, s.icon as service_icon
                FROM service_requests sr
                JOIN users c ON sr.customer_id = c.id
                JOIN users w ON sr.worker_id = w.id
                JOIN services s ON sr.service_id = s.id
                ORDER BY sr.created_at DESC
            `;
        }

        const requests = db.all(sql, params);
        return sendJson(res, 200, { requests });
    }

    // GET /api/requests/:id (Details & timeline)
    if (pathname.startsWith('/api/requests/') && method === 'GET') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const reqId = pathname.split('/')[3];

        const reqDetails = db.get(`
            SELECT 
                sr.*,
                c.full_name as customer_name, c.avatar_url as customer_avatar, c.phone as customer_phone,
                w.full_name as worker_name, w.avatar_url as worker_avatar, w.phone as worker_phone,
                wp.rating_avg as worker_rating, wp.verification_badge, wp.starting_price,
                s.name as service_name, s.icon as service_icon
            FROM service_requests sr
            JOIN users c ON sr.customer_id = c.id
            JOIN users w ON sr.worker_id = w.id
            JOIN worker_profiles wp ON w.id = wp.user_id
            JOIN services s ON sr.service_id = s.id
            WHERE sr.id = ?
        `, [reqId]);

        if (!reqDetails) return sendError(res, 404, 'Service request not found.');

        // Enforce privacy: only parties involved or Admin can view
        if (user.role !== 'ADMIN' && reqDetails.customer_id !== user.id && reqDetails.worker_id !== user.id) {
            return sendError(res, 403, 'Access denied to this service request.');
        }

        // Fetch associated job record if any
        const job = db.get('SELECT * FROM jobs WHERE request_id = ?', [reqId]);

        // Fetch review if completed
        const review = db.get('SELECT * FROM reviews WHERE request_id = ?', [reqId]);

        return sendJson(res, 200, {
            request: reqDetails,
            job,
            review
        });
    }

    // POST /api/requests/:id/status (Lifecycle transitions)
    if (pathname.match(/^\/api\/requests\/[^/]+\/status$/) && method === 'POST') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const reqId = pathname.split('/')[3];
        const body = await parseBody(req);
        const { nextStatus, reason, finalAmount } = body;

        const reqDetails = db.get('SELECT * FROM service_requests WHERE id = ?', [reqId]);
        if (!reqDetails) return sendError(res, 404, 'Request not found.');

        const isWorker = user.id === reqDetails.worker_id;
        const isCustomer = user.id === reqDetails.customer_id;
        const isAdmin = user.role === 'ADMIN';

        if (!isWorker && !isCustomer && !isAdmin) {
            return sendError(res, 403, 'Permission denied.');
        }

        // Allowed Transitions:
        // REQUESTED -> ACCEPTED or DECLINED (Worker)
        // ACCEPTED -> WORKER_ON_THE_WAY (Worker)
        // WORKER_ON_THE_WAY -> ARRIVED (Worker)
        // ARRIVED -> IN_PROGRESS (Worker)
        // IN_PROGRESS -> COMPLETED (Worker)
        // COMPLETED -> REVIEWED (Customer via Review submission)
        // Any -> CANCELLED (Customer or Worker with reason)

        if (nextStatus === 'ACCEPTED') {
            if (!isWorker && !isAdmin) return sendError(res, 403, 'Only the worker can accept this request.');
            db.run(`UPDATE service_requests SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reqId]);
            createNotification(reqDetails.customer_id, '🎉 Request Accepted!', 'Worker has accepted your service request.', 'REQUEST_ACCEPTED', `/requests/${reqId}`);
        } else if (nextStatus === 'DECLINED') {
            if (!isWorker && !isAdmin) return sendError(res, 403, 'Only the worker can decline this request.');
            db.run(`UPDATE service_requests SET status = 'DECLINED', declined_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reason || 'Worker is currently unavailable', reqId]);
            createNotification(reqDetails.customer_id, 'Service Request Declined', 'The worker was unable to accept this booking. Please try other nearby workers.', 'REQUEST_DECLINED', `/requests/${reqId}`);
        } else if (nextStatus === 'WORKER_ON_THE_WAY') {
            if (!isWorker && !isAdmin) return sendError(res, 403, 'Only the worker can update travel status.');
            db.run(`UPDATE service_requests SET status = 'WORKER_ON_THE_WAY', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reqId]);
            createNotification(reqDetails.customer_id, '🚗 Worker On The Way', 'The technician is en route to your location.', 'STATUS_UPDATE', `/requests/${reqId}`);
        } else if (nextStatus === 'ARRIVED') {
            if (!isWorker && !isAdmin) return sendError(res, 403, 'Only the worker can mark arrival.');
            db.run(`UPDATE service_requests SET status = 'ARRIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reqId]);
            createNotification(reqDetails.customer_id, '📍 Worker Arrived', 'The technician has arrived at your address.', 'STATUS_UPDATE', `/requests/${reqId}`);
        } else if (nextStatus === 'IN_PROGRESS') {
            if (!isWorker && !isAdmin) return sendError(res, 403, 'Only the worker can start the job.');
            db.run(`UPDATE service_requests SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reqId]);
            // Create job entry
            const jobId = 'job_' + crypto.randomUUID().slice(0, 8);
            db.run(`
                INSERT OR IGNORE INTO jobs (id, request_id, customer_id, worker_id, status, started_at)
                VALUES (?, ?, ?, ?, 'IN_PROGRESS', CURRENT_TIMESTAMP)
            `, [jobId, reqId, reqDetails.customer_id, reqDetails.worker_id]);
            createNotification(reqDetails.customer_id, '🛠️ Work In Progress', 'The service work is now actively underway.', 'STATUS_UPDATE', `/requests/${reqId}`);
        } else if (nextStatus === 'COMPLETED') {
            if (!isWorker && !isAdmin) return sendError(res, 403, 'Only the worker can mark the job completed.');
            const amount = finalAmount || reqDetails.budget || 350;
            db.run(`UPDATE service_requests SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reqId]);
            db.run(`
                UPDATE jobs 
                SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, final_amount = ?
                WHERE request_id = ?
            `, [amount, reqId]);
            
            // Increment completed jobs count & earnings for worker
            db.run(`
                UPDATE worker_profiles 
                SET completed_jobs_count = completed_jobs_count + 1,
                    total_earnings = total_earnings + ?
                WHERE user_id = ?
            `, [amount, reqDetails.worker_id]);

            createNotification(reqDetails.customer_id, '✅ Job Completed!', `Service completed. Total: ₹${amount}. Please leave a rating and review for your worker.`, 'JOB_COMPLETED', `/requests/${reqId}`);
        } else if (nextStatus === 'CANCELLED') {
            db.run(`UPDATE service_requests SET status = 'CANCELLED', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reason || 'Cancelled by user', reqId]);
            const otherParty = isCustomer ? reqDetails.worker_id : reqDetails.customer_id;
            createNotification(otherParty, 'Service Request Cancelled', `Request "${reqDetails.title}" was cancelled. Reason: ${reason || 'Not specified'}`, 'CANCELLED', `/requests/${reqId}`);
        } else {
            return sendError(res, 400, 'Invalid status transition.');
        }

        return sendJson(res, 200, { success: true, message: `Status updated to ${nextStatus}` });
    }

    // ==========================================
    // IN-APP MESSAGES (CHAT)
    // ==========================================

    // GET /api/messages?requestId=...
    if (pathname === '/api/messages' && method === 'GET') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const reqId = url.searchParams.get('requestId');
        if (!reqId) return sendError(res, 400, 'Request ID required.');

        const reqDetails = db.get('SELECT customer_id, worker_id FROM service_requests WHERE id = ?', [reqId]);
        if (!reqDetails) return sendError(res, 404, 'Request not found.');

        if (user.role !== 'ADMIN' && reqDetails.customer_id !== user.id && reqDetails.worker_id !== user.id) {
            return sendError(res, 403, 'Permission denied.');
        }

        // Mark incoming messages as read
        db.run(`UPDATE messages SET is_read = 1 WHERE request_id = ? AND receiver_id = ?`, [reqId, user.id]);

        const messages = db.all(`
            SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.request_id = ?
            ORDER BY m.created_at ASC
        `, [reqId]);

        return sendJson(res, 200, { messages });
    }

    // POST /api/messages
    if (pathname === '/api/messages' && method === 'POST') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const body = await parseBody(req);
        const { requestId, content, imageUrl = null } = body;

        if (!requestId || (!content && !imageUrl)) {
            return sendError(res, 400, 'Message content or image is required.');
        }

        const reqDetails = db.get('SELECT customer_id, worker_id FROM service_requests WHERE id = ?', [requestId]);
        if (!reqDetails) return sendError(res, 404, 'Service request not found.');

        const isCustomer = user.id === reqDetails.customer_id;
        const isWorker = user.id === reqDetails.worker_id;

        if (!isCustomer && !isWorker && user.role !== 'ADMIN') {
            return sendError(res, 403, 'Permission denied.');
        }

        const receiverId = isCustomer ? reqDetails.worker_id : reqDetails.customer_id;
        const msgId = 'msg_' + crypto.randomUUID().slice(0, 8);

        db.run(`
            INSERT INTO messages (id, request_id, sender_id, receiver_id, content, image_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [msgId, requestId, user.id, receiverId, content.trim(), imageUrl]);

        createNotification(receiverId, `💬 New message from ${user.full_name}`, content.slice(0, 60), 'NEW_MESSAGE', `/requests/${requestId}`);

        return sendJson(res, 201, { success: true, messageId: msgId });
    }

    // ==========================================
    // REVIEWS & RATINGS
    // ==========================================

    // POST /api/reviews
    if (pathname === '/api/reviews' && method === 'POST') {
        if (!user || user.role !== 'CUSTOMER') return sendError(res, 403, 'Only customers can submit reviews.');
        const body = await parseBody(req);
        const {
            requestId, ratingOverall,
            ratingQuality = 5, ratingProfessionalism = 5,
            ratingCommunication = 5, ratingPunctuality = 5, ratingValue = 5,
            comment
        } = body;

        if (!requestId || !ratingOverall || !comment) {
            return sendError(res, 400, 'Rating and written review comments are required.');
        }

        const reqDetails = db.get('SELECT * FROM service_requests WHERE id = ?', [requestId]);
        if (!reqDetails) return sendError(res, 404, 'Request not found.');
        if (reqDetails.customer_id !== user.id) return sendError(res, 403, 'You can only review your own bookings.');
        if (reqDetails.status !== 'COMPLETED' && reqDetails.status !== 'REVIEWED') {
            return sendError(res, 400, 'Reviews can only be submitted after the service job is completed.');
        }

        // Prevent duplicate review
        const existingReview = db.get('SELECT id FROM reviews WHERE request_id = ?', [requestId]);
        if (existingReview) {
            return sendError(res, 409, 'You have already submitted a review for this completed job.');
        }

        const reviewId = 'rev_' + crypto.randomUUID().slice(0, 8);
        db.run(`
            INSERT INTO reviews (
                id, request_id, customer_id, worker_id,
                rating_overall, rating_quality, rating_professionalism,
                rating_communication, rating_punctuality, rating_value,
                comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            reviewId, requestId, user.id, reqDetails.worker_id,
            Number(ratingOverall), Number(ratingQuality), Number(ratingProfessionalism),
            Number(ratingCommunication), Number(ratingPunctuality), Number(ratingValue),
            comment.trim()
        ]);

        // Mark request as REVIEWED
        db.run(`UPDATE service_requests SET status = 'REVIEWED' WHERE id = ?`, [requestId]);

        // Recalculate worker's aggregate rating
        const stats = db.get(`
            SELECT AVG(rating_overall) as avg_rating, COUNT(id) as count 
            FROM reviews 
            WHERE worker_id = ?
        `, [reqDetails.worker_id]);

        if (stats) {
            const newAvg = Math.round(stats.avg_rating * 10) / 10;
            db.run(`
                UPDATE worker_profiles 
                SET rating_avg = ?, reviews_count = ?
                WHERE user_id = ?
            `, [newAvg, stats.count, reqDetails.worker_id]);
        }

        createNotification(
            reqDetails.worker_id,
            '⭐ New Review Received!',
            `${user.full_name} gave you a ${ratingOverall}-star review: "${comment.slice(0, 50)}..."`,
            'NEW_REVIEW',
            `/requests/${requestId}`
        );

        return sendJson(res, 201, { success: true, message: 'Thank you! Your review has been published.' });
    }

    // ==========================================
    // NOTIFICATIONS & BOOKMARKS
    // ==========================================

    // GET /api/notifications
    if (pathname === '/api/notifications' && method === 'GET') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const notifications = db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [user.id]);
        const unreadCount = db.get('SELECT COUNT(id) as count FROM notifications WHERE user_id = ? AND is_read = 0', [user.id]);
        return sendJson(res, 200, { notifications, unreadCount: unreadCount ? unreadCount.count : 0 });
    }

    // POST /api/notifications/read
    if (pathname === '/api/notifications/read' && method === 'POST') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [user.id]);
        return sendJson(res, 200, { success: true });
    }

    // GET /api/saved (Customer Saved Workers)
    if (pathname === '/api/saved' && method === 'GET') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const saved = db.all(`
            SELECT 
                sw.id as saved_id, sw.created_at as saved_at,
                u.id, u.full_name, u.avatar_url, u.locality,
                wp.rating_avg, wp.reviews_count, wp.experience_years, wp.starting_price,
                wp.is_verified, wp.verification_badge, wp.is_available,
                s.name as service_name, s.icon as service_icon
            FROM saved_workers sw
            JOIN users u ON sw.worker_id = u.id
            JOIN worker_profiles wp ON u.id = wp.user_id
            JOIN services s ON wp.primary_service_id = s.id
            WHERE sw.customer_id = ?
            ORDER BY sw.created_at DESC
        `, [user.id]);
        return sendJson(res, 200, { saved });
    }

    // POST /api/saved/toggle
    if (pathname === '/api/saved/toggle' && method === 'POST') {
        if (!user || user.role !== 'CUSTOMER') return sendError(res, 403, 'Customer role required.');
        const body = await parseBody(req);
        const { workerId } = body;

        const existing = db.get('SELECT id FROM saved_workers WHERE customer_id = ? AND worker_id = ?', [user.id, workerId]);
        if (existing) {
            db.run('DELETE FROM saved_workers WHERE id = ?', [existing.id]);
            return sendJson(res, 200, { isSaved: false, message: 'Removed from saved workers.' });
        } else {
            const id = 'sav_' + crypto.randomUUID().slice(0, 8);
            db.run('INSERT INTO saved_workers (id, customer_id, worker_id) VALUES (?, ?, ?)', [id, user.id, workerId]);
            return sendJson(res, 200, { isSaved: true, message: 'Worker saved to favorites!' });
        }
    }

    // ==========================================
    // SAFETY & MODERATION
    // ==========================================

    // POST /api/reports
    if (pathname === '/api/reports' && method === 'POST') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const body = await parseBody(req);
        const { reportedUserId, requestId, reason, details } = body;

        if (!reportedUserId || !reason || !details) {
            return sendError(res, 400, 'Reason and details are required to file a report.');
        }

        const reportId = 'rep_' + crypto.randomUUID().slice(0, 8);
        db.run(`
            INSERT INTO reports (id, reporter_id, reported_user_id, request_id, reason, details, status)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
        `, [reportId, user.id, reportedUserId, requestId || null, reason, details.trim()]);

        return sendJson(res, 201, {
            success: true,
            message: 'Your report has been submitted. Our safety team will review it promptly.'
        });
    }

    // ==========================================
    // ADMIN PORTAL
    // ==========================================

    // GET /api/admin/stats
    if (pathname === '/api/admin/stats' && method === 'GET') {
        if (!user || user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.');

        const totalUsers = db.get('SELECT COUNT(id) as count FROM users');
        const totalCustomers = db.get('SELECT COUNT(id) as count FROM users WHERE role = "CUSTOMER"');
        const totalWorkers = db.get('SELECT COUNT(id) as count FROM users WHERE role = "WORKER"');
        const totalRequests = db.get('SELECT COUNT(id) as count FROM service_requests');
        const completedJobs = db.get('SELECT COUNT(id) as count FROM service_requests WHERE status IN ("COMPLETED", "REVIEWED")');
        const pendingVerifications = db.get('SELECT COUNT(id) as count FROM worker_verifications WHERE status = "PENDING"');
        const openReports = db.get('SELECT COUNT(id) as count FROM reports WHERE status = "PENDING"');
        const avgRating = db.get('SELECT AVG(rating_avg) as avg FROM worker_profiles');

        const popularServices = db.all(`
            SELECT s.name, s.icon, COUNT(sr.id) as request_count
            FROM services s
            LEFT JOIN service_requests sr ON s.id = sr.service_id
            GROUP BY s.id
            ORDER BY request_count DESC
            LIMIT 5
        `);

        return sendJson(res, 200, {
            stats: {
                totalUsers: totalUsers ? totalUsers.count : 0,
                totalCustomers: totalCustomers ? totalCustomers.count : 0,
                totalWorkers: totalWorkers ? totalWorkers.count : 0,
                totalRequests: totalRequests ? totalRequests.count : 0,
                completedJobs: completedJobs ? completedJobs.count : 0,
                pendingVerifications: pendingVerifications ? pendingVerifications.count : 0,
                openReports: openReports ? openReports.count : 0,
                avgRating: avgRating && avgRating.avg ? Math.round(avgRating.avg * 10) / 10 : 4.8
            },
            popularServices
        });
    }

    // GET /api/admin/users
    if (pathname === '/api/admin/users' && method === 'GET') {
        if (!user || user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.');
        const role = url.searchParams.get('role');
        let sql = 'SELECT id, email, role, full_name, phone, city, locality, is_suspended, created_at FROM users';
        let params = [];
        if (role && role !== 'ALL') {
            sql += ' WHERE role = ?';
            params.push(role);
        }
        sql += ' ORDER BY created_at DESC';

        const usersList = db.all(sql, params);
        return sendJson(res, 200, { users: usersList });
    }

    // POST /api/admin/users/toggle-suspend
    if (pathname === '/api/admin/users/toggle-suspend' && method === 'POST') {
        if (!user || user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.');
        const body = await parseBody(req);
        const { userId, notes } = body;

        const targetUser = db.get('SELECT id, is_suspended, full_name FROM users WHERE id = ?', [userId]);
        if (!targetUser) return sendError(res, 404, 'User not found.');

        const newStatus = targetUser.is_suspended ? 0 : 1;
        db.run('UPDATE users SET is_suspended = ? WHERE id = ?', [newStatus, userId]);

        const actionId = 'act_' + crypto.randomUUID().slice(0, 8);
        db.run('INSERT INTO admin_actions (id, admin_id, action_type, target_user_id, notes) VALUES (?, ?, ?, ?, ?)', [
            actionId, user.id, newStatus ? 'SUSPEND_USER' : 'UNSUSPEND_USER', userId, notes || 'Status toggled by Admin'
        ]);

        return sendJson(res, 200, {
            success: true,
            isSuspended: newStatus === 1,
            message: `User ${targetUser.full_name} is now ${newStatus === 1 ? 'suspended' : 'active'}.`
        });
    }

    // GET /api/admin/verifications
    if (pathname === '/api/admin/verifications' && method === 'GET') {
        if (!user || user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.');

        const verifications = db.all(`
            SELECT 
                wv.*,
                u.full_name as worker_name, u.email as worker_email, u.phone as worker_phone,
                s.name as primary_service
            FROM worker_verifications wv
            JOIN users u ON wv.worker_id = u.id
            JOIN worker_profiles wp ON u.id = wp.user_id
            JOIN services s ON wp.primary_service_id = s.id
            ORDER BY wv.submitted_at DESC
        `);

        return sendJson(res, 200, { verifications });
    }

    // POST /api/admin/verifications/decision
    if (pathname === '/api/admin/verifications/decision' && method === 'POST') {
        if (!user || user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.');
        const body = await parseBody(req);
        const { verificationId, decision, adminNotes } = body; // 'APPROVED', 'REJECTED'

        const ver = db.get('SELECT * FROM worker_verifications WHERE id = ?', [verificationId]);
        if (!ver) return sendError(res, 404, 'Verification record not found.');

        db.run(`
            UPDATE worker_verifications 
            SET status = ?, admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [decision, adminNotes || 'Reviewed by Admin', verificationId]);

        if (decision === 'APPROVED') {
            db.run(`
                UPDATE worker_profiles 
                SET is_verified = 1, verification_badge = 'Identity & Profession Verified'
                WHERE user_id = ?
            `, [ver.worker_id]);

            createNotification(ver.worker_id, '🎉 Verification Approved!', 'Congratulations! Your profile is now verified with the official Finder’s Verified Pro badge.', 'VERIFICATION_APPROVED');
        } else if (decision === 'REJECTED') {
            db.run(`
                UPDATE worker_profiles 
                SET is_verified = 0, verification_badge = NULL
                WHERE user_id = ?
            `, [ver.worker_id]);

            createNotification(ver.worker_id, 'Verification Update', `Your verification request was not approved. Reason: ${adminNotes || 'Incomplete documentation.'}`, 'VERIFICATION_REJECTED');
        }

        return sendJson(res, 200, { success: true, message: `Verification has been ${decision.toLowerCase()}.` });
    }

    // GET /api/admin/reports
    if (pathname === '/api/admin/reports' && method === 'GET') {
        if (!user || user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.');

        const reports = db.all(`
            SELECT 
                r.*,
                rep.full_name as reporter_name, rep.role as reporter_role,
                tgt.full_name as reported_user_name, tgt.role as reported_user_role
            FROM reports r
            JOIN users rep ON r.reporter_id = rep.id
            JOIN users tgt ON r.reported_user_id = tgt.id
            ORDER BY r.created_at DESC
        `);

        return sendJson(res, 200, { reports });
    }

    // POST /api/admin/reports/resolve
    if (pathname === '/api/admin/reports/resolve' && method === 'POST') {
        if (!user || user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.');
        const body = await parseBody(req);
        const { reportId, status, adminNotes } = body;

        db.run('UPDATE reports SET status = ?, admin_notes = ? WHERE id = ?', [status, adminNotes || 'Resolved by Admin', reportId]);
        return sendJson(res, 200, { success: true, message: 'Report status updated.' });
    }

    // 404 for unknown API
    return sendError(res, 404, `Endpoint ${method} ${pathname} not found.`);
}

module.exports = { handleApiRequest };

// Finder's — Unified Database Service Layer (MongoDB & Relational Engine)

const crypto = require('node:crypto');
const { mongoDB } = require('./mongodb');
const sqliteDB = require('./db');

const DB_TYPE = process.env.DB_TYPE || (process.env.MONGODB_URI ? 'MONGODB' : 'SQLITE');

class DatabaseService {
    constructor() {
        this.type = DB_TYPE;
        console.log(`🔌 Database Service initialized with engine: ${this.type}`);
    }

    // ==========================================
    // 1. USERS REPOSITORY
    // ==========================================
    async findUserByEmail(email) {
        const cleanEmail = (email || '').toLowerCase().trim();
        if (this.type === 'MONGODB') {
            return await mongoDB.collection('users').findOne({ email: cleanEmail });
        } else {
            return sqliteDB.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
        }
    }

    async findUserById(id) {
        if (this.type === 'MONGODB') {
            return await mongoDB.collection('users').findOne({ _id: id });
        } else {
            return sqliteDB.get('SELECT * FROM users WHERE id = ?', [id]);
        }
    }

    async createUser(userData) {
        const id = userData.id || userData._id || 'usr_' + crypto.randomUUID().slice(0, 10);
        const now = new Date();
        const userObj = {
            id,
            _id: id,
            email: (userData.email || '').toLowerCase().trim(),
            password_hash: userData.password_hash || userData.passwordHash,
            passwordHash: userData.password_hash || userData.passwordHash,
            salt: userData.salt,
            role: userData.role,
            full_name: userData.full_name || userData.fullName,
            fullName: userData.full_name || userData.fullName,
            phone: userData.phone,
            avatar_url: userData.avatar_url || userData.avatarUrl,
            avatarUrl: userData.avatar_url || userData.avatarUrl,
            city: userData.city || 'Bengaluru',
            locality: userData.locality || 'Indiranagar',
            lat: userData.lat || 12.9716,
            lng: userData.lng || 77.5946,
            is_suspended: userData.is_suspended || userData.isSuspended ? 1 : 0,
            isSuspended: Boolean(userData.is_suspended || userData.isSuspended),
            created_at: now,
            updated_at: now
        };

        if (this.type === 'MONGODB') {
            await mongoDB.collection('users').insertOne(userObj);
        } else {
            sqliteDB.run(`
                INSERT INTO users (id, email, password_hash, salt, role, full_name, phone, avatar_url, city, locality, lat, lng, is_suspended)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [userObj.id, userObj.email, userObj.password_hash, userObj.salt, userObj.role, userObj.full_name, userObj.phone, userObj.avatar_url, userObj.city, userObj.locality, userObj.lat, userObj.lng, userObj.is_suspended]);
        }
        return userObj;
    }

    async findAllUsers(roleFilter = null) {
        if (this.type === 'MONGODB') {
            const query = (roleFilter && roleFilter !== 'ALL') ? { role: roleFilter } : {};
            return await mongoDB.collection('users').find(query);
        } else {
            let sql = 'SELECT id, email, role, full_name, phone, city, locality, is_suspended, created_at FROM users';
            const params = [];
            if (roleFilter && roleFilter !== 'ALL') {
                sql += ' WHERE role = ?';
                params.push(roleFilter);
            }
            sql += ' ORDER BY created_at DESC';
            return sqliteDB.all(sql, params);
        }
    }

    async toggleUserSuspension(userId, isSuspended) {
        if (this.type === 'MONGODB') {
            await mongoDB.collection('users').updateOne({ _id: userId }, { $set: { isSuspended: Boolean(isSuspended), is_suspended: isSuspended ? 1 : 0 } });
        } else {
            sqliteDB.run('UPDATE users SET is_suspended = ? WHERE id = ?', [isSuspended ? 1 : 0, userId]);
        }
    }

    // ==========================================
    // 2. WORKER PROFILES REPOSITORY
    // ==========================================
    async createWorkerProfile(profileData) {
        const userId = profileData.userId || profileData.user_id;
        const profileObj = {
            _id: 'prof_' + userId,
            userId,
            user_id: userId,
            primaryServiceId: profileData.primaryServiceId || profileData.primary_service_id || 'srv_elec',
            primary_service_id: profileData.primaryServiceId || profileData.primary_service_id || 'srv_elec',
            secondaryServices: profileData.secondaryServices || profileData.secondary_services || [],
            secondary_services_json: JSON.stringify(profileData.secondaryServices || []),
            experienceYears: Number(profileData.experienceYears || profileData.experience_years || 1),
            experience_years: Number(profileData.experienceYears || profileData.experience_years || 1),
            bio: profileData.bio || '',
            skills: profileData.skills || [],
            skills_json: JSON.stringify(profileData.skills || []),
            workingHours: profileData.workingHours || '09:00 AM - 07:00 PM',
            working_hours: profileData.workingHours || '09:00 AM - 07:00 PM',
            isAvailable: true,
            is_available: 1,
            serviceRadiusKm: Number(profileData.serviceRadiusKm || 8.0),
            service_radius_km: Number(profileData.serviceRadiusKm || 8.0),
            startingPrice: Number(profileData.startingPrice || profileData.starting_price || 250),
            starting_price: Number(profileData.startingPrice || profileData.starting_price || 250),
            isVerified: false,
            is_verified: 0,
            ratingAvg: 5.0,
            rating_avg: 5.0,
            reviewsCount: 0,
            reviews_count: 0,
            completedJobsCount: 0,
            completed_jobs_count: 0,
            totalEarnings: 0.0,
            total_earnings: 0.0
        };

        if (this.type === 'MONGODB') {
            await mongoDB.collection('worker_profiles').insertOne(profileObj);
        } else {
            sqliteDB.run(`
                INSERT INTO worker_profiles (
                    user_id, primary_service_id, secondary_services_json, experience_years, bio,
                    skills_json, working_hours, is_available, service_radius_km, starting_price,
                    is_verified, rating_avg, reviews_count, completed_jobs_count, total_earnings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 5.0, 0, 0, 0)
            `, [
                profileObj.user_id, profileObj.primary_service_id, profileObj.secondary_services_json,
                profileObj.experience_years, profileObj.bio, profileObj.skills_json,
                profileObj.working_hours, profileObj.is_available, profileObj.service_radius_km, profileObj.starting_price
            ]);
        }
        return profileObj;
    }

    async findWorkerProfileByUserId(userId) {
        if (this.type === 'MONGODB') {
            return await mongoDB.collection('worker_profiles').findOne({ userId });
        } else {
            return sqliteDB.get('SELECT * FROM worker_profiles WHERE user_id = ?', [userId]);
        }
    }

    async updateWorkerAvailability(userId, isAvailable, radius, price, hours) {
        if (this.type === 'MONGODB') {
            const updates = {};
            if (isAvailable !== undefined) {
                updates.isAvailable = Boolean(isAvailable);
                updates.is_available = isAvailable ? 1 : 0;
            }
            if (radius) updates.serviceRadiusKm = Number(radius);
            if (price) updates.startingPrice = Number(price);
            if (hours) updates.workingHours = hours;
            await mongoDB.collection('worker_profiles').updateOne({ userId }, { $set: updates });
        } else {
            sqliteDB.run(`
                UPDATE worker_profiles
                SET is_available = COALESCE(?, is_available),
                    service_radius_km = COALESCE(?, service_radius_km),
                    starting_price = COALESCE(?, starting_price),
                    working_hours = COALESCE(?, working_hours)
                WHERE user_id = ?
            `, [isAvailable !== undefined ? (isAvailable ? 1 : 0) : null, radius, price, hours, userId]);
        }
    }

    // ==========================================
    // 3. SERVICES REPOSITORY
    // ==========================================
    async findAllServices() {
        if (this.type === 'MONGODB') {
            return await mongoDB.collection('services').find({});
        } else {
            return sqliteDB.all('SELECT * FROM services ORDER BY is_popular DESC, name ASC');
        }
    }

    async findServiceById(id) {
        if (this.type === 'MONGODB') {
            return await mongoDB.collection('services').findOne({ _id: id });
        } else {
            return sqliteDB.get('SELECT * FROM services WHERE id = ?', [id]);
        }
    }

    // ==========================================
    // 4. SERVICE REQUESTS & BOOKINGS
    // ==========================================
    async createServiceRequest(reqData) {
        const id = 'req_' + crypto.randomUUID().slice(0, 10);
        const reqObj = {
            id,
            _id: id,
            customer_id: reqData.customerId || reqData.customer_id,
            customerId: reqData.customerId || reqData.customer_id,
            worker_id: reqData.workerId || reqData.worker_id,
            workerId: reqData.workerId || reqData.worker_id,
            service_id: reqData.serviceId || reqData.service_id,
            serviceId: reqData.serviceId || reqData.service_id,
            title: reqData.title,
            description: reqData.description,
            images: reqData.images || [],
            images_json: JSON.stringify(reqData.images || []),
            locality: reqData.locality,
            service_address: reqData.serviceAddress || reqData.service_address,
            serviceAddress: reqData.serviceAddress || reqData.service_address,
            lat: reqData.lat || 12.9784,
            lng: reqData.lng || 77.6408,
            preferred_time: reqData.preferredTime || reqData.preferred_time,
            preferredTime: reqData.preferredTime || reqData.preferred_time,
            budget: reqData.budget ? Number(reqData.budget) : null,
            status: 'REQUESTED',
            created_at: new Date(),
            updated_at: new Date()
        };

        if (this.type === 'MONGODB') {
            await mongoDB.collection('service_requests').insertOne(reqObj);
        } else {
            sqliteDB.run(`
                INSERT INTO service_requests (
                    id, customer_id, worker_id, service_id, title, description,
                    images_json, locality, service_address, lat, lng, preferred_time, budget, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED')
            `, [
                reqObj.id, reqObj.customer_id, reqObj.worker_id, reqObj.service_id, reqObj.title, reqObj.description,
                reqObj.images_json, reqObj.locality, reqObj.service_address, reqObj.lat, reqObj.lng, reqObj.preferred_time, reqObj.budget
            ]);
        }
        return reqObj;
    }

    async findServiceRequestById(id) {
        return sqliteDB.get(`
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
        `, [id]);
    }
}

const dbService = new DatabaseService();

module.exports = dbService;

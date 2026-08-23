-- Finder's Platform Database Schema
-- Optimized for SQLite & Relational Structure

-- 1. Users Table (Core Auth & Profile)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('CUSTOMER', 'WORKER', 'ADMIN')),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    avatar_url TEXT,
    city TEXT NOT NULL DEFAULT 'Bengaluru',
    locality TEXT NOT NULL DEFAULT 'Indiranagar',
    lat REAL DEFAULT 12.9716,
    lng REAL DEFAULT 77.5946,
    is_suspended INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Customer Profiles Table
CREATE TABLE IF NOT EXISTS customer_profiles (
    user_id TEXT PRIMARY KEY,
    preferred_locality TEXT,
    saved_addresses_json TEXT DEFAULT '[]',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Services Directory (Categories & Base Pricing)
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT NOT NULL,
    base_price REAL NOT NULL,
    is_popular INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- 4. Worker Profiles Table
CREATE TABLE IF NOT EXISTS worker_profiles (
    user_id TEXT PRIMARY KEY,
    primary_service_id TEXT NOT NULL,
    secondary_services_json TEXT DEFAULT '[]',
    experience_years INTEGER NOT NULL DEFAULT 1,
    bio TEXT NOT NULL,
    skills_json TEXT DEFAULT '[]',
    working_hours TEXT DEFAULT '09:00 AM - 07:00 PM',
    is_available INTEGER NOT NULL DEFAULT 1,
    service_radius_km REAL NOT NULL DEFAULT 8.0,
    starting_price REAL NOT NULL DEFAULT 250.0,
    pricing_model TEXT DEFAULT 'Starting / Per Visit',
    languages_json TEXT DEFAULT '["English", "Hindi"]',
    is_verified INTEGER NOT NULL DEFAULT 0,
    verification_badge TEXT,
    rating_avg REAL NOT NULL DEFAULT 5.0,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    completed_jobs_count INTEGER NOT NULL DEFAULT 0,
    response_rate INTEGER NOT NULL DEFAULT 98,
    total_earnings REAL NOT NULL DEFAULT 0.0,
    portfolio_images_json TEXT DEFAULT '[]',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(primary_service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_worker_service ON worker_profiles(primary_service_id);
CREATE INDEX IF NOT EXISTS idx_worker_available ON worker_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_worker_verified ON worker_profiles(is_verified);

-- 5. Worker Specific Custom Services & Pricing
CREATE TABLE IF NOT EXISTS worker_services (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    custom_price REAL NOT NULL,
    description TEXT,
    FOREIGN KEY(worker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- 6. Locations Reference
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    locality TEXT NOT NULL,
    pincode TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL
);

-- 7. Service Requests Table (Job Bookings)
CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    images_json TEXT DEFAULT '[]',
    locality TEXT NOT NULL,
    service_address TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    preferred_time TEXT NOT NULL,
    budget REAL,
    status TEXT NOT NULL CHECK(status IN ('REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'WORKER_ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED')),
    cancellation_reason TEXT,
    declined_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(worker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_requests_customer ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_requests_worker ON service_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status);

-- 8. Jobs Execution Table
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    request_id TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at DATETIME,
    completed_at DATETIME,
    final_amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY(customer_id) REFERENCES users(id),
    FOREIGN KEY(worker_id) REFERENCES users(id)
);

-- 9. In-App Messages (Chat)
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);

-- 10. Reviews & Multi-Criteria Ratings
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    request_id TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    rating_overall REAL NOT NULL CHECK(rating_overall >= 1 AND rating_overall <= 5),
    rating_quality REAL NOT NULL DEFAULT 5,
    rating_professionalism REAL NOT NULL DEFAULT 5,
    rating_communication REAL NOT NULL DEFAULT 5,
    rating_punctuality REAL NOT NULL DEFAULT 5,
    rating_value REAL NOT NULL DEFAULT 5,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY(customer_id) REFERENCES users(id),
    FOREIGN KEY(worker_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_worker ON reviews(worker_id);

-- 11. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- 12. Safety & Moderation Reports
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    reported_user_id TEXT NOT NULL,
    request_id TEXT,
    reason TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reporter_id) REFERENCES users(id),
    FOREIGN KEY(reported_user_id) REFERENCES users(id)
);

-- 13. Worker Verifications Queue
CREATE TABLE IF NOT EXISTS worker_verifications (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    id_type TEXT NOT NULL,
    id_number TEXT NOT NULL,
    document_name TEXT NOT NULL,
    cert_name TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO')),
    admin_notes TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY(worker_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 14. Saved Workers (Customer Bookmarks)
CREATE TABLE IF NOT EXISTS saved_workers (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, worker_id),
    FOREIGN KEY(customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(worker_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 15. Admin Actions Log
CREATE TABLE IF NOT EXISTS admin_actions (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_user_id TEXT,
    notes TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES users(id)
);

-- 16. Form Submissions & Live Customer Leads Desk (Comes directly to Owner)
CREATE TABLE IF NOT EXISTS form_submissions (
    id TEXT PRIMARY KEY,
    form_type TEXT NOT NULL CHECK(form_type IN ('CUSTOMER_SIGNUP', 'WORKER_SIGNUP', 'SERVICE_REQUEST', 'QUICK_INQUIRY', 'VERIFICATION_SUBMISSION')),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT DEFAULT 'Bengaluru',
    locality TEXT,
    service_needed TEXT,
    budget REAL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW', 'CONTACTED', 'IN_PROGRESS', 'RESOLVED', 'CONVERTED')),
    notes TEXT,
    raw_data_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_leads_type ON form_submissions(form_type);


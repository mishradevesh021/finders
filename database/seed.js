const db = require('./db');
const { hashPassword } = require('../server/auth');

function seedDatabase() {
    console.log("🌱 Seeding Finder's database with realistic production data...");

    // Clean existing tables
    db.exec(`
        DELETE FROM admin_actions;
        DELETE FROM saved_workers;
        DELETE FROM worker_verifications;
        DELETE FROM reports;
        DELETE FROM notifications;
        DELETE FROM reviews;
        DELETE FROM messages;
        DELETE FROM jobs;
        DELETE FROM service_requests;
        DELETE FROM worker_services;
        DELETE FROM worker_profiles;
        DELETE FROM customer_profiles;
        DELETE FROM services;
        DELETE FROM users;
    `);

    // 1. Services
    const services = [
        {
            id: 'srv_elec',
            name: 'Electrical',
            slug: 'electrical',
            category: 'Home Maintenance',
            icon: '⚡',
            description: 'Fan repair, short circuits, switchboards, wiring, MCB & geysers',
            base_price: 250,
            is_popular: 1
        },
        {
            id: 'srv_plumb',
            name: 'Plumbing',
            slug: 'plumbing',
            category: 'Home Maintenance',
            icon: '🔧',
            description: 'Pipe leaks, tap replacement, drainage blockages & bathroom fittings',
            base_price: 249,
            is_popular: 1
        },
        {
            id: 'srv_ac',
            name: 'AC Repair',
            slug: 'ac-repair',
            category: 'Appliances',
            icon: '❄️',
            description: 'Split & window AC servicing, gas charging, cooling issues & installation',
            base_price: 399,
            is_popular: 1
        },
        {
            id: 'srv_carp',
            name: 'Carpentry',
            slug: 'carpentry',
            category: 'Home Improvement',
            icon: '🪚',
            description: 'Door repair, furniture assembly, lock replacement & custom woodcraft',
            base_price: 299,
            is_popular: 1
        },
        {
            id: 'srv_clean',
            name: 'Cleaning',
            slug: 'cleaning',
            category: 'Cleaning',
            icon: '🧹',
            description: 'Deep bathroom, kitchen, sofa, mattress & full home sanitation',
            base_price: 499,
            is_popular: 1
        },
        {
            id: 'srv_mech',
            name: 'Mechanic',
            slug: 'mechanic',
            category: 'Automotive',
            icon: '🏍️',
            description: 'Two-wheeler & four-wheeler roadside assistance, punctures & oil change',
            base_price: 199,
            is_popular: 1
        },
        {
            id: 'srv_paint',
            name: 'Painting',
            slug: 'painting',
            category: 'Home Improvement',
            icon: '🎨',
            description: 'Interior & exterior painting, water seepage touchups & texture coats',
            base_price: 350,
            is_popular: 0
        },
        {
            id: 'srv_app',
            name: 'Appliance Repair',
            slug: 'appliance-repair',
            category: 'Appliances',
            icon: '📺',
            description: 'Washing machine, refrigerator, microwave oven & TV diagnostics',
            base_price: 299,
            is_popular: 1
        },
        {
            id: 'srv_cctv',
            name: 'CCTV & Wi-Fi',
            slug: 'cctv-wifi',
            category: 'Security & Network',
            icon: '📡',
            description: 'Security camera installation, DVR configuration, Wi-Fi mesh setup',
            base_price: 399,
            is_popular: 0
        },
        {
            id: 'srv_gadget',
            name: 'Electronics Repair',
            slug: 'electronics-repair',
            category: 'Gadgets',
            icon: '📱',
            description: 'Laptop hardware repair, screen replacement, smartphone battery swap',
            base_price: 299,
            is_popular: 0
        }
    ];

    const insertService = db.rawDB().prepare(`
        INSERT INTO services (id, name, slug, category, icon, description, base_price, is_popular)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    services.forEach(s => insertService.run(s.id, s.name, s.slug, s.category, s.icon, s.description, s.base_price, s.is_popular));

    // Default Passwords
    const defaultAuth = hashPassword('password123');

    // 2. Admin User
    const adminId = 'usr_admin_001';
    db.run(`
        INSERT INTO users (id, email, password_hash, salt, role, full_name, phone, avatar_url, city, locality, lat, lng)
        VALUES (?, ?, ?, ?, 'ADMIN', ?, ?, ?, ?, ?, ?, ?)
    `, [adminId, 'admin@finders.com', defaultAuth.hash, defaultAuth.salt, 'Finder’s Administrator', '+91 99000 00001', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Bengaluru', 'Koramangala', 12.9352, 77.6245]);

    // 3. Customer User (Devesh Mishra)
    const customerId = 'usr_cust_devesh';
    db.run(`
        INSERT INTO users (id, email, password_hash, salt, role, full_name, phone, avatar_url, city, locality, lat, lng)
        VALUES (?, ?, ?, ?, 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?)
    `, [customerId, 'customer@finders.com', defaultAuth.hash, defaultAuth.salt, 'Devesh Mishra', '+91 98765 43210', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80', 'Bengaluru', 'Indiranagar', 12.9784, 77.6408]);

    db.run(`
        INSERT INTO customer_profiles (user_id, preferred_locality, saved_addresses_json)
        VALUES (?, ?, ?)
    `, [customerId, 'Indiranagar 12th Main', JSON.stringify([
        { tag: 'Home', address: '#42, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru' },
        { tag: 'Office', address: 'Tech Park, Tower B, Domlur, Bengaluru' }
    ])]);

    // 4. Workers
    const workersData = [
        {
            id: 'usr_wrk_rahul',
            email: 'electrician@finders.com',
            name: 'Rahul Kumar',
            phone: '+91 98111 22334',
            avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
            locality: 'Domlur',
            lat: 12.9610,
            lng: 77.6387,
            primaryServiceId: 'srv_elec',
            secondaryServices: ['srv_app', 'srv_cctv'],
            expYears: 8,
            bio: 'Certified electrical technician with 8 years of on-site experience in domestic wiring, ceiling fan motor overhaul, modular switchboards, and inverter connections. Punctual, courteous, and equipped with genuine tools.',
            skills: ['Ceiling Fan Repair', 'MCB Troubleshooting', 'Inverter Wiring', 'Modular Switches', 'LED Downlights', 'Geyser Installation'],
            workingHours: '08:30 AM - 08:00 PM',
            isAvailable: 1,
            radiusKm: 8.0,
            startPrice: 250,
            pricingModel: 'Starting from ₹250 (Inspection included if repaired)',
            languages: ['English', 'Hindi', 'Kannada'],
            isVerified: 1,
            badge: 'Identity & Skill Verified',
            rating: 4.8,
            reviewsCount: 126,
            completedJobs: 342,
            earnings: 85500
        },
        {
            id: 'usr_wrk_suresh',
            email: 'plumber@finders.com',
            name: 'Suresh Patil',
            phone: '+91 98222 33445',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
            locality: 'Ulsoor',
            lat: 12.9817,
            lng: 77.6286,
            primaryServiceId: 'srv_plumb',
            secondaryServices: [],
            expYears: 10,
            bio: 'Master plumber specializing in concealed pipe leak detection, kitchen sink clogs, bathroom jet sprays, overhead tank float valves, and CPVC piping overhauls.',
            skills: ['Leak Detection', 'Drain Unclogging', 'Water Tank Repair', 'Faucet & Tap Replacement', 'Flush Tank Mechanism'],
            workingHours: '08:00 AM - 07:30 PM',
            isAvailable: 1,
            radiusKm: 7.5,
            startPrice: 249,
            pricingModel: 'Per Visit / Inspection',
            languages: ['English', 'Kannada', 'Hindi'],
            isVerified: 1,
            badge: 'Identity Verified',
            rating: 4.9,
            reviewsCount: 98,
            completedJobs: 280,
            earnings: 69700
        },
        {
            id: 'usr_wrk_amit',
            email: 'ac@finders.com',
            name: 'Amit Sharma',
            phone: '+91 98333 44556',
            avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
            locality: 'Koramangala',
            lat: 12.9352,
            lng: 77.6245,
            primaryServiceId: 'srv_ac',
            secondaryServices: ['srv_app'],
            expYears: 6,
            bio: 'Experienced HVAC & split AC maintenance expert. Deep jet pump cleaning, eco-friendly gas refilling (R32, R410A), PCB board diagnosis, and copper pipe leak fixing.',
            skills: ['Jet Pump Service', 'Gas Leak Fix & Refill', 'PCB Repair', 'AC Uninstallation / Installation', 'Compressor Check'],
            workingHours: '09:00 AM - 08:30 PM',
            isAvailable: 1,
            radiusKm: 10.0,
            startPrice: 399,
            pricingModel: 'Standard Servicing & Diagnostics',
            languages: ['English', 'Hindi'],
            isVerified: 1,
            badge: 'Profession Verified',
            rating: 4.7,
            reviewsCount: 84,
            completedJobs: 215,
            earnings: 85700
        },
        {
            id: 'usr_wrk_priya',
            email: 'cleaner@finders.com',
            name: 'Priya Verma',
            phone: '+91 98444 55667',
            avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
            locality: 'Indiranagar 100ft Rd',
            lat: 12.9720,
            lng: 77.6440,
            primaryServiceId: 'srv_clean',
            secondaryServices: [],
            expYears: 5,
            bio: 'Professional deep cleaning leader with mechanized scrubbers and eco-friendly disinfectants. Expert in kitchen degreasing, bathroom hard water stain removal, and sofa shampooing.',
            skills: ['Bathroom Deep Clean', 'Kitchen Degreasing', 'Sofa Fabric Shampoo', 'Balcony Scrubbing', 'Tile Polishing'],
            workingHours: '08:30 AM - 06:30 PM',
            isAvailable: 1,
            radiusKm: 6.0,
            startPrice: 499,
            pricingModel: 'Starting from ₹499',
            languages: ['English', 'Hindi', 'Tamil'],
            isVerified: 1,
            badge: 'Identity Verified',
            rating: 4.9,
            reviewsCount: 110,
            completedJobs: 195,
            earnings: 97300
        },
        {
            id: 'usr_wrk_rajesh',
            email: 'carpenter@finders.com',
            name: 'Rajesh Sharma',
            phone: '+91 98555 66778',
            avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
            locality: 'HAL 2nd Stage',
            lat: 12.9650,
            lng: 77.6520,
            primaryServiceId: 'srv_carp',
            secondaryServices: [],
            expYears: 9,
            bio: 'Craftsman with 9 years creating and fixing bespoke wooden furniture, hydraulic hinges, mortise locks, sliding wardrobe rollers, and drywall wood panels.',
            skills: ['Furniture Assembly', 'Door Lock & Latch Fix', 'Wardrobe Rollers', 'Kitchen Cabinet Realignment', 'Drilling & Wall Hanging'],
            workingHours: '09:00 AM - 07:00 PM',
            isAvailable: 1,
            radiusKm: 8.0,
            startPrice: 299,
            pricingModel: 'Per Job / Per Hour',
            languages: ['Hindi', 'Kannada', 'English'],
            isVerified: 1,
            badge: 'Profession Verified',
            rating: 4.6,
            reviewsCount: 62,
            completedJobs: 154,
            earnings: 46000
        },
        {
            id: 'usr_wrk_vikram',
            email: 'mechanic@finders.com',
            name: 'Vikram Singh',
            phone: '+91 98666 77889',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
            locality: 'Old Airport Road',
            lat: 12.9590,
            lng: 77.6580,
            primaryServiceId: 'srv_mech',
            secondaryServices: [],
            expYears: 7,
            bio: 'Quick on-spot roadside assistance for two-wheelers and passenger cars. Tubeless puncture patching, battery jump-start, brake shoe replacement, and drive chain adjustment.',
            skills: ['Battery Jump Start', 'Tubeless Puncture Patch', 'Brake Tuning', 'Engine Oil Change', 'Clutch Cable Replacement'],
            workingHours: '07:30 AM - 09:30 PM',
            isAvailable: 1,
            radiusKm: 12.0,
            startPrice: 199,
            pricingModel: 'Starting from ₹199',
            languages: ['English', 'Hindi', 'Punjabi'],
            isVerified: 1,
            badge: 'Identity & Skill Verified',
            rating: 4.8,
            reviewsCount: 145,
            completedJobs: 410,
            earnings: 81600
        }
    ];

    for (const w of workersData) {
        db.run(`
            INSERT INTO users (id, email, password_hash, salt, role, full_name, phone, avatar_url, city, locality, lat, lng)
            VALUES (?, ?, ?, ?, 'WORKER', ?, ?, ?, 'Bengaluru', ?, ?, ?)
        `, [w.id, w.email, defaultAuth.hash, defaultAuth.salt, w.name, w.phone, w.avatar, w.locality, w.lat, w.lng]);

        db.run(`
            INSERT INTO worker_profiles (
                user_id, primary_service_id, secondary_services_json, experience_years, bio,
                skills_json, working_hours, is_available, service_radius_km, starting_price,
                pricing_model, languages_json, is_verified, verification_badge, rating_avg,
                reviews_count, completed_jobs_count, total_earnings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            w.id, w.primaryServiceId, JSON.stringify(w.secondaryServices), w.expYears, w.bio,
            JSON.stringify(w.skills), w.workingHours, w.isAvailable, w.radiusKm, w.startPrice,
            w.pricingModel, JSON.stringify(w.languages), w.isVerified, w.badge, w.rating,
            w.reviewsCount, w.completedJobs, w.earnings
        ]);

        // Add verification entry
        db.run(`
            INSERT INTO worker_verifications (id, worker_id, id_type, id_number, document_name, cert_name, status, admin_notes, submitted_at, reviewed_at)
            VALUES (?, ?, 'Government ID & Trade License', 'ID-99281-VERIFIED', 'government_id_card.pdf', 'Vocational Skill Certification', 'APPROVED', 'Verified by Admin team.', datetime('now', '-30 days'), datetime('now', '-29 days'))
        `, [`ver_${w.id}`, w.id]);
    }

    // 5. Seed a Past Completed Service Request with Review for Rahul Kumar
    const sampleReqId = 'req_demo_completed_001';
    db.run(`
        INSERT INTO service_requests (
            id, customer_id, worker_id, service_id, title, description,
            locality, service_address, lat, lng, preferred_time, budget, status, created_at, updated_at
        ) VALUES (
            ?, ?, ?, 'srv_elec', 'Kitchen Exhaust & Light Fitting',
            'Installed a new high-speed kitchen exhaust fan and replaced 3 flickering ceiling downlights.',
            'Indiranagar', '#42, 12th Main Rd, HAL 2nd Stage, Indiranagar',
            12.9784, 77.6408, 'Completed', 450, 'COMPLETED',
            datetime('now', '-5 days'), datetime('now', '-5 days')
        )
    `, [sampleReqId, customerId, 'usr_wrk_rahul']);

    db.run(`
        INSERT INTO jobs (id, request_id, customer_id, worker_id, status, started_at, completed_at, final_amount)
        VALUES ('job_demo_001', ?, ?, 'usr_wrk_rahul', 'COMPLETED', datetime('now', '-5 days', '+1 hour'), datetime('now', '-5 days', '+3 hours'), 450)
    `, [sampleReqId, customerId]);

    db.run(`
        INSERT INTO reviews (
            id, request_id, customer_id, worker_id,
            rating_overall, rating_quality, rating_professionalism,
            rating_communication, rating_punctuality, rating_value,
            comment, created_at
        ) VALUES (
            'rev_demo_001', ?, ?, 'usr_wrk_rahul',
            5.0, 5, 5, 5, 5, 5,
            'Rahul arrived right on time with all required tools. Replaced our exhaust fan quickly and even cleaned up the debris after drilling. Highly recommended!',
            datetime('now', '-5 days')
        )
    `, [sampleReqId, customerId]);

    // Sample Chat message
    db.run(`
        INSERT INTO messages (id, request_id, sender_id, receiver_id, content, created_at)
        VALUES 
        ('msg_001', ?, ?, 'usr_wrk_rahul', 'Hi Rahul, I need assistance with the kitchen exhaust fan.', datetime('now', '-5 days', '+10 minutes')),
        ('msg_002', ?, 'usr_wrk_rahul', ?, 'Hello Devesh ji, I am 10 minutes away. Bringing the standard fittings.', datetime('now', '-5 days', '+15 minutes'))
    `, [sampleReqId, customerId, sampleReqId, customerId]);

    // 6. Seed a sample Pending Verification to test Admin review flow
    const pendingWorkerId = 'usr_wrk_pending';
    db.run(`
        INSERT INTO users (id, email, password_hash, salt, role, full_name, phone, avatar_url, city, locality, lat, lng)
        VALUES (?, 'newpainter@finders.com', ?, ?, 'WORKER', 'Karan Mehta', '+91 98999 11223', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', 'Bengaluru', 'Koramangala', 12.9350, 77.6250)
    `, [pendingWorkerId, defaultAuth.hash, defaultAuth.salt]);

    db.run(`
        INSERT INTO worker_profiles (
            user_id, primary_service_id, experience_years, bio, skills_json,
            working_hours, is_available, starting_price, is_verified, rating_avg, reviews_count
        ) VALUES (
            ?, 'srv_paint', 4, 'Skilled painter for interior emulsions and waterproofing texture coating.',
            '["Wall Painting", "Texture Finish", "Waterproofing"]', '09:00 AM - 06:00 PM', 1, 350, 0, 5.0, 0
        )
    `, [pendingWorkerId]);

    db.run(`
        INSERT INTO worker_verifications (id, worker_id, id_type, id_number, document_name, cert_name, status, submitted_at)
        VALUES ('ver_pending_001', ?, 'National ID & Trade Proof', 'ID-88412-PENDING', 'painter_trade_id.pdf', 'Interior Coating Certificate', 'PENDING', datetime('now', '-2 hours'))
    `, [pendingWorkerId]);

    console.log("✅ Finder's database successfully seeded!");
    console.log("--------------------------------------------------");
    console.log("👥 Demo Accounts:");
    console.log("1. Customer: customer@finders.com / password123 (Devesh Mishra)");
    console.log("2. Worker:   electrician@finders.com / password123 (Rahul Kumar - 4.8★, 2.4 km)");
    console.log("3. Worker:   plumber@finders.com / password123 (Suresh Patil - 4.9★, 1.8 km)");
    console.log("4. Worker:   ac@finders.com / password123 (Amit Sharma - 4.7★, 3.1 km)");
    console.log("5. Worker:   cleaner@finders.com / password123 (Priya Verma - 4.9★, 1.5 km)");
    console.log("6. Admin:    admin@finders.com / password123 (Super Administrator)");
    console.log("--------------------------------------------------");
}

if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;

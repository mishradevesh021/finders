// Finder's — MongoDB Database Seeder

const { mongoDB } = require('./mongodb');
const { hashPassword } = require('../server/auth');

async function seedMongoDB() {
    console.log("\n========================================================");
    console.log("🍃 Seeding Finder's MongoDB Collections...");
    console.log("========================================================\n");

    await mongoDB.connect();

    // 1. Clear existing collections
    const collections = ['users', 'customer_profiles', 'worker_profiles', 'services', 'service_requests', 'jobs', 'messages', 'reviews', 'notifications', 'reports', 'worker_verifications', 'saved_workers'];
    for (const c of collections) {
        await mongoDB.collection(c).deleteMany({});
    }

    // 2. Seed Services
    const services = [
        { _id: 'srv_elec', name: 'Electrical', slug: 'electrical', category: 'Home Maintenance', icon: '⚡', description: 'Fan repair, short circuits, switchboards, wiring, MCB & geysers', basePrice: 250, isPopular: true },
        { _id: 'srv_plumb', name: 'Plumbing', slug: 'plumbing', category: 'Home Maintenance', icon: '🔧', description: 'Pipe leaks, tap replacement, drainage blockages & bathroom fittings', basePrice: 249, isPopular: true },
        { _id: 'srv_ac', name: 'AC Repair', slug: 'ac-repair', category: 'Appliances', icon: '❄️', description: 'Split & window AC servicing, gas charging, cooling issues & installation', basePrice: 399, isPopular: true },
        { _id: 'srv_carp', name: 'Carpentry', slug: 'carpentry', category: 'Home Improvement', icon: '🪚', description: 'Door repair, furniture assembly, lock replacement & custom woodcraft', basePrice: 299, isPopular: true },
        { _id: 'srv_clean', name: 'Cleaning', slug: 'cleaning', category: 'Cleaning', icon: '🧹', description: 'Deep bathroom, kitchen, sofa, mattress & full home sanitation', basePrice: 499, isPopular: true },
        { _id: 'srv_mech', name: 'Mechanic', slug: 'mechanic', category: 'Automotive', icon: '🏍️', description: 'Two-wheeler & four-wheeler roadside assistance, punctures & oil change', basePrice: 199, isPopular: true },
        { _id: 'srv_paint', name: 'Painting', slug: 'painting', category: 'Home Improvement', icon: '🎨', description: 'Interior & exterior painting, water seepage touchups & texture coats', basePrice: 350, isPopular: false },
        { _id: 'srv_app', name: 'Appliance Repair', slug: 'appliance-repair', category: 'Appliances', icon: '📺', description: 'Washing machine, refrigerator, microwave oven & TV diagnostics', basePrice: 299, isPopular: true },
        { _id: 'srv_cctv', name: 'CCTV & Wi-Fi', slug: 'cctv-wifi', category: 'Security & Network', icon: '📡', description: 'Security camera installation, DVR configuration, Wi-Fi mesh setup', basePrice: 399, isPopular: false },
        { _id: 'srv_gadget', name: 'Electronics Repair', slug: 'electronics-repair', category: 'Gadgets', icon: '📱', description: 'Laptop hardware repair, screen replacement, smartphone battery swap', basePrice: 299, isPopular: false }
    ];
    await mongoDB.collection('services').insertMany(services);

    const defaultAuth = hashPassword('password123');

    // 3. Admin User
    await mongoDB.collection('users').insertOne({
        _id: 'usr_admin_001',
        email: 'admin@finders.com',
        passwordHash: defaultAuth.hash,
        salt: defaultAuth.salt,
        role: 'ADMIN',
        fullName: 'Finder’s Administrator',
        phone: '+91 99000 00001',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        city: 'Bengaluru',
        locality: 'Koramangala',
        lat: 12.9352,
        lng: 77.6245,
        isSuspended: false
    });

    // 4. Customer User (Devesh Mishra)
    const customerId = 'usr_cust_devesh';
    await mongoDB.collection('users').insertOne({
        _id: customerId,
        email: 'customer@finders.com',
        passwordHash: defaultAuth.hash,
        salt: defaultAuth.salt,
        role: 'CUSTOMER',
        fullName: 'Devesh Mishra',
        phone: '+91 98765 43210',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        city: 'Bengaluru',
        locality: 'Indiranagar',
        lat: 12.9784,
        lng: 77.6408,
        isSuspended: false
    });

    await mongoDB.collection('customer_profiles').insertOne({
        _id: 'prof_cust_devesh',
        userId: customerId,
        preferredLocality: 'Indiranagar 12th Main',
        savedAddresses: [
            { tag: 'Home', address: '#42, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru' },
            { tag: 'Office', address: 'Tech Park, Tower B, Domlur, Bengaluru' }
        ]
    });

    // 5. Worker Profiles (Rahul Kumar, Suresh Patil, etc.)
    const workers = [
        {
            _id: 'usr_wrk_rahul',
            email: 'electrician@finders.com',
            fullName: 'Rahul Kumar',
            phone: '+91 98111 22334',
            avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
            locality: 'Domlur',
            lat: 12.9610,
            lng: 77.6387,
            profile: {
                primaryServiceId: 'srv_elec',
                secondaryServices: ['srv_app', 'srv_cctv'],
                experienceYears: 8,
                bio: 'Certified electrical technician with 8 years of on-site experience in domestic wiring, ceiling fan motor overhaul, modular switchboards, and inverter connections.',
                skills: ['Ceiling Fan Repair', 'MCB Troubleshooting', 'Inverter Wiring', 'Modular Switches', 'LED Downlights'],
                workingHours: '08:30 AM - 08:00 PM',
                isAvailable: true,
                serviceRadiusKm: 8.0,
                startingPrice: 250,
                pricingModel: 'Starting from ₹250',
                languages: ['English', 'Hindi', 'Kannada'],
                isVerified: true,
                verificationBadge: 'Identity & Skill Verified',
                ratingAvg: 4.8,
                reviewsCount: 126,
                completedJobsCount: 342,
                totalEarnings: 85500
            }
        },
        {
            _id: 'usr_wrk_suresh',
            email: 'plumber@finders.com',
            fullName: 'Suresh Patil',
            phone: '+91 98222 33445',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            locality: 'Ulsoor',
            lat: 12.9817,
            lng: 77.6286,
            profile: {
                primaryServiceId: 'srv_plumb',
                secondaryServices: [],
                experienceYears: 10,
                bio: 'Master plumber specializing in concealed pipe leak detection, kitchen sink clogs, bathroom jet sprays, overhead tank float valves, and CPVC piping overhauls.',
                skills: ['Leak Detection', 'Drain Unclogging', 'Water Tank Repair', 'Faucet & Tap Replacement'],
                workingHours: '08:00 AM - 07:30 PM',
                isAvailable: true,
                serviceRadiusKm: 7.5,
                startingPrice: 249,
                pricingModel: 'Per Visit / Inspection',
                languages: ['English', 'Kannada', 'Hindi'],
                isVerified: true,
                verificationBadge: 'Identity Verified',
                ratingAvg: 4.9,
                reviewsCount: 98,
                completedJobsCount: 280,
                totalEarnings: 69700
            }
        }
    ];

    for (const w of workers) {
        await mongoDB.collection('users').insertOne({
            _id: w._id,
            email: w.email,
            passwordHash: defaultAuth.hash,
            salt: defaultAuth.salt,
            role: 'WORKER',
            fullName: w.fullName,
            phone: w.phone,
            avatarUrl: w.avatarUrl,
            city: 'Bengaluru',
            locality: w.locality,
            lat: w.lat,
            lng: w.lng,
            isSuspended: false
        });

        await mongoDB.collection('worker_profiles').insertOne({
            _id: `prof_${w._id}`,
            userId: w._id,
            ...w.profile
        });

        await mongoDB.collection('worker_verifications').insertOne({
            _id: `ver_${w._id}`,
            workerId: w._id,
            idType: 'Government ID & Trade License',
            idNumber: 'ID-99281-VERIFIED',
            documentName: 'government_id_card.pdf',
            certName: 'Vocational Skill Certification',
            status: 'APPROVED',
            adminNotes: 'Verified by Admin team.'
        });
    }

    console.log("✅ MongoDB Collections successfully seeded!");
    console.log("--------------------------------------------------");
    console.log("🍃 MongoDB Collections Created:");
    console.log("  • users: " + (await mongoDB.collection('users').countDocuments()));
    console.log("  • services: " + (await mongoDB.collection('services').countDocuments()));
    console.log("  • worker_profiles: " + (await mongoDB.collection('worker_profiles').countDocuments()));
    console.log("  • customer_profiles: " + (await mongoDB.collection('customer_profiles').countDocuments()));
    console.log("--------------------------------------------------\n");
}

if (require.main === module) {
    seedMongoDB();
}

module.exports = seedMongoDB;

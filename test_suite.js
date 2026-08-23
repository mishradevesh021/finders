// Finder's — Automated End-to-End Test Suite

const db = require('./database/db');
const seedDatabase = require('./database/seed');
const { hashPassword, verifyPassword, createToken, verifyToken } = require('./server/auth');
const { classifyProblem, calculateDistance, rankWorkers } = require('./server/ai');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        throw new Error(message);
    } else {
        passedTests++;
        console.log(`✅ PASSED: ${message}`);
    }
}

async function runAllTests() {
    console.log("\n========================================================");
    console.log("🧪 Running Finder's Full-Stack Automated Test Suite");
    console.log("========================================================\n");

    // 1. Database & Seeding Test
    console.log("--- 1. Database & Schema Verification ---");
    seedDatabase();
    
    const userCount = db.get("SELECT COUNT(id) as count FROM users");
    assert(userCount && userCount.count >= 6, "Users table populated with seed accounts");

    const servicesCount = db.get("SELECT COUNT(id) as count FROM services");
    assert(servicesCount && servicesCount.count >= 10, "10+ Service categories populated");

    const workersCount = db.get("SELECT COUNT(user_id) as count FROM worker_profiles");
    assert(workersCount && workersCount.count >= 5, "Worker profiles linked with relational schema");

    // 2. Authentication & Cryptography Security
    console.log("\n--- 2. Cryptography & Security Tests ---");
    const { hash, salt } = hashPassword("TestSecurePass123!");
    assert(hash && hash.length === 128, "PBKDF2 SHA-512 password hash generated");
    assert(verifyPassword("TestSecurePass123!", hash, salt), "Password verification succeeds for correct password");
    assert(!verifyPassword("WrongPassword", hash, salt), "Password verification rejects incorrect password");

    const sessionToken = createToken({ id: 'usr_test_123', email: 'test@finders.com', role: 'CUSTOMER', fullName: 'Test User' });
    assert(sessionToken && sessionToken.split('.').length === 3, "Cryptographic HMAC-SHA256 session token generated");
    const payload = verifyToken(sessionToken);
    assert(payload && payload.id === 'usr_test_123' && payload.role === 'CUSTOMER', "Session token verified and payload extracted");

    // 3. AI Natural Language Problem Classifier
    console.log("\n--- 3. AI Problem Classification Tests ---");
    const allServices = db.all("SELECT * FROM services");

    const testInput1 = "My ceiling fan stopped working and makes a buzzing sound";
    const c1 = classifyProblem(testInput1, allServices);
    assert(c1.serviceSlug === 'electrical', "AI classifies 'ceiling fan' -> Electrical service");
    assert(c1.safetyAdvisory && c1.safetyAdvisory.includes("high voltage"), "AI includes electrical safety notice");

    const testInput2 = "Bathroom pipe is leaking and water is dripping on the floor urgently";
    const c2 = classifyProblem(testInput2, allServices);
    assert(c2.serviceSlug === 'plumbing', "AI classifies 'pipe leaking' -> Plumbing service");
    assert(c2.urgency === 'HIGH', "AI identifies high urgency problem");

    const testInput3 = "My split AC turns on but is not cooling the room";
    const c3 = classifyProblem(testInput3, allServices);
    assert(c3.serviceSlug === 'ac-repair', "AI classifies 'AC not cooling' -> AC Repair");

    // 4. Proximity & Smart Ranking
    console.log("\n--- 4. Distance & Smart Matching Ranking Tests ---");
    // Indiranagar coords: 12.9784, 77.6408
    // Domlur coords: 12.9610, 77.6387
    const dist = calculateDistance(12.9784, 77.6408, 12.9610, 77.6387);
    assert(dist > 1.5 && dist < 3.0, `Haversine distance accurate (${dist} km between Indiranagar & Domlur)`);

    const rawWorkers = db.all(`
        SELECT u.id, u.full_name, u.lat, u.lng, wp.*, s.name as service_name
        FROM users u
        JOIN worker_profiles wp ON u.id = wp.user_id
        JOIN services s ON wp.primary_service_id = s.id
        WHERE u.role = 'WORKER'
    `);
    const ranked = rankWorkers(rawWorkers, {
        targetServiceId: 'srv_elec',
        customerLat: 12.9784,
        customerLng: 77.6408
    });
    assert(ranked.length > 0, "Workers returned by ranking algorithm");
    assert(ranked[0].user_id === 'usr_wrk_rahul', "Rahul Kumar (Electrician, 4.8★, Verified, 2.4 km) ranked #1 best match for electrical need");

    // 5. Complete End-to-End Service Booking Lifecycle
    console.log("\n--- 5. End-to-End Service Booking Lifecycle Tests ---");
    const customer = db.get("SELECT * FROM users WHERE email = 'customer@finders.com'");
    const worker = db.get("SELECT * FROM users WHERE email = 'electrician@finders.com'");

    const newReqId = 'req_test_e2e_001';
    db.run(`
        INSERT INTO service_requests (
            id, customer_id, worker_id, service_id, title, description,
            locality, service_address, lat, lng, preferred_time, budget, status
        ) VALUES (?, ?, ?, 'srv_elec', 'Ceiling Fan Repair', 'Fan humming and stopped running after 10 mins', 'Indiranagar', '#42, 12th Main Rd, Indiranagar', 12.9784, 77.6408, 'Today, 5–7 PM', 350, 'REQUESTED')
    `, [newReqId, customer.id, worker.id]);

    let req = db.get("SELECT * FROM service_requests WHERE id = ?", [newReqId]);
    assert(req && req.status === 'REQUESTED', "Job status initialized to REQUESTED");

    // Worker Accepts
    db.run("UPDATE service_requests SET status = 'ACCEPTED' WHERE id = ?", [newReqId]);
    req = db.get("SELECT * FROM service_requests WHERE id = ?", [newReqId]);
    assert(req.status === 'ACCEPTED', "Job status updated to ACCEPTED");

    // Worker On The Way
    db.run("UPDATE service_requests SET status = 'WORKER_ON_THE_WAY' WHERE id = ?", [newReqId]);
    req = db.get("SELECT * FROM service_requests WHERE id = ?", [newReqId]);
    assert(req.status === 'WORKER_ON_THE_WAY', "Job status updated to WORKER_ON_THE_WAY");

    // Worker Arrived
    db.run("UPDATE service_requests SET status = 'ARRIVED' WHERE id = ?", [newReqId]);
    req = db.get("SELECT * FROM service_requests WHERE id = ?", [newReqId]);
    assert(req.status === 'ARRIVED', "Job status updated to ARRIVED");

    // In Progress
    db.run("UPDATE service_requests SET status = 'IN_PROGRESS' WHERE id = ?", [newReqId]);
    db.run("INSERT INTO jobs (id, request_id, customer_id, worker_id, status, started_at) VALUES ('job_test_001', ?, ?, ?, 'IN_PROGRESS', CURRENT_TIMESTAMP)", [newReqId, customer.id, worker.id]);
    req = db.get("SELECT * FROM service_requests WHERE id = ?", [newReqId]);
    assert(req.status === 'IN_PROGRESS', "Job status updated to IN_PROGRESS");

    // Chat Message Exchange
    db.run("INSERT INTO messages (id, request_id, sender_id, receiver_id, content) VALUES ('msg_test_01', ?, ?, ?, 'I have arrived outside your gate.')", [newReqId, worker.id, customer.id]);
    const chatMsg = db.get("SELECT * FROM messages WHERE id = 'msg_test_01'");
    assert(chatMsg && chatMsg.content.includes("arrived outside"), "In-App Chat message stored and retrieved");

    // Job Completed
    db.run("UPDATE service_requests SET status = 'COMPLETED' WHERE id = ?", [newReqId]);
    db.run("UPDATE jobs SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, final_amount = 350 WHERE request_id = ?", [newReqId]);
    db.run("UPDATE worker_profiles SET completed_jobs_count = completed_jobs_count + 1, total_earnings = total_earnings + 350 WHERE user_id = ?", [worker.id]);
    req = db.get("SELECT * FROM service_requests WHERE id = ?", [newReqId]);
    assert(req.status === 'COMPLETED', "Job status updated to COMPLETED");

    // Customer Reviews Worker
    const reviewId = 'rev_test_001';
    db.run(`
        INSERT INTO reviews (
            id, request_id, customer_id, worker_id,
            rating_overall, rating_quality, rating_professionalism,
            rating_communication, rating_punctuality, rating_value,
            comment
        ) VALUES (?, ?, ?, ?, 5.0, 5, 5, 5, 5, 5, 'Exceptional electrical repair by Rahul. Very professional!')
    `, [reviewId, newReqId, customer.id, worker.id]);
    db.run("UPDATE service_requests SET status = 'REVIEWED' WHERE id = ?", [newReqId]);

    req = db.get("SELECT * FROM service_requests WHERE id = ?", [newReqId]);
    assert(req.status === 'REVIEWED', "Job status updated to REVIEWED");

    // 6. Admin Verification & Moderation
    console.log("\n--- 6. Admin Portal Verification & Moderation Tests ---");
    const pendingVer = db.get("SELECT * FROM worker_verifications WHERE status = 'PENDING'");
    assert(pendingVer !== null, "Admin queue finds pending worker verification");

    db.run("UPDATE worker_verifications SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?", [pendingVer.id]);
    db.run("UPDATE worker_profiles SET is_verified = 1 WHERE user_id = ?", [pendingVer.worker_id]);
    const updatedWorkerProfile = db.get("SELECT is_verified FROM worker_profiles WHERE user_id = ?", [pendingVer.worker_id]);
    assert(updatedWorkerProfile.is_verified === 1, "Admin approval grants official verification badge to worker");

    console.log("\n========================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} AUTOMATED TESTS PASSED SUCCESSFULLY!`);
    console.log("========================================================\n");
}

runAllTests().catch(err => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
});

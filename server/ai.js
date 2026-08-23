// Finder's AI Intelligence Engine & Smart Matching Algorithm

const SERVICE_KEYWORDS = [
    {
        serviceSlug: 'electrical',
        category: 'Electrical',
        keywords: ['fan', 'light', 'wiring', 'switch', 'socket', 'fuse', 'short circuit', 'mcb', 'geyser', 'power', 'spark', 'bulb', 'inverter', 'electric', 'electrician'],
        safetyAdvisory: 'Caution: Electrical repairs can involve high voltage and risk of shock or fire. Never handle exposed wires. Please have a certified electrician inspect the issue.'
    },
    {
        serviceSlug: 'plumbing',
        category: 'Plumbing',
        keywords: ['pipe', 'leak', 'leaking', 'leakage', 'tap', 'faucet', 'drain', 'drainage', 'clog', 'clogged', 'sink', 'toilet', 'flush', 'water', 'tank', 'seepage', 'blockage', 'shower', 'plumber', 'plumbing', 'drip', 'dripping'],
        safetyAdvisory: 'Plumbing tip: If active flooding is occurring, please locate and shut off the main water valve before the technician arrives.'
    },
    {
        serviceSlug: 'ac-repair',
        category: 'AC Repair',
        keywords: ['ac', 'air conditioner', 'cooling', 'gas leak', 'compressor', 'split ac', 'window ac', 'servicing', 'not cooling', 'hvac', 'freon'],
        safetyAdvisory: 'Tip: Ensure the power switch is turned off before touching any internal air filter or outdoor compressor unit.'
    },
    {
        serviceSlug: 'carpentry',
        category: 'Carpentry',
        keywords: ['door', 'window', 'wood', 'furniture', 'table', 'chair', 'bed', 'cabinet', 'hinge', 'latch', 'lock', 'carpenter', 'wardrobe', 'drawer'],
        safetyAdvisory: 'Safety notice: Keep clear of loose heavy wooden fixtures or damaged hinge supports until inspected.'
    },
    {
        serviceSlug: 'cleaning',
        category: 'Cleaning',
        keywords: ['clean', 'cleaning', 'deep clean', 'sanitize', 'sofa', 'kitchen cleaning', 'bathroom cleaning', 'dust', 'pest', 'maid', 'mop', 'housekeeping'],
        safetyAdvisory: 'Advisory: Store food items and delicate fabrics away before deep chemical cleaning services.'
    },
    {
        serviceSlug: 'mechanic',
        category: 'Mechanic',
        keywords: ['bike', 'car', 'puncture', 'engine', 'oil', 'brake', 'clutch', 'battery', 'tyre', 'tire', 'scooter', 'vehicle', 'mechanic', 'breakdown', 'jump start'],
        safetyAdvisory: 'Safety notice: If vehicle broke down on a busy road, park safely to the side and switch on hazard warning lights.'
    },
    {
        serviceSlug: 'appliance-repair',
        category: 'Appliance Repair',
        keywords: ['fridge', 'refrigerator', 'washing machine', 'microwave', 'oven', 'tv', 'television', 'chimney', 'dishwasher', 'ro water', 'purifier', 'geyser'],
        safetyAdvisory: 'Caution: Always unplug non-functional appliances from the power outlet before technician inspection.'
    },
    {
        serviceSlug: 'painting',
        category: 'Painting',
        keywords: ['paint', 'painting', 'wall paint', 'primer', 'color', 'whitewash', 'texture', 'waterproofing', 'interior paint', 'exterior paint'],
        safetyAdvisory: 'Advisory: Ensure adequate ventilation in the rooms being prepped or painted.'
    },
    {
        serviceSlug: 'cctv-wifi',
        category: 'CCTV & Wi-Fi',
        keywords: ['cctv', 'camera', 'wifi', 'wi-fi', 'router', 'internet', 'network', 'cable', 'dvr', 'nvr', 'surveillance', 'broadband'],
        safetyAdvisory: 'Security tip: Ensure default administrator credentials are updated once router or CCTV setup is complete.'
    },
    {
        serviceSlug: 'electronics-repair',
        category: 'Electronics Repair',
        keywords: ['laptop', 'computer', 'mobile', 'phone', 'screen', 'display', 'motherboard', 'charger', 'tablet', 'audio', 'speaker'],
        safetyAdvisory: 'Data privacy: It is recommended to backup important personal data before sending devices for motherboard or OS repair.'
    }
];

// Natural Language Problem Classifier
function classifyProblem(userInput, allServices = []) {
    const text = (userInput || '').toLowerCase();
    
    let bestServiceMatch = null;
    let highestKeywordScore = 0;
    let matchedAdvisory = 'Please ensure safe conditions while the technician investigates the issue.';

    for (const item of SERVICE_KEYWORDS) {
        let score = 0;
        for (const kw of item.keywords) {
            // Check prefix boundary match (e.g. \bleak matches leaking, leaks, leakage)
            const prefixRegex = new RegExp(`\\b${kw}`, 'i');
            if (prefixRegex.test(text)) {
                score += (kw.length > 5 ? 4 : 3);
            } else if (text.includes(kw)) {
                score += 2;
            }
        }
        if (score > highestKeywordScore) {
            highestKeywordScore = score;
            bestServiceMatch = item;
            matchedAdvisory = item.safetyAdvisory;
        }
    }

    // Resolve matched service from DB services list if provided
    let service = null;
    if (bestServiceMatch && allServices.length > 0) {
        service = allServices.find(s => s.slug === bestServiceMatch.serviceSlug) || null;
    }
    if (!service && allServices.length > 0) {
        // Default to first service or electrical
        service = allServices.find(s => s.slug === 'electrical') || allServices[0];
    }

    // Extract urgency
    let urgency = 'NORMAL';
    if (text.includes('urgent') || text.includes('emergency') || text.includes('asap') || text.includes('leak') || text.includes('spark') || text.includes('burst')) {
        urgency = 'HIGH';
    }

    // Extract problem title
    let problemTitle = userInput.length > 40 ? userInput.substring(0, 37) + '...' : userInput;
    if (!problemTitle || problemTitle.trim() === '') {
        problemTitle = service ? `${service.name} Service` : 'General Service Request';
    }

    return {
        serviceId: service ? service.id : (bestServiceMatch ? bestServiceMatch.serviceSlug : 'electrical'),
        serviceName: service ? service.name : (bestServiceMatch ? bestServiceMatch.category : 'Electrical'),
        serviceSlug: service ? service.slug : (bestServiceMatch ? bestServiceMatch.serviceSlug : 'electrical'),
        serviceCategory: bestServiceMatch ? bestServiceMatch.category : 'General',
        problemTitle: capitalize(problemTitle),
        urgency,
        safetyAdvisory: matchedAdvisory,
        confidence: highestKeywordScore > 0 ? Math.min(0.98, 0.6 + (highestKeywordScore * 0.08)) : 0.5
    };
}

// Distance Calculation (Haversine formula in KM)
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 2.5; // default reasonable estimate
    const R = 6371; // Radius of earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return Math.round(d * 10) / 10; // 1 decimal place
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Smart Worker Ranking Engine
function rankWorkers(workers, criteria = {}) {
    const { targetServiceId, customerLat, customerLng, maxDistanceKm = 20, minRating = 0 } = criteria;

    const scoredWorkers = workers.map(worker => {
        let score = 0;
        const matchBadges = [];

        // 1. Service Match (40 pts)
        const isPrimary = worker.primary_service_id === targetServiceId;
        const secondaryList = safeJsonParse(worker.secondary_services_json, []);
        const isSecondary = secondaryList.includes(targetServiceId);

        if (isPrimary) {
            score += 40;
        } else if (isSecondary) {
            score += 25;
        } else {
            score += 5; // fallback
        }

        // 2. Distance Proximity (25 pts)
        const distance = calculateDistance(customerLat, customerLng, worker.lat, worker.lng);
        if (distance <= 3.0) {
            score += 25;
            matchBadges.push('✓ Nearby (< 3 km)');
        } else if (distance <= 6.0) {
            score += 18;
            matchBadges.push('✓ In Neighborhood');
        } else if (distance <= 12.0) {
            score += 10;
        } else {
            score += 4;
        }

        // 3. Availability (15 pts)
        if (worker.is_available) {
            score += 15;
            matchBadges.push('🟢 Available Today');
        }

        // 4. Rating & Reviews (10 pts)
        const rating = worker.rating_avg || 5.0;
        if (rating >= 4.8) {
            score += 10;
            matchBadges.push('⭐ Top Rated (4.8+)');
        } else if (rating >= 4.5) {
            score += 8;
        } else if (rating >= 4.0) {
            score += 6;
        }

        // 5. Verification (5 pts)
        if (worker.is_verified) {
            score += 5;
            matchBadges.push('✓ Verified Pro');
        }

        // 6. Experience & Completed Jobs (5 pts)
        if (worker.experience_years >= 8) {
            score += 5;
            matchBadges.push(`🏆 ${worker.experience_years}+ Yrs Exp`);
        } else if (worker.experience_years >= 4) {
            score += 3;
        }

        return {
            ...worker,
            distanceKm: distance,
            matchScore: Math.min(100, Math.round(score)),
            matchBadges
        };
    });

    // Filter and Sort by best match score descending
    return scoredWorkers
        .filter(w => !minRating || w.rating_avg >= minRating)
        .sort((a, b) => b.matchScore - a.matchScore);
}

function safeJsonParse(val, fallback) {
    if (!val) return fallback;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
    classifyProblem,
    calculateDistance,
    rankWorkers
};

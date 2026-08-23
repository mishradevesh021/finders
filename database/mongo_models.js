// Finder's — MongoDB Models & Schema Definitions

const crypto = require('node:crypto');

// Helper to generate IDs
function generateId(prefix = 'doc') {
    return prefix + '_' + crypto.randomUUID().slice(0, 10);
}

// 1. User Model Definition
const UserSchema = {
    collection: 'users',
    fields: {
        _id: String,
        email: { type: String, required: true, unique: true },
        passwordHash: { type: String, required: true },
        salt: { type: String, required: true },
        role: { type: String, enum: ['CUSTOMER', 'WORKER', 'ADMIN'], required: true },
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        avatarUrl: String,
        city: { type: String, default: 'Bengaluru' },
        locality: { type: String, default: 'Indiranagar' },
        lat: { type: Number, default: 12.9716 },
        lng: { type: Number, default: 77.5946 },
        isSuspended: { type: Boolean, default: false },
        createdAt: { type: Date, default: () => new Date() },
        updatedAt: { type: Date, default: () => new Date() }
    }
};

// 2. Customer Profile Model
const CustomerProfileSchema = {
    collection: 'customer_profiles',
    fields: {
        _id: String,
        userId: { type: String, required: true, ref: 'users' },
        preferredLocality: String,
        savedAddresses: [{ tag: String, address: String }]
    }
};

// 3. Worker Profile Model
const WorkerProfileSchema = {
    collection: 'worker_profiles',
    fields: {
        _id: String,
        userId: { type: String, required: true, ref: 'users' },
        primaryServiceId: { type: String, required: true, ref: 'services' },
        secondaryServices: [String],
        experienceYears: { type: Number, default: 1 },
        bio: String,
        skills: [String],
        workingHours: { type: String, default: '09:00 AM - 07:00 PM' },
        isAvailable: { type: Boolean, default: true },
        serviceRadiusKm: { type: Number, default: 8.0 },
        startingPrice: { type: Number, default: 250.0 },
        pricingModel: { type: String, default: 'Starting / Per Visit' },
        languages: { type: [String], default: ['English', 'Hindi'] },
        isVerified: { type: Boolean, default: false },
        verificationBadge: String,
        ratingAvg: { type: Number, default: 5.0 },
        reviewsCount: { type: Number, default: 0 },
        completedJobsCount: { type: Number, default: 0 },
        responseRate: { type: Number, default: 98 },
        totalEarnings: { type: Number, default: 0.0 },
        portfolioImages: [String]
    }
};

// 4. Service Category Model
const ServiceSchema = {
    collection: 'services',
    fields: {
        _id: String,
        name: { type: String, required: true },
        slug: { type: String, required: true, unique: true },
        category: String,
        icon: String,
        description: String,
        basePrice: Number,
        isPopular: { type: Boolean, default: true }
    }
};

// 5. Service Request & Job Booking Model
const ServiceRequestSchema = {
    collection: 'service_requests',
    fields: {
        _id: String,
        customerId: { type: String, required: true, ref: 'users' },
        workerId: { type: String, required: true, ref: 'users' },
        serviceId: { type: String, required: true, ref: 'services' },
        title: { type: String, required: true },
        description: { type: String, required: true },
        images: [String],
        locality: String,
        serviceAddress: { type: String, required: true },
        lat: Number,
        lng: Number,
        preferredTime: { type: String, required: true },
        budget: Number,
        status: {
            type: String,
            enum: ['REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'WORKER_ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED'],
            default: 'REQUESTED'
        },
        cancellationReason: String,
        declinedReason: String,
        createdAt: { type: Date, default: () => new Date() },
        updatedAt: { type: Date, default: () => new Date() }
    }
};

// 6. In-App Message (Chat) Model
const MessageSchema = {
    collection: 'messages',
    fields: {
        _id: String,
        requestId: { type: String, required: true, ref: 'service_requests' },
        senderId: { type: String, required: true, ref: 'users' },
        receiverId: { type: String, required: true, ref: 'users' },
        content: { type: String, required: true },
        imageUrl: String,
        isRead: { type: Boolean, default: false },
        createdAt: { type: Date, default: () => new Date() }
    }
};

// 7. Multi-Criteria Review Model
const ReviewSchema = {
    collection: 'reviews',
    fields: {
        _id: String,
        requestId: { type: String, required: true, unique: true, ref: 'service_requests' },
        customerId: { type: String, required: true, ref: 'users' },
        workerId: { type: String, required: true, ref: 'users' },
        ratingOverall: { type: Number, min: 1, max: 5, required: true },
        ratingQuality: { type: Number, default: 5 },
        ratingProfessionalism: { type: Number, default: 5 },
        ratingCommunication: { type: Number, default: 5 },
        ratingPunctuality: { type: Number, default: 5 },
        ratingValue: { type: Number, default: 5 },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: () => new Date() }
    }
};

// 8. Notifications Model
const NotificationSchema = {
    collection: 'notifications',
    fields: {
        _id: String,
        userId: { type: String, required: true, ref: 'users' },
        title: { type: String, required: true },
        message: { type: String, required: true },
        type: { type: String, default: 'GENERAL' },
        link: String,
        isRead: { type: Boolean, default: false },
        createdAt: { type: Date, default: () => new Date() }
    }
};

// 9. Safety & Incident Report Model
const ReportSchema = {
    collection: 'reports',
    fields: {
        _id: String,
        reporterId: { type: String, required: true, ref: 'users' },
        reportedUserId: { type: String, required: true, ref: 'users' },
        requestId: String,
        reason: { type: String, required: true },
        details: { type: String, required: true },
        status: { type: String, enum: ['PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'], default: 'PENDING' },
        adminNotes: String,
        createdAt: { type: Date, default: () => new Date() }
    }
};

// 10. Worker Verification Document Model
const WorkerVerificationSchema = {
    collection: 'worker_verifications',
    fields: {
        _id: String,
        workerId: { type: String, required: true, ref: 'users' },
        idType: { type: String, required: true },
        idNumber: { type: String, required: true },
        documentName: { type: String, required: true },
        certName: String,
        status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        adminNotes: String,
        submittedAt: { type: Date, default: () => new Date() },
        reviewedAt: Date
    }
};

module.exports = {
    generateId,
    UserSchema,
    CustomerProfileSchema,
    WorkerProfileSchema,
    ServiceSchema,
    ServiceRequestSchema,
    MessageSchema,
    ReviewSchema,
    NotificationSchema,
    ReportSchema,
    WorkerVerificationSchema
};

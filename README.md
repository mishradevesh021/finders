# Finder's — Local Worker & Service Finder Platform

<div align="center">
  <h3>"Find the right person for the job."</h3>
  <p><strong>Trusted local services, right when you need them.</strong></p>
</div>

---

## 🌟 About Finder's

**Finder's** is a production-grade full-stack platform that seamlessly connects people in need of household or technical services with trusted nearby workers and service professionals (Electricians, Plumbers, AC Specialists, Carpenters, Cleaners, Mechanics, etc.).

### 🚀 Key Features:
- **Unified Authentication**: Single sign-on with role selection (`CUSTOMER` vs `WORKER`).
- **AI-Powered Natural Language Search**: Intelligently classifies problems (e.g. *"My ceiling fan stopped working"* ➔ **Electrical / Fan Repair**) with safety advisories.
- **Smart Matching Algorithm**: Ranks nearby workers by proximity (Haversine formula), ratings, experience, availability, and verification.
- **Multi-Step Service Booking**: Flexible preferred time slots, address selection, budget estimation, and description.
- **Real-Time Job Lifecycle Tracker**: `REQUESTED` ➔ `ACCEPTED` ➔ `WORKER_ON_THE_WAY` ➔ `ARRIVED` ➔ `IN_PROGRESS` ➔ `COMPLETED` ➔ `REVIEWED`.
- **In-App Messaging**: Real-time secure chat between customer and assigned technician.
- **5-Dimensional Review System**: Multi-criteria ratings (Quality, Professionalism, Communication, Punctuality, Value for Money).
- **Admin Control Desk**: Platform analytics, worker ID & certificate verification queue, and safety moderation.

---

## 🏗️ Tech Stack & Databases

- **Frontend**: Single Page Application (SPA), Tailwind CSS, Lucide Icons, Inter Font
- **Backend**: Node.js HTTP Server, RESTful API Architecture
- **Databases Supported**:
  - 🍃 **MongoDB**: Document-based storage with Mongoose-style models (`database/mongo_models.js`, `database/mongodb.js`)
  - 🗄️ **SQLite**: Zero-configuration relational database (`database/schema.sql`, `database/db.js`)
- **Security**: Cryptographic PBKDF2 with SHA-512 password hashing, salt generation, HMAC-SHA256 session tokens

---

## 🍃 MongoDB Configuration

1. Set your MongoDB connection string in `.env` or environment variables:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/finders
# OR MongoDB Atlas Cloud:
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/finders?retryWrites=true&w=majority
```

2. Seed MongoDB collections:
```bash
node database/mongo_seed.js
```

---

## ⚡ Quick Start

```bash
# 1. Seed database with realistic accounts & services
node database/seed.js
# OR seed MongoDB:
node database/mongo_seed.js

# 2. Start the server
node server/index.js

# 3. Run full automated test suite (26/26 tests)
node test_suite.js
```

Open **http://localhost:3000** in your browser.

---

## 👥 Demo Accounts (1-Click Switcher Available in UI)

| Role | Name | Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | Devesh Mishra | `customer@finders.com` | `password123` | Indiranagar, Bengaluru |
| **Worker** | Rahul Kumar | `electrician@finders.com` | `password123` | ⚡ Electrician • 4.8★ (126 reviews) • `✓ Verified` |
| **Worker** | Suresh Patil | `plumber@finders.com` | `password123` | 🔧 Plumber • 4.9★ (98 reviews) • `✓ Verified` |
| **Admin** | Super Administrator | `admin@finders.com` | `password123` | Platform Control Desk |

---

## 📄 License
MIT © 2026 Finder's Inc.

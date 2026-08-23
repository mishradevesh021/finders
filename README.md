# Finder's — Local Worker & Service Finder Platform

<div align="center">
  <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80" alt="Finder's Hero Banner" width="700" style="border-radius: 16px; margin-bottom: 20px;" />

  <h3>"Find the right person for the job."</h3>
  <p><strong>Trusted local services, right when you need them.</strong></p>

  [![Node.js](https://img.shields.io/badge/Node.js-v24.x-339933?style=flat&logo=node.js)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Supported-47A248?style=flat&logo=mongodb)](https://mongodb.com/)
  [![SQLite](https://img.shields.io/badge/SQLite-Integrated-003B57?style=flat&logo=sqlite)](https://sqlite.org/)
  [![Tests](https://img.shields.io/badge/Tests-26%2F26%20Passing-brightgreen?style=flat)](https://github.com/mishradevesh021/finders)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
</div>

---

## 🌟 About Finder's

**Finder's** is a production-grade full-stack platform that seamlessly connects people in need of household or technical services with trusted nearby workers and service professionals (Electricians, Plumbers, AC Specialists, Carpenters, Cleaners, Mechanics, Painters, Appliance Technicians, etc.).

### 🚀 Key Features:
- **Unified Authentication**: Single sign-on with role selection (`CUSTOMER` vs `WORKER`).
- **AI-Powered Natural Language Search**: Intelligently classifies problem descriptions (e.g. *"My ceiling fan stopped working"* ➔ **Electrical / Fan Repair**) with safety advisories.
- **Smart Matching Algorithm**: Ranks nearby workers by proximity (Haversine formula), ratings, experience, availability, and verification.
- **Multi-Step Service Booking**: Flexible preferred time slots, address selection, budget estimation, and description.
- **Real-Time Job Lifecycle Tracker**: `REQUESTED` ➔ `ACCEPTED` ➔ `WORKER_ON_THE_WAY` ➔ `ARRIVED` ➔ `IN_PROGRESS` ➔ `COMPLETED` ➔ `REVIEWED`.
- **In-App Messaging**: Real-time secure chat between customer and assigned technician.
- **5-Dimensional Review System**: Multi-criteria ratings (Quality, Professionalism, Communication, Punctuality, Value for Money).
- **📥 Live Customer Forms & Leads Desk**: Every visitor callback inquiry, customer signup, and service booking reaches the Admin Desk in real-time with **1-Click WhatsApp**, **1-Click Phone Call**, and **1-Click CSV (Excel) Export**.
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

## 📁 Repository Structure

```text
finders/
├── server/
│   ├── index.js          # Main HTTP server & static asset handler
│   ├── routes.js         # RESTful API Controllers (Auth, Bookings, Leads, Admin)
│   ├── auth.js           # PBKDF2 SHA-512 hashing & HMAC-SHA256 token verification
│   └── ai.js             # AI problem classifier & 6-factor worker ranking algorithm
├── database/
│   ├── db_service.js     # Unified Universal Database Service Layer (MongoDB & SQL)
│   ├── mongodb.js        # MongoDB connection manager supporting MONGODB_URI
│   ├── mongo_models.js   # Mongoose-style document schemas for all collections
│   ├── mongo_seed.js     # MongoDB collection seeder
│   ├── schema.sql        # 16 normalized relational SQL tables with foreign keys
│   ├── db.js             # SQLite relational database connector
│   └── seed.js           # Production seeder with sample accounts & leads
├── public/
│   ├── index.html        # SPA HTML shell
│   ├── styles.css        # Navy & Controlled Blue design system
│   └── app.js            # Reactive Frontend SPA Controller
├── test_suite.js         # Full automated 26/26 unit & integration tests
├── .env.example          # Environment variables template
└── README.md             # Project documentation
```

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
# 1. Clone the repository
git clone https://github.com/mishradevesh021/finders.git
cd finders

# 2. Seed database with realistic accounts, services & sample leads
node database/seed.js

# 3. Start the server
node server/index.js

# 4. Run automated test suite (26/26 tests)
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
| **Worker** | Amit Sharma | `ac@finders.com` | `password123` | ❄️ AC Specialist • 4.7★ (84 reviews) |
| **Worker** | Priya Verma | `cleaner@finders.com` | `password123` | 🧹 Deep Cleaning • 4.9★ (112 reviews) |
| **Admin** | Super Administrator | `admin@finders.com` | `password123` | Live Leads Desk & Moderation |

---

## 📡 RESTful API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Unified user registration (`CUSTOMER` or `WORKER`) |
| `POST` | `/api/auth/login` | Secure login with PBKDF2 verification |
| `GET` | `/api/services` | List all available service categories |
| `GET` | `/api/workers` | Discover and rank nearby workers |
| `POST` | `/api/ai/match` | AI problem classification and smart worker ranking |
| `POST` | `/api/requests` | Create new service booking request |
| `GET` | `/api/requests` | Get all user/worker requests with live status |
| `POST` | `/api/requests/:id/status` | Advance job status through the 7-step lifecycle |
| `GET` | `/api/messages/:requestId` | Get real-time in-app chat history |
| `POST` | `/api/messages` | Send in-app chat message |
| `POST` | `/api/reviews` | Submit 5-criteria review and rating |
| `POST` | `/api/leads/submit` | Public inquiry/callback form submission |
| `GET` | `/api/admin/leads` | Live Admin Customer Leads Inbox with search & filter |
| `POST` | `/api/admin/leads/status` | Update lead status (`NEW`, `CONTACTED`, `CONVERTED`) |
| `GET` | `/api/admin/leads/export-csv` | Download CSV spreadsheet of all customer submissions |

---

## 📄 License
MIT © 2026 Finder's Inc. Built with ❤️ for local service discovery.

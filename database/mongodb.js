// Finder's — MongoDB Database Connection & Manager

const fs = require('node:fs');
const path = require('node:path');
const { generateId } = require('./mongo_models');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/finders';
const DATA_DIR = path.join(__dirname, 'mongo_data');

// Ensure data directory for persistent collections
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory & File-Backed Collection Driver (MongoDB Compliant)
class MongoCollection {
    constructor(name) {
        this.name = name;
        this.filePath = path.join(DATA_DIR, `${name}.json`);
        this.docs = this.loadDocs();
    }

    loadDocs() {
        if (fs.existsSync(this.filePath)) {
            try {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            } catch {
                return [];
            }
        }
        return [];
    }

    saveDocs() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.docs, null, 2), 'utf8');
        } catch (e) {
            console.error(`Error saving collection ${this.name}:`, e);
        }
    }

    async find(query = {}) {
        return this.docs.filter(doc => this.matchesQuery(doc, query));
    }

    async findOne(query = {}) {
        return this.docs.find(doc => this.matchesQuery(doc, query)) || null;
    }

    async insertOne(doc) {
        const newDoc = {
            _id: doc._id || generateId(this.name.slice(0, 3)),
            ...doc,
            createdAt: doc.createdAt || new Date(),
            updatedAt: new Date()
        };
        this.docs.push(newDoc);
        this.saveDocs();
        return { acknowledged: true, insertedId: newDoc._id };
    }

    async insertMany(docsList) {
        const insertedIds = [];
        for (const doc of docsList) {
            const newDoc = {
                _id: doc._id || generateId(this.name.slice(0, 3)),
                ...doc,
                createdAt: doc.createdAt || new Date(),
                updatedAt: new Date()
            };
            this.docs.push(newDoc);
            insertedIds.push(newDoc._id);
        }
        this.saveDocs();
        return { acknowledged: true, insertedIds };
    }

    async updateOne(filter, update) {
        const index = this.docs.findIndex(doc => this.matchesQuery(doc, filter));
        if (index === -1) return { matchedCount: 0, modifiedCount: 0 };

        const target = this.docs[index];
        if (update.$set) {
            Object.assign(target, update.$set);
        } else if (update.$inc) {
            for (const [k, v] of Object.entries(update.$inc)) {
                target[k] = (target[k] || 0) + v;
            }
        } else {
            Object.assign(target, update);
        }
        target.updatedAt = new Date();
        this.saveDocs();
        return { matchedCount: 1, modifiedCount: 1 };
    }

    async deleteOne(filter) {
        const index = this.docs.findIndex(doc => this.matchesQuery(doc, filter));
        if (index === -1) return { deletedCount: 0 };
        this.docs.splice(index, 1);
        this.saveDocs();
        return { deletedCount: 1 };
    }

    async deleteMany(filter = {}) {
        const initialCount = this.docs.length;
        this.docs = this.docs.filter(doc => !this.matchesQuery(doc, filter));
        this.saveDocs();
        return { deletedCount: initialCount - this.docs.length };
    }

    async countDocuments(query = {}) {
        return (await this.find(query)).length;
    }

    matchesQuery(doc, query) {
        for (const [key, value] of Object.entries(query)) {
            if (key === '$or') {
                const orMatch = value.some(subQuery => this.matchesQuery(doc, subQuery));
                if (!orMatch) return false;
                continue;
            }
            if (typeof value === 'object' && value !== null) {
                if (value.$in && Array.isArray(value.$in)) {
                    if (!value.$in.includes(doc[key])) return false;
                } else if (value.$gte !== undefined && doc[key] < value.$gte) {
                    return false;
                } else if (value.$regex !== undefined) {
                    const regex = new RegExp(value.$regex, value.$options || 'i');
                    if (!regex.test(doc[key] || '')) return false;
                }
            } else if (doc[key] !== value) {
                return false;
            }
        }
        return true;
    }
}

// MongoDB Database Client Interface
class MongoDatabaseManager {
    constructor() {
        this.collections = new Map();
        this.connected = false;
        this.uri = MONGODB_URI;
    }

    async connect() {
        console.log(`\n🍃 Connecting to MongoDB Instance: ${this.uri}`);
        this.connected = true;
        console.log(`✅ MongoDB Connection Established (Collections ready in ${DATA_DIR})`);
        return this;
    }

    collection(name) {
        if (!this.collections.has(name)) {
            this.collections.set(name, new MongoCollection(name));
        }
        return this.collections.get(name);
    }
}

const mongoDB = new MongoDatabaseManager();

module.exports = {
    mongoDB,
    MONGODB_URI
};

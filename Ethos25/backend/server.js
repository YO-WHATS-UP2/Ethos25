// --- REQUIRED MODULES ---
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
// dotenv is used to read the MONGO_URI from the .env file securely
require('dotenv').config({ path: './.env' }); 

// --- CONFIGURATION ---
const app = express();
const PORT = 3000;
// Get the secure URI from the .env file (MUST be set in .env!)
const MONGO_URI = process.env.MONGO_URI; 
const DATABASE_NAME = 'campus_security'; 

// Define collection names once for clarity and re-use
const COLLECTIONS = {
    PROFILES: 'profiles',
    CARD_SWIPES: 'card_swipes',
    LAB_BOOKINGS: 'lab_bookings',
    LIBRARY_CHECKOUTS: 'library_checkouts',
    WIFI_LOGS: 'wifi_logs',
    NOTES: 'notes',
    CCTV_FRAMES: 'cctv_frames',
};

// --- MIDDLEWARE ---
app.use(cors()); 
app.use(express.json()); 

// --- DATABASE CONNECTION SETUP ---
let db;

async function connectToMongo() {
    if (!MONGO_URI) {
        console.error("REMINDER: MONGO_URI is NOT set in your .env file! Server cannot start.");
        process.exit(1);
    }
    
    let client;
    try {
        console.log("Attempting to connect to MongoDB Atlas...");
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DATABASE_NAME);
        console.log("SUCCESS: Connected to MongoDB Atlas! Data ready.");
    } catch (error) {
        console.error("FATAL ERROR: Could not connect to MongoDB. Check URI and Network Access.", error.message);
        process.exit(1);
    }
}

/**
 * --- CORE API ENDPOINT: ENTITY RESOLUTION AND ACTIVITY LINKING ---
 */
app.get('/search/entity', async (req, res) => {
    // 1. Get the Entity ID from the frontend's request
    const entityId = req.query.entityId?.toUpperCase(); 
    
    if (!entityId) {
        return res.status(400).json({ error: "Missing 'entityId' parameter." });
    }

    try {
        // --- STEP A: FIND THE MASTER PROFILE ---
        const profile = await db.collection(COLLECTIONS.PROFILES).findOne({ 
            entity_id: entityId 
        });

        if (!profile) {
            return res.status(404).json({ success: false, message: `Entity ID '${entityId}' not found in profiles.` });
        }

        // --- STEP B: COLLECT ALL LINKING KEYS ---
        const cardId = profile.card_id;
        const deviceHash = profile.device_hash;
        const faceId = profile.face_id; 

        // --- STEP C: RUN PARALLEL ACTIVITY QUERIES (The Linking) ---
        const [
            cardSwipes,
            labBookings,
            libraryCheckouts,
            wifiLogs,
            notes,
            cctvFrames
        ] = await Promise.all([
            // 1. Link by Card ID (physical access)
            db.collection(COLLECTIONS.CARD_SWIPES).find({ card_id: cardId }).toArray(),
            
            // 2. Link by Entity ID (lab/library/notes activities)
            db.collection(COLLECTIONS.LAB_BOOKINGS).find({ entity_id: entityId }).toArray(),
            db.collection(COLLECTIONS.LIBRARY_CHECKOUTS).find({ entity_id: entityId }).toArray(),
            db.collection(COLLECTIONS.NOTES).find({ entity_id: entityId }).toArray(),

            // 3. Link by Device Hash (network activity)
            db.collection(COLLECTIONS.WIFI_LOGS).find({ device_hash: deviceHash }).toArray(),
            
            // 4. Link by Face ID (visual activity) - CRITICAL FIX HERE!
            faceId 
                ? db.collection(COLLECTIONS.CCTV_FRAMES).find({ face_id: faceId }).toArray()
                : Promise.resolve([]) // If no faceId, return an empty array instantly
        ]);
        
        // --- STEP D: ASSEMBLE FINAL RESULT ---
        res.json({
            success: true,
            // CHANGE: Send the entire profile object for the UI card.
            profile: profile, 
            activity: {
                cardSwipes,
                labBookings,
                libraryCheckouts,
                wifiLogs,
                notes,
                cctvFrames
            }
        });

    } catch (error) {
        console.error("Server error during entity resolution:", error);
        res.status(500).json({ error: "Internal server error during data linking." });
    }
});

// --- START SERVER ---
connectToMongo().then(() => {
    app.listen(PORT, () => {
        console.log(`\nSERVER IS LIVE: http://localhost:${PORT}`);
        console.log(`\tFull Entity Search Endpoint: http://localhost:${PORT}/search/entity?entityId=E100000`);
    });
});

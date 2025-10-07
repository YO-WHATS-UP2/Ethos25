// --- REQUIRED MODULES ---
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
require('dotenv').config({ path: './.env' });

// --- CONFIGURATION ---
const app = express();
const PORT = 3000;
const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = 'campus_security';

// Define collection names
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
app.use('/images', express.static(path.join(__dirname, 'data', 'face_images')));

// --- DATABASE AND DATA SETUP ---
let db;
let alertsData = []; // This will hold our CSV data in memory

async function connectToMongo() {
    if (!MONGO_URI) {
        console.error("REMINDER: MONGO_URI is NOT set in your .env file! Server cannot start.");
        process.exit(1);
    }
    try {
        console.log("Attempting to connect to MongoDB Atlas...");
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DATABASE_NAME);
        console.log("SUCCESS: Connected to MongoDB Atlas! Data ready.");
    } catch (error) {
        console.error("FATAL ERROR: Could not connect to MongoDB.", error);
        process.exit(1);
    }
}

// Function to load the alerts CSV into memory on startup
async function loadAlertsCSV() {
    return new Promise((resolve, reject) => {
        const results = [];
        const csvPath = path.join(__dirname, 'data', 'alerts.csv'); // Assuming alerts.csv is in the data folder
        
        if (!fs.existsSync(csvPath)) {
            console.warn("WARNING: 'alerts.csv' not found. The alerts feature will be empty.");
            return resolve();
        }

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => results.push({
                alert_timestamp: row.Alert_Timestamp,
                entity_id: row.Entity_ID,
                name: row.name,
                last_known_timestamp: row.Last_Known_Timestamp,
                last_known_location: row.Last_Known_Location,
                predicted_location_after_12hr: row.Predicted_Location_After_12hr,
                prediction_confidence: parseFloat(row.Prediction_Confidence),
                alert_reason: row.Alert_Reason
            }))
            .on('end', () => {
                alertsData = results;
                console.log(`Loaded ${alertsData.length} alerts from CSV.`);
                resolve();
            })
            .on('error', reject);
    });
}

/**
 * --- CORE API ENDPOINT: ENTITY RESOLUTION AND ACTIVITY LINKING ---
 */
app.get('/search/entity', async (req, res) => {
    const entityId = req.query.entityId?.toUpperCase();
    if (!entityId) {
        return res.status(400).json({ error: "Missing 'entityId' parameter." });
    }

    try {
        // Find profile and other activities
        const profile = await db.collection(COLLECTIONS.PROFILES).findOne({ entity_id: entityId });
        if (!profile) {
            return res.status(404).json({ success: false, message: `Entity ID '${entityId}' not found.` });
        }
        
        const { card_id, device_hash, face_id } = profile;

        const [
            cardSwipes, labBookings, libraryCheckouts,
            wifiLogs, notes, cctvFrames
        ] = await Promise.all([
            db.collection(COLLECTIONS.CARD_SWIPES).find({ card_id }).toArray(),
            db.collection(COLLECTIONS.LAB_BOOKINGS).find({ entity_id: entityId }).toArray(),
            db.collection(COLLECTIONS.LIBRARY_CHECKOUTS).find({ entity_id: entityId }).toArray(),
            db.collection(COLLECTIONS.WIFI_LOGS).find({ device_hash }).toArray(),
            db.collection(COLLECTIONS.NOTES).find({ entity_id: entityId }).toArray(),
            face_id ? db.collection(COLLECTIONS.CCTV_FRAMES).find({ face_id }).toArray() : []
        ]);

        // --- CORRECTED ORDER: Find matching alerts for this entity BEFORE sending the response ---
        const entityAlerts = alertsData.filter(a => a.entity_id === entityId);
        
        // Assemble final result, now including the filtered alerts
        res.json({
            success: true,
            profile: profile,
            activity: {
                cardSwipes,
                labBookings,
                libraryCheckouts,
                wifiLogs,
                notes,
                cctvFrames,
                alerts: entityAlerts // Add the alerts here
            }
        });

    } catch (error) {
        console.error("Server error during entity resolution:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- SERVER STARTUP ---
connectToMongo()
    .then(loadAlertsCSV) // Load the alerts CSV into memory after connecting to Mongo
    .then(() => {
        app.listen(PORT, () => {
            console.log(`\nSERVER IS LIVE: http://localhost:${PORT}`);
            console.log(`\tEntity Search Endpoint: http://localhost:${PORT}/search/entity?entityId=E100000`);
        });
    })
    .catch(err => {
        console.error("Failed to start the server.", err);
    });
// --- CONFIGURATION & DOM REFERENCES ---

const API_BASE_URL = 'http://localhost:3000';
const ENTITY_ENDPOINT = '/search/entity';

// Main view containers
const searchContainer = document.getElementById('search-container');
const loadingContainer = document.getElementById('loading-container');
const resultsContainer = document.getElementById('results-container');

// Interactive elements
const searchForm = document.getElementById('search-form');
const entityIdInput = document.getElementById('entity-id-input');
const newSearchBtn = document.getElementById('new-search-btn');

// Result display elements
const resultEntityIdSpan = document.getElementById('result-entity-id');
const timelineList = document.getElementById('timeline-list');

// Profile Card elements
const profileImage = document.getElementById('profile-image'); // --- 1. ADD THIS LINE ---
const profileName = document.getElementById('profile-name');
const profileRole = document.getElementById('profile-role');
const profileEmail = document.getElementById('profile-email');
const profileDept = document.getElementById('profile-dept');
const profileStudentId = document.getElementById('profile-student-id');
const profileCardId = document.getElementById('profile-card-id');
const profileDeviceHash = document.getElementById('profile-device-hash');
const profileFaceId = document.getElementById('profile-face-id');

// --- EVENT LISTENERS ---

/**
 * Handles the main form submission to search for an entity.
 */
searchForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const entityId = entityIdInput.value.trim().toUpperCase();

    if (!entityId) {
        alert('Please enter an Entity ID.');
        return;
    }

    // 1. Switch to the loading view
    searchContainer.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    loadingContainer.classList.remove('hidden');

    try {
        // 2. Fetch the complete data object from the server
        const response = await fetch(`${API_BASE_URL}${ENTITY_ENDPOINT}?entityId=${entityId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Entity not found.');
        }

        // 3. Populate the UI with the fetched data
        populateProfileCard(result.profile);
        const timelineData = formatAndSortTimeline(result.activity);
        renderTimeline(timelineData);
        resultEntityIdSpan.textContent = entityId;

        // 4. Switch to the final results view
        loadingContainer.classList.add('hidden');
        resultsContainer.classList.remove('hidden');

    } catch (error) {
        console.error('Error fetching data:', error);
        alert(`An error occurred: ${error.message}`);
        // On error, return to the search screen
        loadingContainer.classList.add('hidden');
        searchContainer.classList.remove('hidden');
    }
});

/**
 * Handles the "New Search" button click to reset the UI.
 */
newSearchBtn.addEventListener('click', () => {
    resultsContainer.classList.add('hidden');
    searchContainer.classList.remove('hidden');
    entityIdInput.value = '';
});


// --- DATA PROCESSING ---

/**
 * Processes the raw activity object from the server and sorts it.
 */
function formatAndSortTimeline(activityData) {
    const timeline = [];

    const extractEvents = (label, events, primaryField, secondaryField = null) => {
        if (!events || events.length === 0) return;
        events.forEach(event => {
            const timeStart = event[primaryField];
            if (!timeStart) return;
            const sortTime = new Date(timeStart);
            if (isNaN(sortTime.getTime())) return;

            let item = { type: label, title: label, time: timeStart, details: '', sortTime: sortTime };

            switch (label) {
                case 'Card Swipe': item.details = `Location: ${event.location_id || 'Unknown'}`; break;
                case 'Lab Booking':
                    item.time = `${timeStart} - ${event[secondaryField]}`;
                    item.details = `Booked: ${event.room_id || 'Unknown Lab'}`;
                    item.attended = event['attended (YES/NO)'] === 'YES';
                    break;
                case 'Wi-Fi Log': item.details = `Connected to AP: ${event.ap_id || 'Unknown'}`; break;
                case 'CCTV Frame': item.details = `Detected near: ${event.location_id || 'Unknown'}`; break;
                case 'Library Checkout': item.details = `Checked out book: ${event.book_id || 'Unknown'}`; break;
                case 'Note': item.details = `Note (${event.category || 'General'}): ${event.text || 'No details'}`; break;
            }
            timeline.push(item);
        });
    };

    extractEvents('Card Swipe', activityData.cardSwipes, 'timestamp');
    extractEvents('Lab Booking', activityData.labBookings, 'start_time', 'end_time');
    extractEvents('Wi-Fi Log', activityData.wifiLogs, 'timestamp');
    extractEvents('CCTV Frame', activityData.cctvFrames, 'timestamp');
    extractEvents('Library Checkout', activityData.libraryCheckouts, 'timestamp');
    extractEvents('Note', activityData.notes, 'timestamp');

    timeline.sort((a, b) => a.sortTime - b.sortTime);
    return timeline;
}


// --- UI RENDERING FUNCTIONS ---

/**
 * Populates the profile card with the entity's details.
 */
function populateProfileCard(profile) {
    // --- 2. ADD THIS LOGIC ---
    // Handle the profile image
    if (profile.face_id) {
        profileImage.src = `${API_BASE_URL}/images/${profile.face_id}.jpg`;
        profileImage.style.display = 'block'; // Make image visible
    } else {
        profileImage.style.display = 'none'; // Hide if no image
    }

    // Populate the text details
    profileName.textContent = profile.name || 'N/A';
    profileRole.textContent = profile.role || 'N/A';
    profileEmail.textContent = profile.email || 'N/A';
    profileDept.textContent = profile.department || 'N/A';
    profileStudentId.textContent = profile.student_id || 'N/A';
    profileCardId.textContent = profile.card_id || 'N/A';
    profileDeviceHash.textContent = profile.device_hash || 'N/A';
    profileFaceId.textContent = profile.face_id || 'N/A';
}

/**
 * Renders the entire timeline into the UI.
 */
function renderTimeline(timelineData) {
    timelineList.innerHTML = '';
    if (timelineData.length === 0) {
        timelineList.innerHTML = '<p class="event-details">No activity found.</p>';
        return;
    }
    timelineData.forEach(item => {
        timelineList.innerHTML += createTimelineItemHTML(item);
    });
}

/**
 * Creates the HTML string for a single timeline item.
 */
function createTimelineItemHTML(item) {
    const iconDetails = getIconDetails(item.type);
    let titleHTML = `<p class="event-title">${item.title} <span class="event-time">${item.time}</span>`;
    if (item.type === 'Lab Booking') {
        const statusClass = item.attended ? 'attended-yes' : 'attended-no';
        const statusText = item.attended ? 'Attended' : 'Not Attended';
        titleHTML += ` <span class="attendance-status ${statusClass}">${statusText}</span>`;
    }
    titleHTML += `</p>`;
    return `
        <div class="timeline-item">
            <div class="timeline-icon-wrapper ${iconDetails.color}">${iconDetails.svg}</div>
            <div class="timeline-content">
                ${titleHTML}
                <p class="event-details">${item.details}</p>
            </div>
        </div>`;
}

/**
 * Returns the appropriate icon SVG and color class for each event type.
 */
function getIconDetails(type) {
    const icons = {
        'Card Swipe': { color: 'cyan', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h6m3-5.25h6m-6 2.25h6m3-5.25h6m-6 2.25h6M2.25 19.5h19.5M2.25 4.5h19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H2.25A2.25 2.25 0 0 1 0 17.25V6.75A2.25 2.25 0 0 1 2.25 4.5Z" /></svg>` },
        'Wi-Fi Log': { color: 'purple', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" /></svg>` },
        'Lab Booking': { color: 'emerald', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12v-.008Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75v-.008Zm0 2.25h.008v.008H9.75v-.008Zm2.25-4.5h.008v.008H12v-.008Zm1.5.008h.008v.008h-.008v-.008Zm2.25.008h.008v.008h-.008v-.008Z" /></svg>` },
        'CCTV Frame': { color: 'purple', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" /></svg>` },
        'Library Checkout': { color: 'cyan', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>`},
        'Note': { color: 'purple', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>`}
    };
    return icons[type] || icons['Card Swipe'];
}
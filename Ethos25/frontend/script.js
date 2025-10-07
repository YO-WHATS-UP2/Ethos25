// --- CONFIGURATION & DOM REFERENCES ---
const API_BASE_URL = 'http://localhost:3000';
const ENTITY_ENDPOINT = '/search/entity';

const searchContainer = document.getElementById('search-container');
const loadingContainer = document.getElementById('loading-container');
const resultsContainer = document.getElementById('results-container');
const searchForm = document.getElementById('search-form');
const entityIdInput = document.getElementById('entity-id-input');
const newSearchBtn = document.getElementById('new-search-btn');
const resultEntityIdSpan = document.getElementById('result-entity-id');
const timelineList = document.getElementById('timeline-list');
const profileImage = document.getElementById('profile-image');
const profileName = document.getElementById('profile-name');
const profileRole = document.getElementById('profile-role');
const profileEmail = document.getElementById('profile-email');
const profileDept = document.getElementById('profile-dept');
const profileStudentId = document.getElementById('profile-student-id');
const profileCardId = document.getElementById('profile-card-id');
const profileDeviceHash = document.getElementById('profile-device-hash');
const profileFaceId = document.getElementById('profile-face-id');

// --- EVENT LISTENERS ---
searchForm.addEventListener('submit', handleSearch);
newSearchBtn.addEventListener('click', resetView);

async function handleSearch(event) {
    event.preventDefault();
    const entityId = entityIdInput.value.trim().toUpperCase();
    if (!entityId) {
        alert('Please enter an Entity ID.');
        return;
    }
    showView('loading');
    try {
        const response = await fetch(`${API_BASE_URL}${ENTITY_ENDPOINT}?entityId=${entityId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Entity not found.');
        }

        populateProfileCard(result.profile);
        const timelineData = formatAndSortTimeline(result.activity);
        renderTimeline(timelineData);
        resultEntityIdSpan.textContent = entityId;

        showView('results');
    } catch (error) {
        console.error('Error fetching data:', error);
        alert(`An error occurred: ${error.message}`);
        resetView();
    }
}

// --- DATA PROCESSING ---
function formatAndSortTimeline(activityData) {
    const timeline = [];

    const extractEvents = (label, events, primaryField, secondaryField = null) => {
        if (!events || events.length === 0) return;
        events.forEach(event => {
            const timeStart = event[primaryField];
            const sortTime = new Date(timeStart);
            if (!timeStart || isNaN(sortTime.getTime())) return;

            let item = { type: label, title: label, time: timeStart, details: '', sortTime: sortTime };

            switch (label) {
                case 'Card Swipe': item.details = `Location: ${event.location_id || 'Unknown'}`; item.time = new Date(item.time).toLocaleString(); break;
                case 'Lab Booking':
                    item.time = `${new Date(timeStart).toLocaleDateString()} ${new Date(timeStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(event[secondaryField]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                    item.details = `Booked: ${event.room_id || 'Unknown Lab'}`;
                    item.attended = event['attended (YES/NO)'] === 'YES';
                    break;
                case 'Wi-Fi Log': item.details = `Connected to AP: ${event.ap_id || 'Unknown'}`; item.time = new Date(item.time).toLocaleString(); break;
                case 'CCTV Frame': item.details = `Detected near: ${event.location_id || 'Unknown'}`; item.time = new Date(item.time).toLocaleString(); break;
                case 'Library Checkout': item.details = `Checked out book: ${event.book_id || 'Unknown'}`; item.time = new Date(item.time).toLocaleString(); break;
                case 'Note': item.details = `Note (${event.category || 'General'}): ${event.text || 'No details'}`; item.time = new Date(item.time).toLocaleString(); break;
            }
            timeline.push(item);
        });
    };
    
    // CORRECTED: This function now passes all necessary data through
    const extractAlerts = (alerts) => {
        if (!alerts || alerts.length === 0) return;
        alerts.forEach(alert => {
            const sortTime = new Date(alert.alert_timestamp);
            if (isNaN(sortTime.getTime())) return;

            timeline.push({
                type: 'Alert',
                title: `Predicted Location: <strong>${alert.predicted_location_after_12hr}</strong>`,
                time: new Date(alert.alert_timestamp).toLocaleString(),
                sortTime: sortTime,
                // Pass raw data for the rendering function
                alert_reason: alert.alert_reason,
                prediction_confidence: alert.prediction_confidence,
                last_known_location: alert.last_known_location
            });
        });
    };

    extractEvents('Card Swipe', activityData.cardSwipes, 'timestamp');
    extractEvents('Lab Booking', activityData.labBookings, 'start_time', 'end_time');
    extractEvents('Wi-Fi Log', activityData.wifiLogs, 'timestamp');
    extractEvents('CCTV Frame', activityData.cctvFrames, 'timestamp');
    extractEvents('Library Checkout', activityData.libraryCheckouts, 'timestamp');
    extractEvents('Note', activityData.notes, 'timestamp');
    extractAlerts(activityData.alerts);

    timeline.sort((a, b) => a.sortTime - b.sortTime);
    return timeline;
}

// --- UI RENDERING FUNCTIONS ---
function populateProfileCard(profile) {
    if (profile.face_id) {
        profileImage.src = `${API_BASE_URL}/images/${profile.face_id}.jpg`;
        profileImage.style.display = 'block';
    } else {
        profileImage.style.display = 'none';
    }
    profileName.textContent = profile.name || 'N/A';
    profileRole.textContent = profile.role || 'N/A';
    profileEmail.textContent = profile.email || 'N/A';
    profileDept.textContent = profile.department || 'N/A';
    profileStudentId.textContent = profile.student_id || 'N/A';
    profileCardId.textContent = profile.card_id || 'N/A';
    profileDeviceHash.textContent = profile.device_hash || 'N/A';
    profileFaceId.textContent = profile.face_id || 'N/A';
}

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

function createTimelineItemHTML(item) {
    const iconDetails = getIconDetails(item.type);
    let itemClass = 'timeline-item';
    let iconColorClass = iconDetails.color;

    // CORRECTED: This function now correctly handles alert data and styling
    if (item.type === 'Alert') {
        if (item.alert_reason.startsWith('ALERT')) itemClass += ' alert-high';
        else if (item.alert_reason.startsWith('Unusual')) itemClass += ' alert-medium';
        else itemClass += ' alert-low';
        
        iconColorClass = ''; // Remove default color to let CSS handle it

        const confidence = (parseFloat(item.prediction_confidence) * 100).toFixed(0);
        const titleHTML = `<p class="event-title">${item.title} <span class="event-time">${item.time}</span></p>`;
        const reasonHTML = `<p class="event-details alert-reason">${item.alert_reason}</p>`;
        const contextHTML = `<p class="event-details alert-context">(Confidence: ${confidence}%) - Based on last activity at ${item.last_known_location}</p>`;
        
        return `
            <div class="${itemClass}">
                <div class="timeline-icon-wrapper ${iconColorClass}">${iconDetails.svg}</div>
                <div class="timeline-content">
                    ${titleHTML}
                    ${reasonHTML}
                    ${contextHTML}
                </div>
            </div>`;
    }

    // HTML for historical events
    let titleHTML = `<p class="event-title">${item.title} <span class="event-time">${item.time}</span>`;
    if (item.type === 'Lab Booking') {
        const statusClass = item.attended ? 'attended-yes' : 'attended-no';
        const statusText = item.attended ? 'Attended' : 'Not Attended';
        titleHTML += ` <span class="attendance-status ${statusClass}">${statusText}</span>`;
    }
    titleHTML += `</p>`;
    return `
        <div class="timeline-item">
            <div class="timeline-icon-wrapper ${iconColorClass}">${iconDetails.svg}</div>
            <div class="timeline-content">
                ${titleHTML}
                <p class="event-details">${item.details}</p>
            </div>
        </div>`;
}

function getIconDetails(type) {
    const icons = {
        'Card Swipe': { color: 'cyan', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h6m3-5.25h6m-6 2.25h6m3-5.25h6m-6 2.25h6M2.25 19.5h19.5M2.25 4.5h19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H2.25A2.25 2.25 0 0 1 0 17.25V6.75A2.25 2.25 0 0 1 2.25 4.5Z" /></svg>` },
        'Wi-Fi Log': { color: 'purple', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" /></svg>` },
        'Lab Booking': { color: 'emerald', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12v-.008Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75v-.008Zm0 2.25h.008v.008H9.75v-.008Zm2.25-4.5h.008v.008H12v-.008Zm1.5.008h.008v.008h-.008v-.008Zm2.25.008h.008v.008h-.008v-.008Z" /></svg>` },
        'CCTV Frame': { color: 'purple', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" /></svg>` },
        'Library Checkout': { color: 'cyan', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>`},
        'Note': { color: 'purple', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>`},
        'Alert': { color: '', svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.007H12v-.007Z" /></svg>` }
    };
    return icons[type] || icons['Card Swipe'];
}

function showView(viewName) {
    searchContainer.classList.add('hidden');
    loadingContainer.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    if (viewName === 'search') searchContainer.classList.remove('hidden');
    if (viewName === 'loading') loadingContainer.classList.remove('hidden');
    if (viewName === 'results') resultsContainer.classList.remove('hidden');
}

function resetView() {
    resultsContainer.classList.add('hidden');
    searchContainer.classList.remove('hidden');
    entityIdInput.value = '';
}
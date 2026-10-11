/* ==========================================================================
   SITEGUARD 360 - FRONTEND APPLICATION JAVASCRIPT
   Minimal, clean, functional. No emojis.
   ========================================================================== */

let siteData = null;
let currentRole = "Safety Officer";
let currentCameraId = "CAM-01";
let currentMapFloor = "Floor 2";
let activeHazardForAction = null;
let demoStep = 0;
let demoInterval = null;

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('siteguard_theme') || localStorage.getItem('buildguard_theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
        const textElem = document.getElementById('theme-toggle-text');
        if (textElem) textElem.innerText = 'Dark';
    } else {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        const textElem = document.getElementById('theme-toggle-text');
        if (textElem) textElem.innerText = 'Light';
    }
    localStorage.setItem('siteguard_theme', theme);
    localStorage.setItem('buildguard_theme', theme);
}

function toggleTheme() {
    const isDark = document.body.classList.contains('theme-dark');
    setTheme(isDark ? 'light' : 'dark');
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    fetchSiteState();
    fetchGPSWorkers();
    checkFirebaseStatus();
    startClock();
    updateTabRecommendations();
    
    setInterval(fetchSiteState, 10000);
    setInterval(fetchGPSWorkers, 3000);
    setInterval(checkFirebaseStatus, 30000);
});

// Firebase Cloud Status Check
async function checkFirebaseStatus() {
    try {
        const res = await fetch('/api/firebase/status');
        if (!res.ok) return;
        const data = await res.json();
        const badge = document.getElementById('firebase-status-badge');
        if (badge) {
            if (data.connected) {
                badge.style.display = 'inline-flex';
                badge.style.background = 'rgba(16, 185, 129, 0.12)';
                badge.style.color = '#10b981';
                badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                badge.innerHTML = '<i class="fa-solid fa-cloud" style="color: #10b981;"></i> <span>Firestore Connected</span>';
                badge.title = `Connected to Firebase Cloud Firestore (${data.project_id})`;
            } else {
                badge.style.background = 'rgba(239, 68, 68, 0.12)';
                badge.style.color = '#ef4444';
                badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                badge.innerHTML = '<i class="fa-solid fa-cloud-slash"></i> <span>Firestore Offline</span>';
                badge.title = 'Firebase offline - local fallback active';
            }
        }
    } catch (e) {
        console.warn("Firebase status check:", e);
    }
}


// Real-time Clock
function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById("live-clock").innerText = now.toLocaleTimeString();
    }, 1000);
}

// Fetch Full Site State from API
async function fetchSiteState() {
    try {
        const response = await fetch('/api/site-state');
        if (!response.ok) throw new Error("Network error fetching state");
        siteData = await response.json();
        
        updateTopBar();
        renderActiveTab();
    } catch (err) {
        console.error("Error fetching site state:", err);
    }
}

// Role Switching
function switchRole(newRole) {
    currentRole = newRole;
    
    const messages = {
        "Safety Officer": "OSHA PPE compliance & real-time critical hazard monitoring active.",
        "Site Manager": "Executive project velocity, safety scores, & audit reporting active.",
        "Site Supervisor": "Floor crew allocation, zone headcount, & GPS proximity active."
    };
    showRoleToast(newRole, messages[newRole] || `Switched to ${newRole} mode.`);
    
    updateTabRecommendations();
    renderActiveTab();
}

function showRoleToast(role, message) {
    const existing = document.getElementById("active-role-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "active-role-toast";
    toast.className = "role-toast-notification";
    
    let iconClass = "fa-user-shield";
    let iconColor = "#ef4444";
    if (role === "Site Manager") {
        iconClass = "fa-chart-pie";
        iconColor = "#3b82f6";
    } else if (role === "Site Supervisor") {
        iconClass = "fa-users-gear";
        iconColor = "#f59e0b";
    }
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}" style="color:${iconColor}; font-size:16px;"></i>
        <div>
            <strong>${role} View Active</strong>
            <div style="color:#aaa; font-size:11px; margin-top:2px;">${message}</div>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s ease';
            setTimeout(() => toast.remove(), 400);
        }
    }, 3500);
}

function updateTabRecommendations() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('role-recommended');
    });

    const recommendations = {
        "Safety Officer": ['tab-live-monitoring', 'tab-hazards', 'tab-gps-radar'],
        "Site Manager": ['tab-construction-progress', 'tab-analytics', 'tab-reports'],
        "Site Supervisor": ['tab-gps-radar', 'tab-site-map', 'tab-workers']
    };

    const targetTabs = recommendations[currentRole] || [];
    targetTabs.forEach(tabId => {
        const btn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
        if (btn) btn.classList.add('role-recommended');
    });
}

// Tab Navigation
function switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
    });
    
    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.toggle('active', view.id === tabId);
    });

    renderActiveTab();
}

function getActiveTabId() {
    const activeTab = document.querySelector('.tab-view.active');
    return activeTab ? activeTab.id : 'tab-dashboard';
}

function renderActiveTab() {
    if (!siteData) return;
    
    const activeId = getActiveTabId();
    switch (activeId) {
        case 'tab-dashboard':
            renderDashboard();
            break;
        case 'tab-gps-radar':
            renderGPSRadarView();
            break;
        case 'tab-live-monitoring':
            renderLiveMonitoring();
            break;
        case 'tab-site-map':
            renderSiteMap(currentMapFloor);
            break;
        case 'tab-workers':
            renderWorkersRoster();
            break;
        case 'tab-hazards':
            renderHazardsTable();
            break;
        case 'tab-construction-progress':
            renderConstructionProgress();
            break;
        case 'tab-analytics':
            renderAnalyticsCharts();
            break;
        case 'tab-reports':
            renderReports();
            break;
    }
}

// Update Top Command Bar
function updateTopBar() {
    if (!siteData) return;
    
    const locElem = document.getElementById("site-location-name");
    if (locElem && siteData.site_name) {
        locElem.innerText = siteData.site_name;
    }

    document.getElementById("site-status-text").innerText = `SITE: ${siteData.site_safety_status}`;
    document.getElementById("kpi-safety-status").innerText = siteData.site_safety_status;
    document.getElementById("kpi-safety-score").innerText = `${siteData.safety_score}%`;
    document.getElementById("kpi-workers-count").innerText = siteData.active_workers_count;
    document.getElementById("kpi-hazards-count").innerText = siteData.active_hazards_count;
    document.getElementById("kpi-high-risk-count").innerText = siteData.high_risk_hazards_count;
    document.getElementById("kpi-progress-pct").innerText = `${siteData.project_activity_progress}%`;
}

/* ==================== 1. DASHBOARD VIEW ==================== */
function renderDashboard() {
    if (!siteData) return;

    renderRolePerspectiveRibbon();
    highlightRoleKPIs();
    renderRoleSpecialtyPanel();

    const feedContainer = document.getElementById("dash-alerts-feed");
    const activeHazards = siteData.hazards.filter(h => h.status !== "Resolved");
    document.getElementById("dash-alerts-count").innerText = `${activeHazards.length} Active`;

    // Dynamically update camera alert banner over live stream preview
    const dashCamAlert = document.getElementById("dash-camera-alert-banner");
    const dashCamAlertText = document.getElementById("dash-camera-alert-text");
    const criticalHazards = activeHazards.filter(h => h.risk === "HIGH" || h.risk === "CRITICAL");
    if (dashCamAlert) {
        if (criticalHazards.length > 0) {
            const topH = criticalHazards[0];
            if (dashCamAlertText) {
                dashCamAlertText.innerHTML = `<strong>${topH.risk} RISK:</strong> ${topH.worker_name} — ${topH.issue} (${topH.location})`;
            }
            dashCamAlert.style.display = "flex";
        } else {
            dashCamAlert.style.display = "none";
        }
    }

    feedContainer.innerHTML = activeHazards.map(h => `
        <div class="alert-item-card ${h.risk.toLowerCase()}">
            <div class="alert-header-line">
                <span class="alert-title">${h.worker_name} — ${h.issue}</span>
                <span class="badge ${h.risk === 'HIGH' ? 'badge-risk-high' : 'badge-count'}">${h.risk}</span>
            </div>
            <div class="alert-loc">
                <i class="fa-solid fa-location-dot"></i> ${h.location} | <i class="fa-regular fa-clock"></i> ${h.time}
            </div>
            <div class="alert-actions-mini">
                <button class="btn btn-sm btn-outline" onclick="openHazardModal('${h.id}')">
                    <i class="fa-solid fa-shield-halved"></i> Manage
                </button>
            </div>
        </div>
    `).join('');

    // Construction Activity Breakdown
    const floorList = document.getElementById("dash-floor-progress-list");
    floorList.innerHTML = siteData.construction_activities.floors.map(f => `
        <div class="floor-item">
            <div class="floor-header">
                <span>${f.floor}</span>
                <span><strong>${f.progress}%</strong></span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${f.progress}%;"></div>
            </div>
        </div>
    `).join('');

    // Worker Watchlist
    const watchlist = document.getElementById("dash-worker-watchlist");
    watchlist.innerHTML = siteData.workers.map(w => `
        <div class="w-card mb-2" onclick="openWorkerModal('${w.id}')" style="cursor:pointer;">
            <div class="w-card-header">
                <span>${w.name} (${w.role})</span>
                <span class="badge ${w.risk === 'HIGH' ? 'badge-risk-high' : 'badge-risk-safe'}">${w.risk}</span>
            </div>
            <div class="ppe-pills">
                <span class="ppe-pill ${w.ppe.helmet === 'OK' ? 'ok' : 'missing'}">Helmet: ${w.ppe.helmet}</span>
                <span class="ppe-pill ${w.ppe.vest === 'OK' ? 'ok' : 'missing'}">Vest: ${w.ppe.vest}</span>
                <span class="ppe-pill ok">Loc: ${w.zone}</span>
            </div>
        </div>
    `).join('');
}

function renderRolePerspectiveRibbon() {
    const banner = document.getElementById("role-perspective-banner");
    if (!banner) return;

    banner.className = `role-perspective-banner role-${currentRole.toLowerCase().replace(/\s+/g, '-')}`;
    
    const pill = document.getElementById("role-badge-pill");
    const name = document.getElementById("role-badge-name");
    const title = document.getElementById("role-ribbon-title");
    const desc = document.getElementById("role-ribbon-desc");
    const actions = document.getElementById("role-ribbon-actions");

    if (currentRole === "Safety Officer") {
        if (pill) pill.className = "role-badge-pill safety-officer";
        if (name) name.innerHTML = `<i class="fa-solid fa-user-shield"></i> Safety Officer`;
        if (title) title.innerText = "OSHA PPE Compliance & Hazard Remediation";
        if (desc) desc.innerText = "Focus: Active PPE violations, danger zone perimeter ledges, and rapid incident response.";
        if (actions) {
            actions.innerHTML = `
                <button class="btn btn-sm btn-danger" onclick="broadcastSafetyAudioAlarm()" title="Broadcast live audible site warning siren">
                    <i class="fa-solid fa-bullhorn"></i> Site Siren
                </button>
                <button class="btn btn-sm btn-primary" onclick="switchTab('tab-live-monitoring')">
                    <i class="fa-solid fa-video"></i> Live PPE Cam
                </button>
                <button class="btn btn-sm btn-outline" onclick="switchTab('tab-hazards')">
                    <i class="fa-solid fa-shield-halved"></i> Hazard Log
                </button>
            `;
        }
    } else if (currentRole === "Site Manager") {
        if (pill) pill.className = "role-badge-pill site-manager";
        if (name) name.innerHTML = `<i class="fa-solid fa-chart-pie"></i> Site Manager`;
        if (title) title.innerText = "Executive Project Velocity & Safety Audit Command";
        if (desc) desc.innerText = "Focus: Multi-floor milestone velocity, overall safety compliance index, and exportable regulatory reporting.";
        if (actions) {
            actions.innerHTML = `
                <button class="btn btn-sm btn-primary" onclick="switchTab('tab-reports')">
                    <i class="fa-solid fa-file-contract"></i> Executive Report
                </button>
                <button class="btn btn-sm btn-outline" onclick="switchTab('tab-construction-progress')">
                    <i class="fa-solid fa-trowel-bricks"></i> Milestone Matrix
                </button>
                <button class="btn btn-sm btn-outline" onclick="downloadJSONReport()">
                    <i class="fa-solid fa-download"></i> Export JSON
                </button>
            `;
        }
    } else { // Site Supervisor
        if (pill) pill.className = "role-badge-pill site-supervisor";
        if (name) name.innerHTML = `<i class="fa-solid fa-users-gear"></i> Site Supervisor`;
        if (title) title.innerText = "Shift Crew Deployment, Zone Headcount & Equipment Clearances";
        if (desc) desc.innerText = "Focus: Deck workforce trade density, worker GPS positions, and heavy equipment exclusion zones.";
        if (actions) {
            actions.innerHTML = `
                <button class="btn btn-sm btn-primary" onclick="switchTab('tab-gps-radar')">
                    <i class="fa-solid fa-satellite-dish"></i> GPS Proximity
                </button>
                <button class="btn btn-sm btn-outline" onclick="switchTab('tab-site-map')">
                    <i class="fa-solid fa-map-location-dot"></i> Zone Matrix
                </button>
                <button class="btn btn-sm btn-outline" onclick="broadcastSupervisorNotice()">
                    <i class="fa-solid fa-walkie-talkie"></i> Radio Dispatch
                </button>
            `;
        }
    }
}

function highlightRoleKPIs() {
    const kpiCards = document.querySelectorAll('.kpi-card');
    kpiCards.forEach(card => {
        card.classList.remove('role-highlight');
        const oldBadge = card.querySelector('.kpi-focus-badge');
        if (oldBadge) oldBadge.remove();
    });

    let targetCardIndexes = [];
    let focusLabel = "FOCUS";

    if (currentRole === "Safety Officer") {
        targetCardIndexes = [0, 2]; // Safety Status (0) & Active Hazards (2)
        focusLabel = "SAFETY FOCUS";
    } else if (currentRole === "Site Manager") {
        targetCardIndexes = [0, 3]; // Safety Score / Status (0) & Progress (3)
        focusLabel = "EXECUTIVE FOCUS";
    } else { // Site Supervisor
        targetCardIndexes = [1, 2]; // Active Workers (1) & Active Hazards (2)
        focusLabel = "CREW FOCUS";
    }

    targetCardIndexes.forEach(idx => {
        if (kpiCards[idx]) {
            kpiCards[idx].classList.add('role-highlight');
            const badge = document.createElement('span');
            badge.className = 'kpi-focus-badge';
            badge.innerText = focusLabel;
            kpiCards[idx].appendChild(badge);
        }
    });
}

function renderRoleSpecialtyPanel() {
    const titleEl = document.getElementById("role-specialty-title");
    const badgeEl = document.getElementById("role-specialty-badge");
    const bodyEl = document.getElementById("role-specialty-body");
    if (!bodyEl) return;

    if (currentRole === "Safety Officer") {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-shield-halved" style="color:#ef4444;"></i> OSHA Compliance Protocols`;
        if (badgeEl) badgeEl.innerText = "OSHA Standard 1926";
        bodyEl.innerHTML = `
            <div class="role-specialty-box">
                <div class="role-stat-row">
                    <span>OSHA 1926.100 (Head Protection)</span>
                    <strong class="text-warning">Enforced / Active</strong>
                </div>
                <div class="role-stat-row">
                    <span>OSHA 1926.201 (High-Vis Apparel)</span>
                    <strong class="text-green">100% Compliant</strong>
                </div>
                <div class="role-stat-row">
                    <span>OSHA 1926.501 (Perimeter Fall Tie-Off)</span>
                    <strong class="text-danger">Critical Inspection</strong>
                </div>
                <div style="display:flex; gap:8px; margin-top:4px;">
                    <button class="btn btn-sm btn-outline btn-block" onclick="acknowledgeAllSafetyOfficerHazards()">
                        <i class="fa-solid fa-check-double"></i> Batch Ack Warnings
                    </button>
                    <button class="btn btn-sm btn-danger btn-block" onclick="broadcastSafetyAudioAlarm()">
                        <i class="fa-solid fa-bullhorn"></i> Sound Siren
                    </button>
                </div>
            </div>
        `;
    } else if (currentRole === "Site Manager") {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-chart-column" style="color:#3b82f6;"></i> Milestone Velocity & Audit`;
        if (badgeEl) badgeEl.innerText = "Executive Brief";
        bodyEl.innerHTML = `
            <div class="role-specialty-box">
                <div class="role-stat-row">
                    <span>Project Milestone Velocity</span>
                    <strong class="text-green">On Schedule (67%)</strong>
                </div>
                <div class="role-stat-row">
                    <span>Safety-to-Progress Index</span>
                    <strong style="color:#3b82f6;">91.4 Index (Optimal)</strong>
                </div>
                <div class="role-stat-row">
                    <span>Days Without Lost-Time Incident</span>
                    <strong>48 Days</strong>
                </div>
                <div style="display:flex; gap:8px; margin-top:4px;">
                    <button class="btn btn-sm btn-primary btn-block" onclick="switchTab('tab-reports')">
                        <i class="fa-solid fa-print"></i> Generate Brief
                    </button>
                    <button class="btn btn-sm btn-outline btn-block" onclick="downloadJSONReport()">
                        <i class="fa-solid fa-file-export"></i> Audit Export
                    </button>
                </div>
            </div>
        `;
    } else { // Site Supervisor
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-users-gear" style="color:#f59e0b;"></i> Floor Crew & Zone Density`;
        if (badgeEl) badgeEl.innerText = "Shift Dispatch";
        bodyEl.innerHTML = `
            <div class="role-specialty-box">
                <div class="role-stat-row">
                    <span>Zone A (Entry & Core Staging)</span>
                    <strong>12 Workers</strong>
                </div>
                <div class="role-stat-row">
                    <span>Zone B (Beam Construction Grid)</span>
                    <strong>8 Workers</strong>
                </div>
                <div class="role-stat-row">
                    <span>Zone C (Heavy Material Transit Corridor)</span>
                    <strong class="text-warning">7 Workers (Buffer Alert)</strong>
                </div>
                <div class="role-stat-row">
                    <span>Zone D (Open Slab Ledge & Crane Lift)</span>
                    <strong class="text-danger">5 Workers (Harness Check)</strong>
                </div>
                <div style="display:flex; gap:8px; margin-top:4px;">
                    <button class="btn btn-sm btn-outline btn-block" onclick="switchTab('tab-workers')">
                        <i class="fa-solid fa-users-viewfinder"></i> Full Roster
                    </button>
                    <button class="btn btn-sm btn-warning btn-block" onclick="broadcastSupervisorNotice()">
                        <i class="fa-solid fa-walkie-talkie"></i> Radio Dispatch
                    </button>
                </div>
            </div>
        `;
    }
}

function broadcastSafetyAudioAlarm() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.36);
    } catch (e) {
        console.warn("AudioContext warning:", e);
    }
    showRoleToast("Safety Officer", "🚨 AUDIBLE SITE SIREN: Emergency warning broadcast dispatched across Floor 2 deck.");
}

function broadcastSupervisorNotice() {
    showRoleToast("Site Supervisor", "📻 CREW RADIO NOTICE: Equipment buffer reminder broadcast to trade leads in Zones C & D.");
}

function acknowledgeAllSafetyOfficerHazards() {
    if (!siteData || !siteData.hazards) return;
    const active = siteData.hazards.filter(h => h.status === "Active");
    if (active.length === 0) {
        showRoleToast("Safety Officer", "No active hazards pending acknowledgment.");
        return;
    }
    active.forEach(h => {
        h.status = "Acknowledged";
        h.resolve_notes = "Batch acknowledged by Safety Officer on duty.";
        fetch(`/api/hazards/${h.id}/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Acknowledged', notes: h.resolve_notes, user: `Supervisor (${currentRole})` })
        }).catch(err => console.error("Error acknowledging hazard:", err));
    });
    siteData.active_hazards_count = siteData.hazards.filter(h => h.status !== "Resolved").length;
    updateTopBar();
    renderDashboard();
    showRoleToast("Safety Officer", `Acknowledged ${active.length} active hazard alerts.`);
}

let floorPlanViewModes = {};
let uploadedFloorPlans = {};

/* ==================== 2. LIVE MONITORING VIEW ==================== */
let liveTelemetryTimer = null;

function renderLiveMonitoring() {
    if (!siteData) return;

    const camList = document.getElementById("camera-select-list");
    camList.innerHTML = siteData.cameras.map(c => `
        <button class="cam-btn ${c.id === currentCameraId ? 'active' : ''}" onclick="selectCamera('${c.id}')">
            <div>
                <strong>${c.name}</strong>
                <span>Floor: ${c.floor} | Zone: ${c.zone}</span>
            </div>
            <span class="badge ${c.is_custom ? 'badge-count' : (c.risk === 'HIGH' ? 'badge-risk-high' : 'badge-risk-safe')}">${c.is_custom ? 'CUSTOM' : c.risk}</span>
        </button>
    `).join('');

    const cam = siteData.cameras.find(c => c.id === currentCameraId) || siteData.cameras[0];
    document.getElementById("current-camera-title").innerHTML = `<i class="fa-solid fa-camera"></i> ${cam.name}`;
    document.getElementById("current-camera-location").innerText = `${cam.floor} — ${cam.zone}`;
    
    const streamImg = document.getElementById("live-camera-stream-img");
    if (streamImg) {
        if (cam.media_type === "image" && (cam.annotated_b64 || cam.annotated_image)) {
            streamImg.src = cam.annotated_b64 || cam.annotated_image;
        } else {
            streamImg.src = `/api/video-feed/${cam.id}?t=${Date.now()}`;
        }
    }

    // Run immediate telemetry and hazard sync
    pollCameraTelemetry(cam.id);

    // Setup periodic polling so detections in live monitoring continuously sync to hazard log & alerts history
    if (!liveTelemetryTimer) {
        liveTelemetryTimer = setInterval(() => {
            if (getActiveTabId() === 'tab-live-monitoring') {
                pollCameraTelemetry(currentCameraId);
            }
        }, 3000);
    }
}

function pollCameraTelemetry(camId) {
    fetch('/api/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera_id: camId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.analysis) {
            renderTelemetry(data.analysis);
        }
        if (data.hazards && siteData) {
            siteData.hazards = data.hazards;
            if (typeof data.active_hazards_count !== 'undefined') siteData.active_hazards_count = data.active_hazards_count;
            if (typeof data.high_risk_hazards_count !== 'undefined') siteData.high_risk_hazards_count = data.high_risk_hazards_count;
            if (data.site_safety_status) siteData.site_safety_status = data.site_safety_status;
            if (typeof data.safety_score !== 'undefined') siteData.safety_score = data.safety_score;
            updateTopBar();

            // Refresh alert feed if dashboard is active or hazards table if hazards tab is active
            const activeTab = getActiveTabId();
            if (activeTab === 'tab-hazards') {
                renderHazardsTable();
            } else if (activeTab === 'tab-dashboard') {
                renderDashboard();
            }
        }
    })
    .catch(e => console.error("Telemetry error:", e));
}

function selectCamera(camId) {
    currentCameraId = camId;
    renderLiveMonitoring();
}

function renderTelemetry(analysis) {
    const workerBox = document.getElementById("live-worker-telemetry");
    const detBox = document.getElementById("raw-detections-list");

    if (!analysis.workers || analysis.workers.length === 0) {
        workerBox.innerHTML = "<p class='help-text'>No workers detected in frame.</p>";
    } else {
        workerBox.innerHTML = analysis.workers.map(w => `
            <div class="w-card" onclick="openWorkerModal('${w.id}')">
                <div class="w-card-header">
                    <span>${w.name} (${w.id})</span>
                    <span class="badge ${w.risk === 'HIGH' || w.risk === 'CRITICAL' ? 'badge-risk-high' : 'badge-risk-safe'}">${w.risk}</span>
                </div>
                <div class="ppe-pills mb-2">
                    <span class="ppe-pill ${w.ppe.helmet === 'OK' ? 'ok' : 'missing'}">Helmet ${w.ppe.helmet}</span>
                    <span class="ppe-pill ${w.ppe.vest === 'OK' ? 'ok' : 'missing'}">Vest ${w.ppe.vest}</span>
                    <span class="ppe-pill ok">Zone: ${w.zone}</span>
                </div>
                ${w.violations.length > 0 ? `
                    <div style="font-size:11px; color:var(--status-high);">
                        <strong>Violations:</strong> ${w.violations.map(v => v.type).join(', ')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    detBox.innerHTML = analysis.all_detections.map(d => `
        <div class="alert-item-card warning mb-1" style="padding:6px 10px; font-size:11px;">
            <strong>Class:</strong> ${d.class} | <strong>Conf:</strong> ${(d.confidence*100).toFixed(0)}%
        </div>
    `).join('');
}

function handleMediaUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    fetch('/api/upload-media', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.success && data.camera) {
            currentCameraId = "CAM-CUSTOM";
            if (!siteData) siteData = { cameras: [] };
            if (!siteData.cameras) siteData.cameras = [];
            
            const idx = siteData.cameras.findIndex(c => c.id === "CAM-CUSTOM");
            if (idx !== -1) {
                siteData.cameras[idx] = data.camera;
            } else {
                siteData.cameras.push(data.camera);
            }

            // Switch to Live Monitoring view to show detected results immediately
            switchTab('tab-live-monitoring');
            renderLiveMonitoring();

            if (data.media_type === "image" && data.annotated_image) {
                const streamImg = document.getElementById("live-camera-stream-img");
                if (streamImg) {
                    streamImg.src = data.annotated_image;
                }
            }

            if (data.analysis) renderTelemetry(data.analysis);
            fetchSiteState();
        } else if (data.error) {
            alert("Upload Error: " + data.error);
        }
    })
    .catch(err => console.error("Media upload failed:", err));
}

function handleImageUpload(event) {
    handleMediaUpload(event);
}

/* ==================== 3. INTERACTIVE SITE MAP VIEW ==================== */
const floorZoneConfigs = {
    "Floor 1": {
        title: "Floor 1 — Ground Structural",
        zones: {
            "Zone A": { label: "Main Entry & Staging", risk: "SAFE", desc: "Access control, PPE check & tool station." },
            "Zone B": { label: "Column Pouring Bay", risk: "SAFE", desc: "Concrete foundation columns curing." },
            "Zone C": { label: "Equipment Corridor", risk: "WARNING", desc: "Excavator transit & material staging." },
            "Zone D": { label: "Electrical Trench", risk: "WARNING", desc: "High voltage conduit & underground trench." }
        }
    },
    "Floor 2": {
        title: "Floor 2 — Main Active Deck",
        zones: {
            "Zone A": { label: "Assembly & Rest Bay", risk: "SAFE", desc: "Normal operations. Crew briefing." },
            "Zone B": { label: "Beam Construction", risk: "SAFE", desc: "Steel beam framing in progress." },
            "Zone C": { label: "Material Storage", risk: "WARNING", desc: "Rebar stacks & scaffolding." },
            "Zone D": { label: "Open Slab Edge / Crane", risk: "HIGH", desc: "Fall hazard zone & crane radius." }
        }
    },
    "Floor 3": {
        title: "Floor 3 — Framing & Crane",
        zones: {
            "Zone A": { label: "Concrete Curing Deck", risk: "SAFE", desc: "Formwork stripped, curing." },
            "Zone B": { label: "Perimeter Nets", risk: "WARNING", desc: "Safety net rigging & tie-offs." },
            "Zone C": { label: "Upper Beam Framing", risk: "WARNING", desc: "Joist & metal deck placement." },
            "Zone D": { label: "Crane Overhead Zone", risk: "HIGH", desc: "Overhead lifting danger." }
        }
    }
};

function renderSiteMap(floorName) {
    if (!floorName) floorName = "Floor 2";
    currentMapFloor = floorName;

    const floorSelectElem = document.getElementById("map-floor-select");
    if (floorSelectElem && floorSelectElem.value !== floorName) {
        floorSelectElem.value = floorName;
    }

    const mapSurface = document.getElementById("interactive-map-surface");
    if (!mapSurface) return;

    const toggleBtn = document.getElementById("btn-toggle-blueprint-view");
    const resetBtn = document.getElementById("btn-reset-blueprint");
    const analysisCard = document.getElementById("blueprint-analysis-card");

    const fp = (siteData && siteData.floor_plans && siteData.floor_plans[floorName]) || uploadedFloorPlans[floorName];
    const hasActiveBlueprint = fp && fp.is_active !== false && (fp.image_url || fp.image_b64);

    if (toggleBtn) toggleBtn.style.display = hasActiveBlueprint ? "inline-flex" : "none";
    if (resetBtn) resetBtn.style.display = hasActiveBlueprint ? "inline-flex" : "none";

    const currentMode = floorPlanViewModes[floorName] || (hasActiveBlueprint ? 'blueprint' : 'matrix');

    if (hasActiveBlueprint && currentMode === 'blueprint') {
        const imgSrc = fp.image_url || fp.image_b64;
        const analysis = fp.analysis || {};
        const floorWorkers = siteData ? siteData.workers.filter(w => w.floor === floorName) : [];
        const displayImg = fp.annotated_b64 || imgSrc;

        const zonesList = (analysis.layout_zones && analysis.layout_zones.length > 0) ? analysis.layout_zones : [
            { zone_key: "Zone A", risk_rating: "SAFE", name: `${floorName} — Zone A (Core & Entry)`, detected_features: "Protected shear core and exit routes." },
            { zone_key: "Zone B", risk_rating: "SAFE", name: `${floorName} — Zone B (Structural Bay)`, detected_features: "Clear floor column bay." },
            { zone_key: "Zone C", risk_rating: "WARNING", name: `${floorName} — Zone C (Material Corridor)`, detected_features: "Staging and vehicle transit path." },
            { zone_key: "Zone D", risk_rating: "HAZARDOUS", name: `${floorName} — Zone D (Perimeter Edge)`, detected_features: "Unprotected slab edge and crane zone." }
        ];

        mapSurface.innerHTML = `
            <div style="position:relative; width:100%; height:100%; min-height:460px; border-radius:4px; overflow:hidden; background:#111; border:1px solid var(--border-color);">
                <img src="${displayImg}" style="width:100%; height:100%; max-height:520px; object-fit:contain;" alt="Annotated Floor Plan">
                
                <div style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.8); padding:6px 12px; border-radius:3px; color:#e0e0e0; font-size:11px; font-weight:600; border:1px solid #333;">
                    BLUEPRINT ANALYSIS | ${floorName} | ${analysis.dimensions_estimate || 'Site Layout'}
                </div>

                <div style="position:absolute; bottom:10px; left:10px; right:10px; display:flex; gap:6px; flex-wrap:wrap; background:rgba(0,0,0,0.85); padding:8px; border-radius:4px; max-height:140px; overflow-y:auto;">
                    ${zonesList.map(z => {
                        const zKey = z.zone_key || z.name;
                        const zWorkers = floorWorkers.filter(w => w.zone === zKey || (zKey && w.zone && zKey.includes(w.zone)));
                        const isDanger = z.risk_rating === 'HAZARDOUS' || z.risk_rating === 'HIGH RISK';
                        const isWarn = z.risk_rating === 'WARNING';
                        const badgeColor = isDanger ? 'var(--status-high)' : (isWarn ? 'var(--status-warning)' : 'var(--status-safe)');

                        return `
                            <div style="flex:1; min-width:130px; background:rgba(26,26,26,0.95); padding:6px 8px; border-radius:3px; border:1px solid #333; cursor:pointer;" onclick="inspectZone('${floorName}', '${zKey}')">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <strong style="font-size:11px; color:var(--text-heading);">${zKey}</strong>
                                    <span style="font-size:9px; font-weight:700; color:${badgeColor};">${z.risk_rating}</span>
                                </div>
                                <div style="font-size:10px; color:#888;">${zWorkers.length} Workers</div>
                                <div style="display:flex; gap:2px; flex-wrap:wrap; margin-top:2px;">
                                    ${zWorkers.map(w => `
                                        <span class="worker-pin ${w.risk === 'HIGH' ? 'risk-high' : ''}" style="font-size:8px; padding:0 3px;" onclick="event.stopPropagation(); openWorkerModal('${w.id}')">
                                            ${w.id}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        if (analysisCard) {
            analysisCard.style.display = "block";
            const analysisBody = document.getElementById("blueprint-analysis-body");
            if (analysisBody) {
                const safeCount = analysis.safe_areas_count || zonesList.filter(z => z.risk_rating === 'SAFE').length;
                const warnCount = analysis.warning_areas_count || zonesList.filter(z => z.risk_rating === 'WARNING').length;
                const hazCount = analysis.hazardous_areas_count || zonesList.filter(z => z.risk_rating === 'HAZARDOUS' || z.risk_rating === 'HIGH RISK').length;

                analysisBody.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px; color:var(--text-muted);">
                        <span>Area: <strong style="color:var(--text-heading);">${analysis.dimensions_estimate || '48m x 35m (1,680 m²)'}</strong></span>
                        <span>Detected Areas: <strong style="color:var(--text-heading);">${zonesList.length}</strong></span>
                    </div>

                    <div style="display:flex; gap:4px; margin-bottom:10px; flex-wrap:wrap;">
                        <span class="badge ${currentBlueprintFilter === 'ALL' ? 'badge-primary' : 'badge-count'}" style="cursor:pointer;" onclick="setBlueprintFilter('ALL')">All: ${zonesList.length}</span>
                        <span class="badge ${currentBlueprintFilter === 'SAFE' ? 'badge-risk-safe' : 'badge-count'}" style="cursor:pointer;" onclick="setBlueprintFilter('SAFE')">Safe: ${safeCount}</span>
                        <span class="badge ${currentBlueprintFilter === 'WARNING' ? 'badge-warning' : 'badge-count'}" style="cursor:pointer;" onclick="setBlueprintFilter('WARNING')">Caution: ${warnCount}</span>
                        <span class="badge ${currentBlueprintFilter === 'HAZARDOUS' ? 'badge-risk-high' : 'badge-count'}" style="cursor:pointer;" onclick="setBlueprintFilter('HAZARDOUS')">Hazardous: ${hazCount}</span>
                    </div>

                    <div class="floor-plan-analysis-results" style="max-height:280px; overflow-y:auto;">
                        ${zonesList.filter(z => {
                            if (!currentBlueprintFilter || currentBlueprintFilter === 'ALL') return true;
                            if (currentBlueprintFilter === 'SAFE') return z.risk_rating === 'SAFE';
                            if (currentBlueprintFilter === 'WARNING') return z.risk_rating === 'WARNING';
                            if (currentBlueprintFilter === 'HAZARDOUS') return z.risk_rating === 'HAZARDOUS' || z.risk_rating === 'HIGH RISK' || z.risk_rating === 'CRITICAL';
                            return true;
                        }).map(z => {
                            let dotClass = 'safe';
                            if (z.risk_rating === 'HAZARDOUS' || z.risk_rating === 'HIGH RISK' || z.risk_rating === 'CRITICAL') dotClass = 'high';
                            else if (z.risk_rating === 'WARNING') dotClass = 'warning';

                            return `
                                <div class="zone-analysis-item" style="border:1px solid var(--border-color); padding:6px 8px; margin-bottom:6px; border-radius:3px;">
                                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                                        <div class="zone-dot ${dotClass}"></div>
                                        <strong style="font-size:11px;">${z.name}</strong>
                                    </div>
                                    <div style="font-size:10px; color:var(--text-muted); margin-bottom:3px;">${z.detected_features}</div>
                                    ${z.primary_hazard ? `<div style="font-size:10px; color:var(--status-high);">Hazard: ${z.primary_hazard}</div>` : ''}
                                    <div style="font-size:10px; color:var(--text-dim);">
                                        PPE: ${(z.recommended_ppe || ['Hardhat', 'Boots']).join(', ')}
                                    </div>
                                    ${z.safety_rules ? `<div style="font-size:9px; color:var(--text-muted); margin-top:2px;">${z.safety_rules}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <hr class="divider" style="margin:8px 0;">
                    <p style="font-weight:600; font-size:11px; margin-bottom:4px;">Safety Recommendations:</p>
                    <ul style="padding-left:14px; font-size:10px; color:var(--text-muted);">
                        ${(analysis.ai_safety_recommendations || []).map(r => `<li style="margin-bottom:2px;">${r}</li>`).join('')}
                    </ul>
                `;
            }
        }
        return;
    }

    // Default matrix view
    if (analysisCard && !hasActiveBlueprint) {
        analysisCard.style.display = "none";
    }

    const config = floorZoneConfigs[floorName] || floorZoneConfigs["Floor 2"];
    const floorWorkers = siteData ? siteData.workers.filter(w => w.floor === floorName) : [];
    const zoneKeys = ["Zone A", "Zone B", "Zone C", "Zone D"];

    mapSurface.innerHTML = `
        <div class="map-grid-matrix">
            ${zoneKeys.map(zKey => {
                const zConf = config.zones[zKey] || { label: zKey, risk: "SAFE", desc: "" };
                const workersInZone = floorWorkers.filter(w => w.zone === zKey);
                
                let riskClass = "safe";
                let badgeClass = "badge-risk-safe";
                let riskLabel = "SAFE";
                
                if (zConf.risk === "HIGH" || workersInZone.some(w => w.risk === "HIGH")) {
                    riskClass = "high";
                    badgeClass = "badge-risk-high";
                    riskLabel = "HIGH";
                } else if (zConf.risk === "WARNING" || workersInZone.some(w => w.risk === "WARNING")) {
                    riskClass = "warning";
                    badgeClass = "badge-count";
                    riskLabel = "WARNING";
                }
                
                return `
                    <div class="map-zone-box ${riskClass}" onclick="inspectZone('${floorName}', '${zKey}')">
                        <div class="zone-header-tag">
                            <span>${zKey} — ${zConf.label}</span>
                            <span class="badge ${badgeClass}">${riskLabel}</span>
                        </div>
                        <p class="help-text mt-2">${zConf.desc}</p>
                        <div class="worker-pins-area">
                            ${workersInZone.map(w => `
                                <span class="worker-pin ${w.risk === 'HIGH' ? 'risk-high' : ''}" 
                                      onclick="event.stopPropagation(); openWorkerModal('${w.id}')"
                                      title="${w.name} (${w.role}) - ${w.risk}">
                                    ${w.id} ${w.ppe.helmet === 'MISSING' ? '(NO HELMET)' : ''}
                                </span>
                            `).join('')}
                            ${workersInZone.length === 0 ? '<span style="font-size:10px; opacity:0.5;">No workers</span>' : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    inspectZone(floorName, 'Zone D');
}

function inspectZone(floor, zone) {
    if (!siteData) return;
    const drawer = document.getElementById("zone-details-drawer");
    if (!drawer) return;

    const floorWorkers = siteData.workers.filter(w => w.floor === floor && w.zone === zone);
    const floorHazards = siteData.hazards.filter(h => h.floor === floor && h.zone === zone);
    const cam = siteData.cameras.find(c => c.floor === floor && c.zone === zone) || siteData.cameras[0];

    drawer.innerHTML = `
        <h4><i class="fa-solid fa-vector-square"></i> ${floor} — ${zone}</h4>
        <div class="alert-item-card ${floorHazards.some(h => h.risk === 'HIGH') ? 'high' : 'warning'} mt-2">
            <p><strong>Camera:</strong> ${cam.name} (${cam.status})</p>
            <p><strong>Workers:</strong> ${floorWorkers.length}</p>
            <div style="margin:4px 0;">
                <strong>Roster:</strong>
                <ul style="padding-left:16px; font-size:11px; margin-top:4px;">
                    ${floorWorkers.map(w => `
                        <li><strong>${w.name}</strong> (${w.role}) — <span class="${w.risk === 'HIGH' ? 'text-red' : 'text-green'}">${w.risk}</span></li>
                    `).join('')}
                </ul>
            </div>
            <p><strong>Hazards:</strong> ${floorHazards.length > 0 ? `<span class="text-red">${floorHazards.map(h => h.issue).join(', ')}</span>` : 'None'}</p>
        </div>
    `;
}

function handleBlueprintUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const mapSurface = document.getElementById("interactive-map-surface");
    if (mapSurface) {
        mapSurface.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:420px; background:#12151c; border-radius:6px; border:1px solid #2a3447; color:#e2e8f0;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size:36px; color:var(--primary-color); margin-bottom:14px;"></i>
                <h4 style="font-size:15px; font-weight:600; margin-bottom:6px;">Analyzing Floor Plan Blueprint...</h4>
                <p style="font-size:12px; color:#8899aa; max-width:340px; text-align:center;">
                    Running OpenCV contour extraction, wall morphology kernels, and geometrical hazard classification.
                </p>
            </div>
        `;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("floor_name", currentMapFloor);

    fetch('/api/analyze-floor-plan', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        // Reset file input so user can re-upload or select same/different files
        event.target.value = '';

        if (data.success && data.analysis) {
            const fpData = {
                floor: currentMapFloor,
                image_url: data.image_url || data.image_b64,
                image_b64: data.image_b64,
                annotated_b64: data.annotated_b64 || null,
                analysis: data.analysis,
                is_active: true
            };
            uploadedFloorPlans[currentMapFloor] = fpData;
            if (siteData) {
                if (!siteData.floor_plans) siteData.floor_plans = {};
                siteData.floor_plans[currentMapFloor] = fpData;
            }
            floorPlanViewModes[currentMapFloor] = 'blueprint';
            renderSiteMap(currentMapFloor);

            showRoleToast("CV Blueprint Analysis", `Segmented ${data.analysis.total_areas_detected || 0} architectural compartments on ${currentMapFloor}!`);
        } else if (data.error) {
            alert("Floor Plan Error: " + data.error);
            renderSiteMap(currentMapFloor);
        }
    })
    .catch(err => {
        console.error("Blueprint upload failed:", err);
        event.target.value = '';
        renderSiteMap(currentMapFloor);
    });
}

let currentBlueprintFilter = 'ALL';

function setBlueprintFilter(filterType) {
    currentBlueprintFilter = (currentBlueprintFilter === filterType) ? 'ALL' : filterType;
    renderSiteMap(currentMapFloor);
}

function toggleFloorPlanView() {
    const currentMode = floorPlanViewModes[currentMapFloor] || 'blueprint';
    floorPlanViewModes[currentMapFloor] = currentMode === 'blueprint' ? 'matrix' : 'blueprint';
    renderSiteMap(currentMapFloor);
}

function resetFloorPlan() {
    fetch('/api/reset-floor-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floor_name: currentMapFloor })
    })
    .then(r => r.json())
    .then(data => {
        if (siteData && siteData.floor_plans && siteData.floor_plans[currentMapFloor]) {
            siteData.floor_plans[currentMapFloor].is_active = false;
        }
        if (uploadedFloorPlans[currentMapFloor]) {
            uploadedFloorPlans[currentMapFloor].is_active = false;
        }
        floorPlanViewModes[currentMapFloor] = 'matrix';
        renderSiteMap(currentMapFloor);
    })
    .catch(err => console.error("Reset floor plan failed:", err));
}

function renderBlueprintOverlay(imageB64, analysis) {
    if (siteData) {
        if (!siteData.floor_plans) siteData.floor_plans = {};
        siteData.floor_plans[currentMapFloor] = {
            floor: currentMapFloor,
            image_url: imageB64,
            image_b64: imageB64,
            analysis: analysis,
            is_active: true
        };
    }
    floorPlanViewModes[currentMapFloor] = 'blueprint';
    renderSiteMap(currentMapFloor);
}

/* ==================== 4. WORKER SAFETY PROFILES VIEW ==================== */
function renderWorkersRoster() {
    if (!siteData) return;
    const body = document.getElementById("workers-table-body");

    body.innerHTML = siteData.workers.map(w => `
        <tr>
            <td><strong>${w.id}</strong></td>
            <td>${w.name}</td>
            <td>${w.role}</td>
            <td>${w.location}</td>
            <td>
                <span class="ppe-pill ${w.ppe.helmet === 'OK' ? 'ok' : 'missing'}">Helmet: ${w.ppe.helmet}</span>
                <span class="ppe-pill ${w.ppe.vest === 'OK' ? 'ok' : 'missing'}">Vest: ${w.ppe.vest}</span>
            </td>
            <td><span class="badge ${w.risk === 'HIGH' ? 'badge-risk-high' : 'badge-risk-safe'}">${w.risk}</span></td>
            <td><strong>${w.active_violations}</strong></td>
            <td>${w.recent_violations} recorded</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="openWorkerModal('${w.id}')">View</button>
            </td>
        </tr>
    `).join('');
}

function filterWorkerTable() {
    const query = document.getElementById("worker-search-input").value.toLowerCase();
    const rows = document.querySelectorAll("#workers-table-body tr");
    rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(query) ? '' : 'none';
    });
}

function openWorkerModal(workerId) {
    if (!siteData) return;
    const worker = siteData.workers.find(w => w.id === workerId) || siteData.workers[0];

    document.getElementById("modal-worker-name").innerText = `${worker.name} (${worker.id})`;
    document.getElementById("modal-worker-content").innerHTML = `
        <div class="alert-item-card ${worker.risk === 'HIGH' ? 'high' : 'warning'}">
            <p><strong>Location:</strong> ${worker.location}</p>
            <p><strong>Status:</strong> <span class="badge ${worker.risk === 'HIGH' ? 'badge-risk-high' : 'badge-risk-safe'}">${worker.status} (${worker.risk})</span></p>
            <hr class="divider">
            <p><strong>PPE Checklist:</strong></p>
            <ul>
                <li>Helmet: ${worker.ppe.helmet === 'OK' ? 'Verified' : 'MISSING'}</li>
                <li>Vest: ${worker.ppe.vest === 'OK' ? 'Verified' : 'MISSING'}</li>
                <li>Boots: Verified</li>
                <li>Mask: Verified</li>
            </ul>
            <hr class="divider">
            <p><strong>Active Violations:</strong> ${worker.active_violations}</p>
            <p><strong>Recent Violations:</strong> ${worker.recent_violations}</p>
            <p><strong>Last Detected:</strong> ${worker.last_detected}</p>
        </div>
    `;

    document.getElementById("worker-modal").style.display = "flex";
}

function closeWorkerModal() {
    document.getElementById("worker-modal").style.display = "none";
}

/* ==================== 5. HAZARD & ALERTS LOG ==================== */
function renderHazardsTable() {
    if (!siteData) return;
    const body = document.getElementById("hazards-table-body");
    if (!body) return;

    body.innerHTML = siteData.hazards.map(h => `
        <tr>
            <td><strong>${h.id}</strong></td>
            <td>${h.worker_name} (${h.worker_id})</td>
            <td><strong>${h.issue}</strong></td>
            <td style="font-size:11px; color:var(--text-muted);">${h.rule}</td>
            <td>${h.location}<br><span style="font-size:10px; color:var(--text-dim);">${h.camera || 'Live Feed'}</span></td>
            <td><span class="badge ${h.risk === 'HIGH' || h.risk === 'CRITICAL' ? 'badge-risk-high' : 'badge-count'}">${h.risk}</span></td>
            <td>${h.time}</td>
            <td>
                <span class="badge ${h.status === 'Active' ? 'badge-live' : (h.status === 'Resolved' ? 'badge-risk-safe' : 'badge-info')}">${h.status}</span>
            </td>
            <td>
                ${h.status !== 'Resolved' ? `
                    <button class="btn btn-sm btn-outline" onclick="openHazardModal('${h.id}')">Manage</button>
                ` : `<span style="font-size:11px; color:var(--status-safe);">Resolved by ${h.resolved_by || 'Officer'}</span>`}
            </td>
        </tr>
    `).join('');

    filterHazardsTable();
}

function filterHazardsTable() {
    const statusF = document.getElementById("hazard-status-filter").value;
    const riskF = document.getElementById("hazard-risk-filter").value;

    const rows = document.querySelectorAll("#hazards-table-body tr");
    rows.forEach(row => {
        const text = row.innerText;
        let show = true;
        if (statusF !== 'ALL' && !text.includes(statusF)) show = false;
        if (riskF !== 'ALL' && riskF === 'HIGH' && !text.includes('HIGH')) show = false;
        row.style.display = show ? '' : 'none';
    });
}

function openHazardModal(hazardId) {
    if (!siteData) return;
    activeHazardForAction = siteData.hazards.find(h => h.id === hazardId);
    if (!activeHazardForAction) return;

    document.getElementById("hazard-modal-title").innerText = `Manage — ${activeHazardForAction.id}`;
    document.getElementById("hazard-modal-det").innerHTML = `
        <div class="alert-item-card high">
            <p><strong>Worker:</strong> ${activeHazardForAction.worker_name} (${activeHazardForAction.worker_id})</p>
            <p><strong>Issue:</strong> ${activeHazardForAction.issue}</p>
            <p><strong>Location:</strong> ${activeHazardForAction.location}</p>
            <p><strong>Risk:</strong> ${activeHazardForAction.risk}</p>
            <p><strong>Rule:</strong> ${activeHazardForAction.rule}</p>
        </div>
    `;

    document.getElementById("hazard-action-modal").style.display = "flex";
}

function closeHazardModal() {
    document.getElementById("hazard-action-modal").style.display = "none";
}

function submitHazardAction(newStatus) {
    if (!activeHazardForAction) return;
    const notes = document.getElementById("hazard-notes-input").value;

    fetch(`/api/hazards/${activeHazardForAction.id}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes: notes })
    })
    .then(r => r.json())
    .then(data => {
        closeHazardModal();
        fetchSiteState();
    });
}

/* ==================== 6. CONSTRUCTION ACTIVITY ==================== */
function renderConstructionProgress() {
    if (!siteData) return;
    const container = document.getElementById("floors-matrix-container");
    const activities = siteData.construction_activities;

    document.getElementById("activity-overall-pct").innerText = `${activities.overall_progress}%`;

    container.innerHTML = activities.floors.map(f => `
        <div class="floor-matrix-card">
            <div class="floor-matrix-header">
                <h4><i class="fa-solid fa-layer-group"></i> ${f.floor}</h4>
                <span>Completion: <strong>${f.progress}%</strong></span>
            </div>
            <div class="activity-grid-4">
                ${Object.entries(f.activities).map(([actName, actObj]) => `
                    <div class="act-box">
                        <strong>${actName}</strong>
                        <div class="progress-bar-bg mb-2 mt-1">
                            <div class="progress-bar-fill" style="width: ${actObj.pct}%;"></div>
                        </div>
                        <span class="act-status-tag ${actObj.code.toLowerCase().replace('_', '-')}">${actObj.status} (${actObj.pct}%)</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // AI Observations
    const obsContainer = document.getElementById("ai-observations-list");
    obsContainer.innerHTML = activities.ai_observations.map(obs => `
        <div class="obs-card ${obs.status.toLowerCase()}">
            <div style="display:flex; justify-content:space-between; font-weight:600; font-size:12px;">
                <span>AI Observation (${obs.confidence}% conf)</span>
                <span class="badge ${obs.status === 'Confirmed' ? 'badge-risk-safe' : 'badge-count'}">${obs.status}</span>
            </div>
            <p class="mt-1" style="font-size:12px; color:var(--text-heading);">"${obs.observation}"</p>
            <p class="help-text">${obs.floor} — ${obs.zone} | ${obs.timestamp}</p>
            ${obs.status === 'Pending' ? `
                <div style="display:flex; gap:6px; margin-top:6px;">
                    <button class="btn btn-sm btn-success" onclick="actionObservation('${obs.id}', 'confirm')">Confirm</button>
                    <button class="btn btn-sm btn-outline" onclick="actionObservation('${obs.id}', 'reject')">Reject</button>
                </div>
            ` : `<p style="font-size:10px; color:var(--status-safe);">${obs.confirmed_by || 'Verified'}</p>`}
        </div>
    `).join('');
}

function actionObservation(obsId, action) {
    fetch(`/api/observations/${obsId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, user: `Supervisor (${currentRole})` })
    })
    .then(r => r.json())
    .then(data => {
        fetchSiteState();
    });
}

/* ==================== 7. ANALYTICS VIEW ==================== */
function renderAnalyticsCharts() {
    document.getElementById("chart-ppe-compliance").innerHTML = `
        <div class="alert-item-card safe">
            <h4>Overall PPE Compliance</h4>
            <h2 class="text-green" style="font-size:32px; margin:8px 0;">91.4%</h2>
            <p>Helmet: 89% | Vest: 94%</p>
        </div>
    `;
    document.getElementById("chart-hazards-category").innerHTML = `
        <div class="alert-item-card warning">
            <h4>Hazards by Category</h4>
            <ul style="margin-top:8px;">
                <li>Missing Helmet: 45%</li>
                <li>Missing Vest: 25%</li>
                <li>Open Edge: 20%</li>
                <li>Equipment Proximity: 10%</li>
            </ul>
        </div>
    `;
    document.getElementById("chart-hazards-zone").innerHTML = `
        <div class="alert-item-card high">
            <h4>Hazards by Floor</h4>
            <p style="margin-top:8px;">Floor 2 Zone D: <strong>3 Active (Highest)</strong></p>
            <p>Floor 1 Zone C: 1 Warning</p>
            <p>Floor 3 Zone D: 1 Restricted</p>
        </div>
    `;
    document.getElementById("chart-resolution-rate").innerHTML = `
        <div class="alert-item-card cyan">
            <h4>Resolution Rate</h4>
            <h2 style="font-size:32px; margin:8px 0; color:var(--text-heading);">87.5%</h2>
            <p>Avg Resolution: 14 min</p>
        </div>
    `;
}

/* ==================== 8. REPORTS VIEW ==================== */
function renderReports() {
    if (!siteData) return;
    const paper = document.getElementById("report-printable-area");

    paper.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
            <h1>SITEGUARD 360 — SITE REPORT</h1>
            <p style="color:#666;">${siteData.site_name} | ${new Date().toLocaleDateString()}</p>
        </div>

        <h3>1. Safety Summary</h3>
        <table class="report-table">
            <tr><th>Safety Status</th><td>${siteData.site_safety_status} (Score: ${siteData.safety_score}%)</td></tr>
            <tr><th>Workers</th><td>${siteData.active_workers_count} Active</td></tr>
            <tr><th>Hazards</th><td>${siteData.active_hazards_count} Total (${siteData.high_risk_hazards_count} High Risk)</td></tr>
            <tr><th>Progress</th><td>${siteData.project_activity_progress}% Complete</td></tr>
        </table>

        <h3 style="margin-top:16px;">2. Hazards</h3>
        <table class="report-table">
            <thead>
                <tr><th>ID</th><th>Worker</th><th>Issue</th><th>Location</th><th>Risk</th><th>Status</th></tr>
            </thead>
            <tbody>
                ${siteData.hazards.map(h => `
                    <tr>
                        <td>${h.id}</td>
                        <td>${h.worker_name}</td>
                        <td>${h.issue}</td>
                        <td>${h.location}</td>
                        <td>${h.risk}</td>
                        <td>${h.status}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h3 style="margin-top:16px;">3. Activity Progress</h3>
        <table class="report-table">
            <thead>
                <tr><th>Floor</th><th>Columns</th><th>Beams</th><th>Masonry</th><th>Slab</th></tr>
            </thead>
            <tbody>
                ${siteData.construction_activities.floors.map(f => `
                    <tr>
                        <td>${f.floor} (${f.progress}%)</td>
                        <td>${f.activities.Columns.status} (${f.activities.Columns.pct}%)</td>
                        <td>${f.activities.Beams.status} (${f.activities.Beams.pct}%)</td>
                        <td>${f.activities.Masonry.status} (${f.activities.Masonry.pct}%)</td>
                        <td>${f.activities.Slab.status} (${f.activities.Slab.pct}%)</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function downloadJSONReport() {
    fetch('/api/report/export')
    .then(r => r.json())
    .then(data => {
        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", jsonStr);
        dlAnchorElem.setAttribute("download", "SiteGuard360_Report.json");
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        dlAnchorElem.remove();
    });
}

/* ==================== 9. DEMO TOUR ==================== */
const demoStorySteps = [
    {
        step: 1,
        title: "Step 1: Dashboard",
        text: "Overview of site safety: WARNING status, 32 workers, 3 hazards, 67% progress.",
        action: () => switchTab('tab-dashboard')
    },
    {
        step: 2,
        title: "Step 2: Live Camera",
        text: "Camera 01 covers Floor 2 Zone D. YOLO detection runs in real-time.",
        action: () => {
            switchTab('tab-live-monitoring');
            selectCamera('CAM-01');
        }
    },
    {
        step: 3,
        title: "Step 3: Worker Detection",
        text: "AI identifies Worker 08. Helmet: Missing, Vest: Present.",
        action: () => {
            switchTab('tab-live-monitoring');
            openWorkerModal('W08');
        }
    },
    {
        step: 4,
        title: "Step 4: Hazard Alert",
        text: "OSHA 1926.100 triggered. HIGH-RISK alert for Worker 08 at Floor 2 Zone D.",
        action: () => {
            closeWorkerModal();
            switchTab('tab-hazards');
        }
    },
    {
        step: 5,
        title: "Step 5: Site Map",
        text: "Floor 2 Zone D highlighted as HIGH RISK with Worker 08 pin.",
        action: () => {
            switchTab('tab-site-map');
            renderSiteMap('Floor 2');
            inspectZone('Floor 2', 'Zone D');
        }
    },
    {
        step: 6,
        title: "Step 6: Activity Tracking",
        text: "Floor progress: Columns 100%, Beams 80%, Masonry 40%, Slab 0%.",
        action: () => switchTab('tab-construction-progress')
    },
    {
        step: 7,
        title: "Step 7: Report",
        text: "Full intelligence report: Site -> AI -> Worker -> Hazard -> Risk -> Alert -> Report.",
        action: () => switchTab('tab-reports')
    }
];

function startDemoStoryTour() {
    demoStep = 0;
    document.getElementById("demo-tour-banner").style.display = "block";
    showDemoStep(demoStep);
}

function stopDemoStoryTour() {
    document.getElementById("demo-tour-banner").style.display = "none";
}

function showDemoStep(index) {
    if (index < 0 || index >= demoStorySteps.length) return;
    const current = demoStorySteps[index];

    document.getElementById("tour-step-counter").innerText = `Step ${current.step} of ${demoStorySteps.length}`;
    document.getElementById("tour-step-title").innerText = current.title;
    document.getElementById("tour-step-text").innerText = current.text;

    current.action();
}

function nextDemoStep() {
    if (demoStep < demoStorySteps.length - 1) {
        demoStep++;
        showDemoStep(demoStep);
    } else {
        stopDemoStoryTour();
    }
}

function prevDemoStep() {
    if (demoStep > 0) {
        demoStep--;
        showDemoStep(demoStep);
    }
}

/* ==========================================================================
   WORKER GPS SAFETY & EXPOSURE TRACKING RADAR
   ========================================================================== */

let gpsDataCache = null;

async function fetchGPSWorkers() {
    try {
        const res = await fetch('/api/gps/workers');
        if (!res.ok) return;
        gpsDataCache = await res.json();
        
        updateLiveExposedWorkerBanner();
        if (getActiveTabId() === 'tab-gps-radar') {
            renderGPSRadarView();
        }
    } catch (err) {
        console.error("Error fetching GPS data:", err);
    }
}

function updateLiveExposedWorkerBanner() {
    const banner = document.getElementById('live-exposed-worker-banner');
    if (!banner || !gpsDataCache) return;

    const openExposures = gpsDataCache.open_exposures || [];
    
    if (openExposures.length > 0) {
        const topExp = openExposures[0];
        document.getElementById('b-worker-name').innerText = `${topExp.worker_id} (${topExp.worker_name})`;
        document.getElementById('b-hazard-name').innerText = topExp.hazard_type;
        document.getElementById('b-floor').innerText = topExp.floor;
        document.getElementById('b-zone').innerText = topExp.zone;
        document.getElementById('b-distance').innerText = `${topExp.distance_m.toFixed(1)} m`;
        document.getElementById('b-exposure-duration').innerText = `${topExp.exposure_duration}s`;
        banner.style.display = "flex";
    } else {
        banner.style.display = "none";
    }
}

function renderGPSRadarView() {
    if (!gpsDataCache) return;

    const workers = gpsDataCache.gps_workers || [];
    const openExposures = gpsDataCache.open_exposures || [];
    const events = gpsDataCache.exposure_events || [];
    const hazards = gpsDataCache.hazards || [];

    const expCountEl = document.getElementById('gps-kpi-exposed-count');
    const actDevEl = document.getElementById('gps-kpi-active-devices');
    const hazCountEl = document.getElementById('gps-kpi-hazards-count');
    const evCountEl = document.getElementById('gps-kpi-events-count');
    const actBadgeEl = document.getElementById('exposure-active-badge');

    if (expCountEl) expCountEl.innerText = openExposures.length;
    if (actDevEl) actDevEl.innerText = workers.length;
    if (hazCountEl) hazCountEl.innerText = hazards.length;
    if (evCountEl) evCountEl.innerText = events.length;
    if (actBadgeEl) actBadgeEl.innerText = `${openExposures.length} Active`;

    const container = document.getElementById('gps-workers-container');
    if (container) {
        if (workers.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:24px; color:var(--text-muted);">No GPS devices connected. Open Worker Mobile GPS page.</div>`;
        } else {
            container.innerHTML = workers.map(w => {
                let cardClass = "gps-worker-card safe";
                let badgeClass = "badge-success";
                let badgeLabel = "SAFE";

                if (w.safety_status === 'CRITICAL') {
                    cardClass = "gps-worker-card critical";
                    badgeClass = "badge-danger";
                    badgeLabel = "CRITICAL";
                } else if (w.safety_status === 'WARNING') {
                    cardClass = "gps-worker-card warning";
                    badgeClass = "badge-warning";
                    badgeLabel = "WARNING";
                }

                return `
                    <div class="${cardClass}">
                        <div>
                            <div class="gps-card-header">
                                <div>
                                    <div class="gps-worker-name"><i class="fa-solid fa-mobile-screen-button" style="color:#888;"></i> ${w.worker_id}</div>
                                    <div class="gps-worker-role">${w.name}</div>
                                </div>
                                <span class="badge ${badgeClass}">${badgeLabel}</span>
                            </div>

                            <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:4px;">
                                <i class="fa-solid fa-building"></i> <strong>${w.floor} — ${w.zone}</strong>
                            </div>

                            <div class="gps-distance-box">
                                <div style="font-size:0.72rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Dist to Hazard</div>
                                <div class="gps-dist-val" style="color:${w.safety_status === 'CRITICAL' ? 'var(--status-high)' : (w.safety_status === 'WARNING' ? 'var(--status-warning)' : 'var(--status-safe)')};">
                                    ${w.distance_m.toFixed(1)} <span style="font-size:0.85rem; color:var(--text-muted);">m</span>
                                </div>
                                <div style="font-size:0.78rem; font-weight:600; color:var(--text-heading); margin-top:2px;">
                                    ${w.nearest_hazard}
                                </div>
                            </div>
                        </div>

                        <div style="font-size:0.72rem; color:var(--text-muted); display:flex; justify-content:space-between; margin-top:6px; border-top:1px solid var(--border-color); padding-top:6px;">
                            <span><i class="fa-solid fa-battery-three-quarters"></i> ${w.battery || '88%'}</span>
                            <span><i class="fa-solid fa-location-crosshairs"></i> ±${w.accuracy}m</span>
                            <span><i class="fa-solid fa-clock"></i> ${w.last_updated}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    const tbody = document.getElementById('exposure-events-tbody');
    if (tbody) {
        if (events.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-muted);">No exposure events.</td></tr>`;
        } else {
            tbody.innerHTML = events.map(ev => {
                const isOpen = ev.status === 'OPEN';
                const statusBadge = isOpen ? '<span class="badge badge-danger">OPEN</span>' : '<span class="badge badge-success">CLOSED</span>';
                const durDisplay = isOpen ? `<span class="exposure-timer-badge">${ev.exposure_duration}s</span>` : `<span>${ev.exposure_duration}s</span>`;

                return `
                    <tr style="${isOpen ? 'background: rgba(185,28,28,0.04);' : ''}">
                        <td><strong>${ev.id}</strong></td>
                        <td><strong>${ev.worker_id}</strong> <br><small style="color:var(--text-muted);">${ev.worker_name}</small></td>
                        <td><span style="font-weight:600;">${ev.hazard_type}</span></td>
                        <td>${ev.floor} — ${ev.zone}</td>
                        <td><span class="badge badge-danger">${ev.risk}</span></td>
                        <td>${ev.entry_time}</td>
                        <td>${ev.exit_time || '<em style="color:var(--status-high);">Ongoing</em>'}</td>
                        <td><strong>${ev.distance_m ? ev.distance_m.toFixed(1) + ' m' : '—'}</strong></td>
                        <td>${durDisplay}</td>
                        <td>${statusBadge}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// Simulator Handlers
function onDashSimSliderChange(val) {
    const textEl = document.getElementById('dash-sim-dist-text');
    if (textEl) textEl.innerText = parseFloat(val).toFixed(1) + " m";
}

async function triggerDashSimPreset(distM) {
    const selectEl = document.getElementById('sim-worker-select');
    const workerId = selectEl ? selectEl.value : "W024";
    const sliderEl = document.getElementById('dash-sim-slider');
    if (sliderEl) sliderEl.value = distM;
    onDashSimSliderChange(distM);

    try {
        const res = await fetch('/api/gps/simulate-move', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                worker_id: workerId,
                distance_m: distM,
                floor: 'Floor 2',
                zone: 'Zone B'
            })
        });

        if (res.ok) {
            fetchGPSWorkers();
        }
    } catch(e) {
        console.error("Error sending sim update:", e);
    }
}

/* ==========================================================================
   DYNAMIC 360° TACTICAL RADAR CANVAS & AUTONOMOUS PATROL ENGINE
   ========================================================================== */
let radarSweepAngle = 0;
let radarAnimFrame = null;
let isRadarSweepActive = true;
let dashAutoPatrolInterval = null;
let isDashAutoPatrolActive = false;

// Multi-worker patrol state
let dashWorkersPatrol = {
    "W024": { dist: 28.0, step: -1.3, phase: "approach", angle: 0.8 },
    "W008": { dist: 14.5, step: -0.9, phase: "approach", angle: 2.4 },
    "W012": { dist: 35.0, step: 0.8, phase: "retreat", angle: 4.1 }
};

function toggleRadarSweep() {
    isRadarSweepActive = !isRadarSweepActive;
    if (isRadarSweepActive && !radarAnimFrame) {
        requestAnimationFrame(animateRadarSweep);
    }
}

function startRadarCanvas() {
    if (!radarAnimFrame) {
        requestAnimationFrame(animateRadarSweep);
    }
}

function animateRadarSweep() {
    if (getActiveTabId() === 'tab-gps-radar') {
        radarSweepAngle += 0.025;
        if (radarSweepAngle >= Math.PI * 2) radarSweepAngle = 0;
        drawRadarHUD();
    }
    radarAnimFrame = requestAnimationFrame(animateRadarSweep);
}

function drawRadarHUD() {
    const canvas = document.getElementById('hud-radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(cx, cy) - 20;

    // Scale: 40 meters = maxRadius
    const metersToPx = (m) => (m / 40.0) * maxRadius;

    ctx.clearRect(0, 0, width, height);

    // 1. Azimuth crosshairs & concentric circles
    ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
    ctx.lineWidth = 1;

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - maxRadius, cy);
    ctx.lineTo(cx + maxRadius, cy);
    ctx.moveTo(cx, cy - maxRadius);
    ctx.lineTo(cx, cy + maxRadius);
    ctx.stroke();

    // Safe zone outer circle (40m)
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(34, 197, 94, 0.25)";
    ctx.stroke();

    // Warning zone circle (25m)
    const r25 = metersToPx(25.0);
    ctx.beginPath();
    ctx.arc(cx, cy, r25, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Danger zone circle (<10m)
    const r10 = metersToPx(10.0);
    ctx.beginPath();
    ctx.arc(cx, cy, r10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;

    // Range Labels
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("10m DANGER", cx, cy - r10 + 12);
    ctx.fillText("25m WARNING", cx, cy - r25 + 12);
    ctx.fillText("40m SAFE PERIMETER", cx, cy - maxRadius + 12);

    // Center Hazard Point (HAZ-001)
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    ctx.fillStyle = "#fca5a5";
    ctx.font = "bold 10px Outfit, sans-serif";
    ctx.fillText("VASAVI BLOCK A — FALL HAZARD", cx, cy + 18);

    // 2. Rotating Radar Sweep Beam
    if (isRadarSweepActive) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, radarSweepAngle - 0.35, radarSweepAngle);
        ctx.closePath();

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
        grad.addColorStop(0, "rgba(56, 189, 248, 0.35)");
        grad.addColorStop(1, "rgba(56, 189, 248, 0.0)");
        ctx.fillStyle = grad;
        ctx.fill();

        // Lead line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(radarSweepAngle) * maxRadius, cy + Math.sin(radarSweepAngle) * maxRadius);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    // 3. Render Worker Blips
    const workers = (gpsDataCache && gpsDataCache.gps_workers) ? gpsDataCache.gps_workers : [];
    workers.forEach((w, idx) => {
        const dist = Math.min(42.0, w.distance_m || 20.0);
        const rPx = metersToPx(dist);

        // Calculate stable angular placement for each worker ID
        let angle = 0.5 + idx * 1.8;
        if (w.worker_id === "W024") angle = 1.1;
        if (w.worker_id === "W008") angle = 2.6;
        if (w.worker_id === "W012") angle = 4.3;

        const bx = cx + Math.cos(angle) * rPx;
        const by = cy + Math.sin(angle) * rPx;

        const isCritical = (w.safety_status === 'CRITICAL' || dist <= 10.0);
        const isWarning = (w.safety_status === 'WARNING' || (dist <= 25.0 && dist > 10.0));

        let dotColor = "#22c55e";
        if (isCritical) dotColor = "#ef4444";
        else if (isWarning) dotColor = "#f59e0b";

        // Connecting distance vector to center
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = isCritical ? "rgba(239, 68, 68, 0.4)" : "rgba(148, 163, 184, 0.15)";
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Shockwave ripple if critical
        if (isCritical) {
            const rippleR = 8 + (Date.now() % 1000) / 1000 * 14;
            ctx.beginPath();
            ctx.arc(bx, by, rippleR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${1 - (rippleR - 8) / 14})`;
            ctx.stroke();
        }

        // Blip Dot
        ctx.beginPath();
        ctx.arc(bx, by, isCritical ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Worker Label Tag
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${w.worker_id} (${dist.toFixed(1)}m)`, bx + 9, by + 3);
    });
}

// Autonomous Multi-Worker Patrol Simulation
function toggleDashboardAutoPatrol() {
    isDashAutoPatrolActive = !isDashAutoPatrolActive;
    const btn = document.getElementById('btn-toggle-dash-patrol');

    if (isDashAutoPatrolActive) {
        if (btn) {
            btn.className = "btn btn-sm btn-danger";
            btn.innerText = "STOP PATROL";
        }

        // Run continuous simulation step every 1.5s
        dashAutoPatrolInterval = setInterval(async () => {
            const workerKeys = Object.keys(dashWorkersPatrol);
            for (let wid of workerKeys) {
                let wp = dashWorkersPatrol[wid];
                if (wp.phase === "approach") {
                    wp.dist -= 1.3 + (Math.random() * 0.4 - 0.2);
                    if (wp.dist <= 4.5) {
                        wp.dist = 4.5;
                        wp.phase = "danger";
                    }
                } else if (wp.phase === "danger") {
                    // linger briefly then retreat
                    wp.phase = "retreat";
                } else if (wp.phase === "retreat") {
                    wp.dist += 1.8 + (Math.random() * 0.3);
                    if (wp.dist >= 33.0) {
                        wp.dist = 33.0;
                        wp.phase = "approach";
                    }
                }

                // Send live position update
                try {
                    await fetch('/api/gps/simulate-move', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            worker_id: wid,
                            distance_m: parseFloat(wp.dist.toFixed(1)),
                            floor: 'Floor 2',
                            zone: wid === 'W024' ? 'Zone B' : (wid === 'W008' ? 'Zone D' : 'Zone A')
                        })
                    });
                } catch(e){}
            }
            fetchGPSWorkers();
        }, 1500);
    } else {
        if (btn) {
            btn.className = "btn btn-sm btn-primary";
            btn.innerText = "START PATROL";
        }
        if (dashAutoPatrolInterval) clearInterval(dashAutoPatrolInterval);
    }
}

// Automatically initiate radar sweep loop
if (typeof window !== "undefined") {
    startRadarCanvas();
}


import os
import time
import cv2
import json
import base64
import math
import numpy as np
from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from safety_engine import SafetyEngine
from firebase_db import firebase_manager

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

# Ensure uploads directory exists
UPLOAD_FOLDER = os.path.join(app.static_folder, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize Safety Engine with custom YOLO model
engine = SafetyEngine("models/best.pt")

# Master Platform State
SITE_STATE = {
    "site_name": "SITEGUARD 360 — Vasavi College of Engineering (Ibrahimbagh)",
    "site_safety_status": "WARNING", # SAFE, WARNING, CRITICAL
    "safety_score": 91,
    "active_workers_count": 32,
    "active_hazards_count": 3,
    "high_risk_hazards_count": 1,
    "project_activity_progress": 67,
    "last_updated": time.strftime("%I:%M:%S %p"),
    "floor_plans": {},
    
    "cameras": [
        {
            "id": "CAM-01",
            "name": "Camera 01 — Floor 2 Zone D (Open Ledge)",
            "floor": "Floor 2",
            "zone": "Zone D",
            "status": "LIVE",
            "risk": "HIGH",
            "active_worker": "Worker 08",
            "source": "source_files/hardhat.mp4"
        },
        {
            "id": "CAM-02",
            "name": "Camera 02 — Floor 2 Zone B (Beam Assembly)",
            "floor": "Floor 2",
            "zone": "Zone B",
            "status": "LIVE",
            "risk": "SAFE",
            "active_worker": "Worker 12",
            "source": "source_files/two-young-construction-workers-wearing-555864.jpg"
        },
        {
            "id": "CAM-03",
            "name": "Camera 03 — Floor 1 Zone A (Main Entry)",
            "floor": "Floor 1",
            "zone": "Zone A",
            "status": "LIVE",
            "risk": "SAFE",
            "active_worker": "Worker 03",
            "source": "source_files/construction-safety.jpg"
        },
        {
            "id": "CAM-04",
            "name": "Camera 04 — Floor 3 Zone D (Crane Zone)",
            "floor": "Floor 3",
            "zone": "Zone D",
            "status": "LIVE",
            "risk": "WARNING",
            "active_worker": "Worker 23",
            "source": "source_files/construction-safety.jpg"
        }
    ],

    "hazards": [
        {
            "id": "HAZ-101",
            "worker_id": "W08",
            "worker_name": "Worker 08 (David R.)",
            "issue": "Missing Helmet & Open Edge Hazard",
            "rule": "OSHA 1926.100 - Head Protection Required",
            "location": "Floor 2 — Zone D",
            "floor": "Floor 2",
            "zone": "Zone D",
            "risk": "HIGH",
            "camera": "Camera 01",
            "time": "10:42 AM",
            "timestamp": time.time() - 600,
            "status": "Active" # Active, Acknowledged, Resolved
        },
        {
            "id": "HAZ-102",
            "worker_id": "W08",
            "worker_name": "Worker 08 (David R.)",
            "issue": "Unprotected Ledge Proximity",
            "rule": "Site Rule 14 - Edge Guardrail Mandatory",
            "location": "Floor 2 — Zone D",
            "floor": "Floor 2",
            "zone": "Zone D",
            "risk": "HIGH",
            "camera": "Camera 01",
            "time": "10:35 AM",
            "timestamp": time.time() - 1000,
            "status": "Active"
        },
        {
            "id": "HAZ-103",
            "worker_id": "W14",
            "worker_name": "Worker 14 (Marcus K.)",
            "issue": "Missing Safety Vest",
            "rule": "OSHA 1926.201 - High-Visibility Apparel",
            "location": "Floor 1 — Zone C",
            "floor": "Floor 1",
            "zone": "Zone C",
            "risk": "WARNING",
            "camera": "Camera 03",
            "time": "09:15 AM",
            "timestamp": time.time() - 5000,
            "status": "Active"
        },
        {
            "id": "HAZ-099",
            "worker_id": "W03",
            "worker_name": "Worker 03 (Alex P.)",
            "issue": "Equipment Clearance Violation",
            "rule": "Heavy Machinery Radius Clearance",
            "location": "Floor 1 — Zone A",
            "floor": "Floor 1",
            "zone": "Zone A",
            "risk": "MEDIUM",
            "camera": "Camera 03",
            "time": "08:20 AM",
            "timestamp": time.time() - 12000,
            "status": "Resolved",
            "resolved_by": "Safety Officer M. Vance",
            "resolve_notes": "Worker instructed to back away from loader."
        }
    ],

    # Complete 32-Worker Roster (Floor 1: 10, Floor 2: 12, Floor 3: 10)
    "workers": [
        # --- FLOOR 1 (10 Workers) ---
        {"id": "W01", "name": "Worker 01 (James H.)", "role": "Heavy Equipment Operator", "location": "Floor 1 — Zone C", "floor": "Floor 1", "zone": "Zone C", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:44 AM"},
        {"id": "W02", "name": "Worker 02 (Elena M.)", "role": "Structural Mason", "location": "Floor 1 — Zone A", "floor": "Floor 1", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 1, "last_detected": "10:41 AM"},
        {"id": "W03", "name": "Worker 03 (Alex P.)", "role": "Mason Lead", "location": "Floor 1 — Zone A", "floor": "Floor 1", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 2, "last_detected": "08:20 AM"},
        {"id": "W04", "name": "Worker 04 (Carlos G.)", "role": "Concrete Technician", "location": "Floor 1 — Zone B", "floor": "Floor 1", "zone": "Zone B", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:38 AM"},
        {"id": "W05", "name": "Worker 05 (Liam K.)", "role": "Site Electrician", "location": "Floor 1 — Zone D", "floor": "Floor 1", "zone": "Zone D", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:30 AM"},
        {"id": "W06", "name": "Worker 06 (Priya S.)", "role": "Logistics Assistant", "location": "Floor 1 — Zone C", "floor": "Floor 1", "zone": "Zone C", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:25 AM"},
        {"id": "W07", "name": "Worker 07 (Tom B.)", "role": "Pipefitter", "location": "Floor 1 — Zone D", "floor": "Floor 1", "zone": "Zone D", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 1, "last_detected": "10:15 AM"},
        {"id": "W14", "name": "Worker 14 (Marcus K.)", "role": "Carpenter", "location": "Floor 1 — Zone C", "floor": "Floor 1", "zone": "Zone C", "status": "Warning", "risk": "WARNING", "ppe": {"helmet": "OK", "vest": "MISSING", "shoes": "OK", "mask": "OK"}, "active_violations": 1, "recent_violations": 1, "last_detected": "09:15 AM"},
        {"id": "W15", "name": "Worker 15 (Daniel W.)", "role": "Scaffolder", "location": "Floor 1 — Zone B", "floor": "Floor 1", "zone": "Zone B", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:10 AM"},
        {"id": "W16", "name": "Worker 16 (Chloe N.)", "role": "Safety Inspector", "location": "Floor 1 — Zone A", "floor": "Floor 1", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:05 AM"},

        # --- FLOOR 2 (12 Workers) ---
        {"id": "W08", "name": "Worker 08 (David R.)", "role": "Steel Fixer", "location": "Floor 2 — Zone D", "floor": "Floor 2", "zone": "Zone D", "status": "At Risk", "risk": "HIGH", "ppe": {"helmet": "MISSING", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 1, "recent_violations": 3, "last_detected": "10:42 AM"},
        {"id": "W09", "name": "Worker 09 (Robert E.)", "role": "Rigging Specialist", "location": "Floor 2 — Zone D", "floor": "Floor 2", "zone": "Zone D", "status": "Warning", "risk": "WARNING", "ppe": {"helmet": "OK", "vest": "MISSING", "shoes": "OK", "mask": "OK"}, "active_violations": 1, "recent_violations": 1, "last_detected": "10:39 AM"},
        {"id": "W10", "name": "Worker 10 (Anita C.)", "role": "Rebar Installer", "location": "Floor 2 — Zone B", "floor": "Floor 2", "zone": "Zone B", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:35 AM"},
        {"id": "W11", "name": "Worker 11 (Kevin L.)", "role": "Steel Fixer", "location": "Floor 2 — Zone B", "floor": "Floor 2", "zone": "Zone B", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:33 AM"},
        {"id": "W12", "name": "Worker 12 (Sarah T.)", "role": "Site Inspector", "location": "Floor 2 — Zone B", "floor": "Floor 2", "zone": "Zone B", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:40 AM"},
        {"id": "W13", "name": "Worker 13 (Omar F.)", "role": "Concrete Pourer", "location": "Floor 2 — Zone A", "floor": "Floor 2", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:28 AM"},
        {"id": "W17", "name": "Worker 17 (Brian M.)", "role": "Formwork Worker", "location": "Floor 2 — Zone C", "floor": "Floor 2", "zone": "Zone C", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:22 AM"},
        {"id": "W18", "name": "Worker 18 (Jessica V.)", "role": "Site Engineer", "location": "Floor 2 — Zone A", "floor": "Floor 2", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:20 AM"},
        {"id": "W19", "name": "Worker 19 (Noah T.)", "role": "Rebar Tier", "location": "Floor 2 — Zone C", "floor": "Floor 2", "zone": "Zone C", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 1, "last_detected": "10:18 AM"},
        {"id": "W20", "name": "Worker 20 (Grace H.)", "role": "Welder", "location": "Floor 2 — Zone B", "floor": "Floor 2", "zone": "Zone B", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:14 AM"},
        {"id": "W21", "name": "Worker 21 (Victor K.)", "role": "Crane Signalman", "location": "Floor 2 — Zone D", "floor": "Floor 2", "zone": "Zone D", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:12 AM"},
        {"id": "W22", "name": "Worker 22 (Samantha D.)", "role": "Surveyor", "location": "Floor 2 — Zone A", "floor": "Floor 2", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:08 AM"},

        # --- FLOOR 3 (10 Workers) ---
        {"id": "W23", "name": "Worker 23 (Ethan J.)", "role": "Tower Crane Operator", "location": "Floor 3 — Zone D", "floor": "Floor 3", "zone": "Zone D", "status": "Warning", "risk": "WARNING", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 1, "last_detected": "10:45 AM"},
        {"id": "W24", "name": "Worker 24 (Rachel W.)", "role": "Framing Carpenter", "location": "Floor 3 — Zone C", "floor": "Floor 3", "zone": "Zone C", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:37 AM"},
        {"id": "W25", "name": "Worker 25 (Lucas M.)", "role": "Steel Erector", "location": "Floor 3 — Zone D", "floor": "Floor 3", "zone": "Zone D", "status": "Warning", "risk": "WARNING", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 1, "last_detected": "10:34 AM"},
        {"id": "W26", "name": "Worker 26 (Hannah B.)", "role": "Safety Assistant", "location": "Floor 3 — Zone A", "floor": "Floor 3", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:29 AM"},
        {"id": "W27", "name": "Worker 27 (Gabriel R.)", "role": "Formwork Carpenter", "location": "Floor 3 — Zone B", "floor": "Floor 3", "zone": "Zone B", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:24 AM"},
        {"id": "W28", "name": "Worker 28 (Mia L.)", "role": "Concrete Curing Tech", "location": "Floor 3 — Zone A", "floor": "Floor 3", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:19 AM"},
        {"id": "W29", "name": "Worker 29 (Dylan S.)", "role": "Heavy Rigging Specialist", "location": "Floor 3 — Zone D", "floor": "Floor 3", "zone": "Zone D", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:16 AM"},
        {"id": "W30", "name": "Worker 30 (Zoe A.)", "role": "Structural Engineer", "location": "Floor 3 — Zone B", "floor": "Floor 3", "zone": "Zone B", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:11 AM"},
        {"id": "W31", "name": "Worker 31 (Tyler N.)", "role": "Metal Fabricator", "location": "Floor 3 — Zone C", "floor": "Floor 3", "zone": "Zone C", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:06 AM"},
        {"id": "W32", "name": "Worker 32 (Olivia P.)", "role": "Site Coordinator", "location": "Floor 3 — Zone A", "floor": "Floor 3", "zone": "Zone A", "status": "Safe", "risk": "SAFE", "ppe": {"helmet": "OK", "vest": "OK", "shoes": "OK", "mask": "OK"}, "active_violations": 0, "recent_violations": 0, "last_detected": "10:01 AM"}
    ],

    "construction_activities": {
        "overall_progress": 67,
        "floors": [
            {
                "floor": "Floor 1",
                "progress": 92,
                "activities": {
                    "Columns": {"status": "Completed", "pct": 100, "code": "COMPLETED"},
                    "Beams": {"status": "Completed", "pct": 100, "code": "COMPLETED"},
                    "Slab": {"status": "Completed", "pct": 100, "code": "COMPLETED"},
                    "Masonry": {"status": "In Progress", "pct": 68, "code": "IN_PROGRESS"}
                }
            },
            {
                "floor": "Floor 2",
                "progress": 67,
                "activities": {
                    "Columns": {"status": "Completed", "pct": 100, "code": "COMPLETED"},
                    "Beams": {"status": "In Progress", "pct": 80, "code": "IN_PROGRESS"},
                    "Masonry": {"status": "In Progress", "pct": 40, "code": "IN_PROGRESS"},
                    "Slab": {"status": "Not Started", "pct": 0, "code": "NOT_STARTED"}
                }
            },
            {
                "floor": "Floor 3",
                "progress": 41,
                "activities": {
                    "Columns": {"status": "In Progress", "pct": 90, "code": "IN_PROGRESS"},
                    "Beams": {"status": "In Progress", "pct": 40, "code": "IN_PROGRESS"},
                    "Slab": {"status": "Not Started", "pct": 0, "code": "NOT_STARTED"},
                    "Masonry": {"status": "Not Started", "pct": 0, "code": "NOT_STARTED"}
                }
            }
        ],
        "progress_history": [
            {"week": "Week 1", "pct": 20},
            {"week": "Week 2", "pct": 38},
            {"week": "Week 3", "pct": 55},
            {"week": "Week 4", "pct": 67}
        ],
        "ai_observations": [
            {
                "id": "OBS-501",
                "floor": "Floor 2",
                "zone": "Zone B",
                "observation": "Beam installation detected in Zone B.",
                "confidence": 94,
                "timestamp": "10:30 AM",
                "status": "Pending", # Pending, Confirmed, Rejected
                "suggested_update": "Increase Floor 2 Beams to 80%"
            },
            {
                "id": "OBS-502",
                "floor": "Floor 3",
                "zone": "Zone A",
                "observation": "Column concrete formwork curing complete.",
                "confidence": 88,
                "timestamp": "09:45 AM",
                "status": "Pending",
                "suggested_update": "Increase Floor 3 Columns to 90%"
            },
            {
                "id": "OBS-500",
                "floor": "Floor 2",
                "zone": "Zone C",
                "observation": "Masonry wall framing initiated.",
                "confidence": 91,
                "timestamp": "08:15 AM",
                "status": "Confirmed",
                "confirmed_by": "Supervisor J. Miller"
            }
        ]
    },

    "safety_rules": [
        {
            "id": "R01",
            "name": "Mandatory Hardhat Policy",
            "condition": "Worker detected without hardhat / helmet",
            "risk_assigned": "HIGH",
            "code": "OSHA 1926.100",
            "status": "Active"
        },
        {
            "id": "R02",
            "name": "High-Visibility Safety Vest",
            "condition": "Worker detected without safety vest in active area",
            "risk_assigned": "MEDIUM",
            "code": "OSHA 1926.201",
            "status": "Active"
        },
        {
            "id": "R03",
            "name": "Unprotected Open Edge Fall Protection",
            "condition": "Worker within 2.0m of un-guardrailed slab edge",
            "risk_assigned": "CRITICAL",
            "code": "Site Rule 14",
            "status": "Active"
        },
        {
            "id": "R04",
            "name": "Heavy Machinery Proximity Zone",
            "condition": "Worker within 3.0m radius of active excavator or crane",
            "risk_assigned": "HIGH",
            "code": "Safety Spec 08",
            "status": "Active"
        }
    ],

    # --- WORKER GPS SAFETY & EXPOSURE TRACKING (VASAVI COLLEGE OF ENGINEERING, IBRAHIMBAGH) ---
    "gps_hazards": [
        {
            "id": "HAZ-101",
            "hazard_type": "Open Edge / Unprotected Ledge",
            "rule": "Site Rule 14 - Edge Guardrail Requirement",
            "floor": "Floor 2",
            "zone": "Zone B",
            "location_name": "Vasavi Block A — Floor 2 Zone B Ledge",
            "lat": 17.380820,
            "lng": 78.382100,
            "danger_radius_m": 10.0,
            "warning_radius_m": 25.0,
            "risk": "CRITICAL"
        },
        {
            "id": "HAZ-102",
            "hazard_type": "Scaffolding Loading Trapdoor",
            "rule": "OSHA 1926.451 - Scaffolding Safety",
            "floor": "Floor 2",
            "zone": "Zone C",
            "location_name": "Vasavi Mechanical Bay — Scaffold Hatch",
            "lat": 17.381020,
            "lng": 78.382320,
            "danger_radius_m": 10.0,
            "warning_radius_m": 25.0,
            "risk": "HIGH"
        },
        {
            "id": "HAZ-103",
            "hazard_type": "Tower Crane Overhead Hook Zone",
            "rule": "Safety Spec 08 - Heavy Rigging Overhead Clearance",
            "floor": "Floor 3",
            "zone": "Zone D",
            "location_name": "Vasavi Admin & Civil Block Crane",
            "lat": 17.380550,
            "lng": 78.381850,
            "danger_radius_m": 10.0,
            "warning_radius_m": 25.0,
            "risk": "CRITICAL"
        },
        {
            "id": "HAZ-104",
            "hazard_type": "Electrical Trench Excavation",
            "rule": "OSHA 1926.651 - Excavation & Trenching Hazards",
            "floor": "Floor 1",
            "zone": "Zone D",
            "location_name": "Vasavi West Perimeter Trench",
            "lat": 17.381250,
            "lng": 78.382580,
            "danger_radius_m": 10.0,
            "warning_radius_m": 25.0,
            "risk": "HIGH"
        }
    ],

    "gps_workers": {},
    "exposure_events": []
}

# Synchronize worker count
SITE_STATE["active_workers_count"] = len(SITE_STATE["workers"])

# Initial synchronization to Firebase Firestore
if firebase_manager.is_connected:
    try:
        firebase_manager.sync_initial_state(SITE_STATE)
    except Exception as e:
        print(f"[Firebase] Initial sync error: {e}")


def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two lat/lng coordinates."""
    try:
        R = 6371000.0  # Earth radius in meters
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        delta_phi = math.radians(float(lat2) - float(lat1))
        delta_lambda = math.radians(float(lon2) - float(lon1))
        
        a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 1)
    except Exception:
        return 999.9


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/worker-safety")
def worker_safety_page():
    return render_template("worker_safety.html")


@app.route("/api/gps/update", methods=["POST"])
def update_worker_gps():
    data = request.json or {}
    worker_id = str(data.get("worker_id", "W024")).strip().upper()
    if not worker_id:
        return jsonify({"error": "Worker ID is required"}), 400
        
    lat = float(data.get("latitude", 17.380800))
    lng = float(data.get("longitude", 78.382090))
    accuracy = float(data.get("accuracy", 3.8))
    floor = data.get("floor", "Floor 2")
    zone = data.get("zone", "Zone B")
    name = data.get("name")
    
    if not name:
        roster_match = next((w for w in SITE_STATE["workers"] if w["id"].upper() == worker_id), None)
        if roster_match:
            name = roster_match["name"]
        else:
            name = f"Worker {worker_id}"

    # Calculate distance to active hazards
    hazards = SITE_STATE.get("gps_hazards", [])
    floor_hazards = [h for h in hazards if h.get("floor") == floor]
    check_hazards = floor_hazards if floor_hazards else hazards

    client_dist = data.get("distance_m")
    if client_dist is not None and float(client_dist) >= 0:
        min_dist = float(client_dist)
        if check_hazards:
            nearest_hazard = check_hazards[0]
        elif hazards:
            nearest_hazard = hazards[0]
    else:
        for h in check_hazards:
            h_lat = float(h["lat"])
            h_lng = float(h["lng"])
            d = calculate_haversine_distance(lat, lng, h_lat, h_lng)
            if d < min_dist:
                min_dist = d
                nearest_hazard = h

        if nearest_hazard is None and hazards:
            nearest_hazard = hazards[0]
            min_dist = calculate_haversine_distance(lat, lng, hazards[0]["lat"], hazards[0]["lng"])

    danger_r = nearest_hazard.get("danger_radius_m", 10.0) if nearest_hazard else 10.0
    warning_r = nearest_hazard.get("warning_radius_m", 25.0) if nearest_hazard else 25.0

    if min_dist <= danger_r:
        safety_status = "CRITICAL"
        status_label = "CRITICAL — DANGER ZONE"
    elif min_dist <= warning_r:
        safety_status = "WARNING"
        status_label = "WARNING — Hazard Nearby"
    else:
        safety_status = "SAFE"
        status_label = "SAFE"

    now_ts = time.time()
    now_str = time.strftime("%I:%M:%S %p")

    worker_gps_info = {
        "worker_id": worker_id,
        "name": name,
        "floor": floor,
        "zone": zone,
        "lat": lat,
        "lng": lng,
        "accuracy": accuracy,
        "safety_status": safety_status,
        "status_label": status_label,
        "nearest_hazard": nearest_hazard.get("hazard_type") if nearest_hazard else "None",
        "hazard_id": nearest_hazard.get("id") if nearest_hazard else "HAZ-000",
        "hazard_rule": nearest_hazard.get("rule", "Site Safety Spec") if nearest_hazard else "",
        "distance_m": round(min_dist, 1),
        "last_updated": now_str,
        "timestamp": now_ts,
        "battery": "88%"
    }
    
    SITE_STATE["gps_workers"][worker_id] = worker_gps_info

    # Exposure Tracking Logic
    open_events = [e for e in SITE_STATE.get("exposure_events", []) if e["worker_id"] == worker_id and e["status"] == "OPEN"]
    active_exposure = None

    if safety_status == "CRITICAL" and nearest_hazard:
        hz_id = nearest_hazard["id"]
        matching_event = next((e for e in open_events if e["hazard_id"] == hz_id), None)
        if not matching_event:
            new_exp = {
                "id": f"EXP-{int(now_ts * 1000) % 10000}",
                "worker_id": worker_id,
                "worker_name": name,
                "hazard_id": hz_id,
                "hazard_type": nearest_hazard.get("hazard_type", "Danger Zone Proximity"),
                "rule": nearest_hazard.get("rule", "Site Rule 14 - Edge Guardrail Requirement"),
                "floor": floor,
                "zone": zone,
                "risk": "CRITICAL",
                "entry_time": now_str,
                "entry_timestamp": now_ts,
                "alert_time": now_str,
                "exit_time": None,
                "exit_timestamp": None,
                "exposure_duration": 0,
                "status": "OPEN",
                "distance_m": round(min_dist, 1)
            }
            SITE_STATE["exposure_events"].insert(0, new_exp)
            active_exposure = new_exp
        else:
            matching_event["exposure_duration"] = int(now_ts - matching_event["entry_timestamp"])
            matching_event["distance_m"] = round(min_dist, 1)
            matching_event["floor"] = floor
            matching_event["zone"] = zone
            active_exposure = matching_event
    else:
        # Worker moved out of CRITICAL state -> auto close active exposure events
        for ev in open_events:
            ev["status"] = "CLOSED"
            ev["exit_time"] = now_str
            ev["exit_timestamp"] = now_ts
            ev["exposure_duration"] = max(1, int(now_ts - ev["entry_timestamp"]))

    return jsonify({
        "success": True,
        "worker": worker_gps_info,
        "nearest_hazard": nearest_hazard,
        "active_exposure": active_exposure,
        "alert": {
            "is_critical": safety_status == "CRITICAL",
            "is_warning": safety_status == "WARNING",
            "trigger_visual": safety_status == "CRITICAL",
            "trigger_audio": safety_status == "CRITICAL",
            "trigger_vibrate": safety_status == "CRITICAL",
            "message": f"Worker {worker_id} - {status_label}",
            "instruction": "MOVE TO A SAFE AREA IMMEDIATELY" if safety_status == "CRITICAL" else "Exercise Caution near Active Construction Area"
        }
    })


@app.route("/api/gps/workers", methods=["GET"])
def get_gps_workers():
    now_ts = time.time()
    for ev in SITE_STATE.get("exposure_events", []):
        if ev["status"] == "OPEN":
            ev["exposure_duration"] = int(now_ts - ev["entry_timestamp"])

    open_exposures = [ev for ev in SITE_STATE.get("exposure_events", []) if ev["status"] == "OPEN"]
    gps_list = list(SITE_STATE.get("gps_workers", {}).values())

    return jsonify({
        "success": True,
        "gps_workers": gps_list,
        "open_exposures": open_exposures,
        "exposure_events": SITE_STATE.get("exposure_events", []),
        "hazards": SITE_STATE.get("gps_hazards", []),
        "active_exposed_count": len(open_exposures)
    })


@app.route("/api/gps/simulate-move", methods=["POST"])
def simulate_worker_move():
    data = request.json or {}
    worker_id = str(data.get("worker_id", "W024")).strip().upper()
    distance_target = float(data.get("distance_m", 6.8))
    floor = data.get("floor", "Floor 2")
    zone = data.get("zone", "Zone B")

    hazards = SITE_STATE.get("gps_hazards", [])
    hz = next((h for h in hazards if h.get("floor") == floor), hazards[0] if hazards else None)

    if "latitude" in data and "longitude" in data:
        new_lat = float(data["latitude"])
        new_lng = float(data["longitude"])
        accuracy = float(data.get("accuracy", 3.0))
    elif hz:
        hz_lat = float(hz["lat"])
        hz_lng = float(hz["lng"])
        offset_deg = (distance_target / 111139.0)
        new_lat = hz_lat - offset_deg
        new_lng = hz_lng
        accuracy = 2.5
    else:
        new_lat = 17.380800
        new_lng = 78.382090
        accuracy = 3.5

    req_payload = {
        "worker_id": worker_id,
        "latitude": new_lat,
        "longitude": new_lng,
        "distance_m": distance_target,
        "accuracy": accuracy,
        "floor": floor,
        "zone": zone
    }

    with app.test_request_context('/api/gps/update', json=req_payload):
        res = update_worker_gps()
        return res


@app.route("/api/exposure-events", methods=["GET"])
def get_exposure_events():
    now_ts = time.time()
    for ev in SITE_STATE.get("exposure_events", []):
        if ev["status"] == "OPEN":
            ev["exposure_duration"] = int(now_ts - ev["entry_timestamp"])
    return jsonify({
        "success": True,
        "exposure_events": SITE_STATE.get("exposure_events", [])
    })


@app.route("/api/site-state", methods=["GET"])
def get_site_state():
    SITE_STATE["active_workers_count"] = len(SITE_STATE["workers"])
    return jsonify(SITE_STATE)


@app.route("/api/analyze-floor-plan", methods=["POST"])
def analyze_floor_plan():
    try:
        os.makedirs(os.path.join(app.static_folder, "uploads"), exist_ok=True)
        floor_name = "Floor 2"
        image_url = None
        image_b64 = None
        save_path = None

        if request.files and "file" in request.files:
            file = request.files["file"]
            floor_name = request.form.get("floor_name", "Floor 2")
            if file and file.filename:
                orig_name = secure_filename(file.filename)
                ext = os.path.splitext(orig_name)[1] or ".jpg"
                filename = f"blueprint_{floor_name.replace(' ', '_')}_{int(time.time())}{ext}"
                save_path = os.path.join(app.static_folder, "uploads", filename)
                file.save(save_path)
                image_url = f"/static/uploads/{filename}"
                with open(save_path, "rb") as f:
                    b64_str = base64.b64encode(f.read()).decode("utf-8")
                    image_b64 = f"data:image/jpeg;base64,{b64_str}"
        elif request.json:
            data = request.json
            floor_name = data.get("floor_name", "Floor 2")
            if "image_b64" in data and data["image_b64"]:
                image_b64 = data["image_b64"]
                header, b64_str = image_b64.split(",") if "," in image_b64 else ("", image_b64)
                img_bytes = base64.b64decode(b64_str)
                filename = f"blueprint_{floor_name.replace(' ', '_')}_{int(time.time())}.jpg"
                save_path = os.path.join(app.static_folder, "uploads", filename)
                with open(save_path, "wb") as f:
                    f.write(img_bytes)
                image_url = f"/static/uploads/{filename}"

        if not save_path or not os.path.exists(save_path):
            return jsonify({"error": "No floor plan image provided"}), 400

        # Perform Computer Vision segmentation and hazard analysis on the blueprint
        analysis_result = engine.analyze_floor_plan(save_path, floor_name=floor_name)

        if "floor_plans" not in SITE_STATE:
            SITE_STATE["floor_plans"] = {}

        SITE_STATE["floor_plans"][floor_name] = {
            "floor": floor_name,
            "image_url": image_url,
            "image_b64": image_b64,
            "annotated_b64": analysis_result.get("annotated_b64"),
            "analysis": analysis_result,
            "is_active": True
        }

        return jsonify({
            "success": True,
            "floor": floor_name,
            "image_url": image_url,
            "image_b64": image_b64,
            "annotated_b64": analysis_result.get("annotated_b64"),
            "analysis": analysis_result,
            "floor_plans": SITE_STATE["floor_plans"]
        })
    except Exception as e:
        return jsonify({"error": f"Failed to analyze floor plan: {str(e)}"}), 500


@app.route("/api/reset-floor-plan", methods=["POST"])
def reset_floor_plan():
    data = request.json or {}
    floor_name = data.get("floor_name", "Floor 2")
    if "floor_plans" in SITE_STATE and floor_name in SITE_STATE["floor_plans"]:
        SITE_STATE["floor_plans"][floor_name]["is_active"] = False
    return jsonify({"success": True, "floor": floor_name, "floor_plans": SITE_STATE.get("floor_plans", {})})


def ingest_live_hazards(hazards, workers=None):
    """
    Ingests hazards detected by the AI vision pipeline during live monitoring into the master hazard log,
    updating worker safety profiles, active hazard counts, and site safety scores.
    """
    if not hazards:
        return False
    updated = False
    now = time.time()
    now_str = time.strftime("%I:%M %p")

    for hz in hazards:
        w_id = hz.get("worker_id", "W08")
        issue = hz.get("issue", "PPE Violation")
        cam = hz.get("camera", "Camera Feed")

        # Associate with worker in roster if exists
        roster_worker = next((w for w in SITE_STATE["workers"] if w["id"] == w_id), None)
        if roster_worker:
            hz["worker_name"] = roster_worker["name"]
            if hz.get("risk") in ["HIGH", "CRITICAL"]:
                roster_worker["risk"] = "HIGH"
                roster_worker["status"] = "At Risk"
            elif roster_worker["risk"] != "HIGH":
                roster_worker["risk"] = "MEDIUM"
                roster_worker["status"] = "Warning"
            if "Hardhat" in issue or "Helmet" in issue:
                roster_worker["ppe"]["helmet"] = "MISSING"
            if "Vest" in issue:
                roster_worker["ppe"]["vest"] = "MISSING"
            roster_worker["active_violations"] = max(1, roster_worker.get("active_violations", 0) + 1)
            roster_worker["last_detected"] = now_str
            if firebase_manager.is_connected:
                firebase_manager.update_worker(roster_worker)
        else:
            new_worker = {
                "id": w_id,
                "name": hz.get("worker_name", f"Worker {w_id}"),
                "role": "General Trades",
                "location": hz.get("location", "Floor 2 — Zone D"),
                "floor": hz.get("floor", "Floor 2"),
                "zone": hz.get("zone", "Zone D"),
                "status": "At Risk" if hz.get("risk") in ["HIGH", "CRITICAL"] else "Warning",
                "risk": hz.get("risk", "HIGH"),
                "ppe": {
                    "helmet": "MISSING" if ("Hardhat" in issue or "Helmet" in issue) else "OK",
                    "vest": "MISSING" if "Vest" in issue else "OK",
                    "shoes": "OK",
                    "mask": "OK"
                },
                "active_violations": 1,
                "recent_violations": 1,
                "last_detected": now_str
            }
            SITE_STATE["workers"].append(new_worker)
            SITE_STATE["active_workers_count"] = len(SITE_STATE["workers"])
            if firebase_manager.is_connected:
                firebase_manager.update_worker(new_worker)

        # Check if identical active hazard already recorded recently (within last 45s) to prevent spam
        existing = next(
            (h for h in SITE_STATE["hazards"]
             if h.get("worker_id") == w_id
             and h.get("issue") == issue
             and h.get("status") in ["Active", "Acknowledged"]
             and abs(now - h.get("timestamp", 0)) < 45),
            None
        )
        if not existing:
            hz_entry = {
                "id": f"HAZ-{int(now * 100) % 90000 + 10000}",
                "worker_id": w_id,
                "worker_name": hz.get("worker_name", f"Worker {w_id}"),
                "issue": issue,
                "rule": hz.get("rule", "OSHA Safety Standard"),
                "location": hz.get("location", "Floor 2 — Zone D"),
                "floor": hz.get("floor", "Floor 2"),
                "zone": hz.get("zone", "Zone D"),
                "risk": hz.get("risk", "HIGH"),
                "camera": cam,
                "time": now_str,
                "timestamp": now,
                "status": "Active"
            }
            SITE_STATE["hazards"].insert(0, hz_entry)
            updated = True
            if firebase_manager.is_connected:
                firebase_manager.save_hazard(hz_entry)
        else:
            existing["timestamp"] = now
            existing["time"] = now_str
            existing["location"] = hz.get("location", existing.get("location"))

    if updated:
        if len(SITE_STATE["hazards"]) > 60:
            SITE_STATE["hazards"] = SITE_STATE["hazards"][:60]

        active_hz = [h for h in SITE_STATE["hazards"] if h.get("status") in ["Active", "Acknowledged"]]
        high_risk_hz = [h for h in SITE_STATE["hazards"] if h.get("status") == "Active" and h.get("risk") in ["HIGH", "CRITICAL"]]

        SITE_STATE["active_hazards_count"] = len(active_hz)
        SITE_STATE["high_risk_hazards_count"] = len(high_risk_hz)
        SITE_STATE["last_updated"] = time.strftime("%I:%M:%S %p")

        if len(high_risk_hz) >= 2:
            SITE_STATE["site_safety_status"] = "CRITICAL"
            SITE_STATE["safety_score"] = max(70, 94 - len(high_risk_hz) * 4)
        elif len(high_risk_hz) == 1 or len(active_hz) > 0:
            SITE_STATE["site_safety_status"] = "WARNING"
            SITE_STATE["safety_score"] = max(84, 96 - len(active_hz) * 2)
        else:
            SITE_STATE["site_safety_status"] = "SAFE"
            SITE_STATE["safety_score"] = 99

        if firebase_manager.is_connected:
            firebase_manager.update_site_metrics(SITE_STATE)

    return updated



@app.route("/api/upload-media", methods=["POST"])
def upload_media():
    try:
        os.makedirs(os.path.join(app.static_folder, "uploads"), exist_ok=True)
        file_path = None
        orig_name = "Uploaded Footage"
        ext = ".mp4"

        if "file" in request.files:
            file = request.files["file"]
            if file and file.filename:
                orig_name = secure_filename(file.filename)
                ext = os.path.splitext(orig_name)[1] or ".mp4"
                filename = f"custom_{int(time.time())}{ext}"
                file_path = os.path.abspath(os.path.join(app.static_folder, "uploads", filename))
                file.save(file_path)
        elif request.json and "image_b64" in request.json and request.json["image_b64"]:
            b64_data = request.json["image_b64"]
            header, b64_str = b64_data.split(",") if "," in b64_data else ("", b64_data)
            img_bytes = base64.b64decode(b64_str)
            filename = f"custom_{int(time.time())}.jpg"
            file_path = os.path.abspath(os.path.join(app.static_folder, "uploads", filename))
            with open(file_path, "wb") as f:
                f.write(img_bytes)
            ext = ".jpg"

        if not file_path or not os.path.exists(file_path):
            return jsonify({"error": "No valid media file provided"}), 400

        video_exts = ('.mp4', '.avi', '.mov', '.webm', '.mkv', '.m4v')
        is_video = ext.lower() in video_exts

        custom_cam = {
            "id": "CAM-CUSTOM",
            "name": f"Uploaded Feed ({orig_name})",
            "floor": "Floor 2",
            "zone": "Zone D",
            "status": "LIVE (CUSTOM)",
            "risk": "HIGH",
            "active_worker": "Uploaded Worker",
            "source": file_path,
            "media_type": "video" if is_video else "image",
            "is_custom": True
        }

        # Read representative frame for immediate inference response
        if is_video:
            cap = cv2.VideoCapture(file_path)
            ret, frame = cap.read()
            check_count = 0
            while ret and frame is not None and np.mean(frame) < 5 and check_count < 15:
                ret, frame = cap.read()
                check_count += 1
            cap.release()
        else:
            frame = cv2.imread(file_path)

        if frame is None:
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, "Uploaded Media Feed", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        res = engine.process_frame(frame, camera_info={"camera_id": "CAM-CUSTOM", "name": custom_cam["name"], "floor": "Floor 2"})
        annotated = engine.annotate_frame(frame, res)

        _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
        annotated_b64 = base64.b64encode(buffer).decode('utf-8')
        custom_cam["annotated_b64"] = f"data:image/jpeg;base64,{annotated_b64}"

        # Register camera in platform state
        cam_index = next((i for i, c in enumerate(SITE_STATE["cameras"]) if c["id"] == "CAM-CUSTOM"), None)
        if cam_index is not None:
            SITE_STATE["cameras"][cam_index] = custom_cam
        else:
            SITE_STATE["cameras"].append(custom_cam)

        if firebase_manager.is_connected:
            firebase_manager.update_camera(custom_cam)

        # Ingest new hazards into platform state and hazard log
        if res.get("hazards"):
            ingest_live_hazards(res["hazards"], res.get("workers"))

        return jsonify({
            "success": True,
            "media_type": "video" if is_video else "image",
            "camera": custom_cam,
            "analysis": res,
            "annotated_image": f"data:image/jpeg;base64,{annotated_b64}",
            "hazards": SITE_STATE["hazards"],
            "active_hazards_count": SITE_STATE["active_hazards_count"],
            "high_risk_hazards_count": SITE_STATE["high_risk_hazards_count"],
            "site_safety_status": SITE_STATE["site_safety_status"],
            "safety_score": SITE_STATE["safety_score"]
        })
    except Exception as e:
        return jsonify({"error": f"Failed to process media upload: {str(e)}"}), 500


@app.route("/api/process-image", methods=["POST"])
def process_image():
    # Process uploaded image or camera frame with YOLO engine and update hazard history
    data = request.json or {}
    cam_id = data.get("camera_id", "CAM-01")
    
    cam = next((c for c in SITE_STATE["cameras"] if c["id"] == cam_id), SITE_STATE["cameras"][0])
    img_path = cam.get("source", "")
    if img_path and not os.path.isabs(img_path):
        img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), img_path)
    frame = None
    
    if "image_b64" in data and data["image_b64"]:
        try:
            b64_str = data["image_b64"].split(",")[-1]
            img_bytes = base64.b64decode(b64_str)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        except Exception as e:
            return jsonify({"error": f"Failed to decode image: {e}"}), 400
    else:
        video_exts = ('.mp4', '.avi', '.mov', '.webm', '.mkv', '.m4v')
        if os.path.exists(img_path):
            if any(img_path.lower().endswith(ext) for ext in video_exts):
                cap = cv2.VideoCapture(img_path)
                ret, frame = cap.read()
                cap.release()
                if not ret:
                    frame = np.zeros((480, 640, 3), dtype=np.uint8)
            else:
                frame = cv2.imread(img_path)
        else:
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, f"Feed: {cam['name']}", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    res = engine.process_frame(frame, camera_info={"camera_id": cam["id"], "name": cam["name"], "floor": cam["floor"]})
    annotated = engine.annotate_frame(frame, res)
    
    # Ingest any detected hazards into the live hazard log and history
    if res.get("hazards"):
        ingest_live_hazards(res["hazards"], res.get("workers"))

    _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    annotated_b64 = base64.b64encode(buffer).decode('utf-8')

    return jsonify({
        "camera": cam,
        "analysis": res,
        "annotated_image": f"data:image/jpeg;base64,{annotated_b64}",
        "hazards": SITE_STATE["hazards"],
        "active_hazards_count": SITE_STATE["active_hazards_count"],
        "high_risk_hazards_count": SITE_STATE["high_risk_hazards_count"],
        "site_safety_status": SITE_STATE["site_safety_status"],
        "safety_score": SITE_STATE["safety_score"]
    })


@app.route("/api/video-feed/<camera_id>")
def video_feed(camera_id):
    # Generates optimized MJPEG video stream with real-time detection overlay
    def generate():
        cam = next((c for c in SITE_STATE["cameras"] if c["id"] == camera_id), SITE_STATE["cameras"][0])
        src = cam.get("source", "")
        if src and not os.path.isabs(src):
            src = os.path.join(os.path.dirname(os.path.abspath(__file__)), src)

        video_exts = ('.mp4', '.avi', '.mov', '.webm', '.mkv', '.m4v')
        is_video = src and any(src.lower().endswith(ext) for ext in video_exts) and os.path.exists(src)
        
        if is_video:
            cap = cv2.VideoCapture(src)
            frame_idx = 0
            cached_res = None
            while True:
                ret, frame = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()
                    if not ret:
                        cap.release()
                        break
                
                frame_idx += 1
                # Sample inference once at start, and every 60 frames (~2-3 sec) to avoid pegging cloud CPU
                if cached_res is None or frame_idx % 60 == 1:
                    try:
                        cached_res = engine.process_frame(frame, camera_info={"camera_id": cam["id"], "name": cam["name"], "floor": cam["floor"]})
                        if cached_res and cached_res.get("hazards"):
                            ingest_live_hazards(cached_res["hazards"], cached_res.get("workers"))
                    except Exception as e:
                        print(f"[VideoFeed] Detection notice: {e}")
                
                annotated = engine.annotate_frame(frame, cached_res) if cached_res else frame
                cv2.putText(annotated, f"LIVE | {cam.get('name', 'Camera')}", (20, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 1, cv2.LINE_AA)
                
                # Resize for snappy network throughput
                _, jpeg = cv2.imencode('.jpg', cv2.resize(annotated, (640, 360)), [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_bytes = jpeg.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                time.sleep(0.04) # Smooth ~25fps playback
        else:
            if src and os.path.exists(src):
                frame = cv2.imread(src)
            else:
                frame = None

            if frame is None:
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, f"Feed: {cam.get('name', 'Camera')}", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

            res = None
            try:
                res = engine.process_frame(frame, camera_info={"camera_id": cam["id"], "name": cam["name"], "floor": cam["floor"]})
                if res and res.get("hazards"):
                    ingest_live_hazards(res["hazards"], res.get("workers"))
            except Exception as e:
                print(f"[VideoFeed] Still inference notice: {e}")

            annotated_base = engine.annotate_frame(frame, res) if res else frame
            
            while True:
                annotated = annotated_base.copy()
                cv2.putText(annotated, f"LIVE | {time.strftime('%Y-%m-%d %H:%M:%S')}", (20, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (34, 197, 94), 1, cv2.LINE_AA)
                
                _, jpeg = cv2.imencode('.jpg', cv2.resize(annotated, (640, 360)), [cv2.IMWRITE_JPEG_QUALITY, 75])
                frame_bytes = jpeg.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                time.sleep(0.5)

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')




@app.route("/api/hazards/<hazard_id>/update-status", methods=["POST"])
def update_hazard_status(hazard_id):
    data = request.json or {}
    new_status = data.get("status", "Acknowledged")
    notes = data.get("notes", "")
    resolved_by = data.get("resolved_by", "Safety Officer")
    
    for h in SITE_STATE["hazards"]:
        if h["id"] == hazard_id:
            h["status"] = new_status
            if notes:
                h["resolve_notes"] = notes
            if new_status == "Resolved":
                h["resolved_by"] = resolved_by
            h["updated_at"] = time.strftime("%I:%M %p")
            
            # Recalculate site active hazards count
            active_hz = [hz for hz in SITE_STATE["hazards"] if hz["status"] in ["Active", "Acknowledged"]]
            high_risk_hz = [hz for hz in SITE_STATE["hazards"] if hz["status"] == "Active" and hz["risk"] in ["HIGH", "CRITICAL"]]
            
            SITE_STATE["active_hazards_count"] = len(active_hz)
            SITE_STATE["high_risk_hazards_count"] = len(high_risk_hz)
            
            # Dynamic safety status update
            if len(high_risk_hz) > 0:
                SITE_STATE["site_safety_status"] = "WARNING"
                SITE_STATE["safety_score"] = 91
            elif len(active_hz) > 0:
                SITE_STATE["site_safety_status"] = "WARNING"
                SITE_STATE["safety_score"] = 95
            else:
                SITE_STATE["site_safety_status"] = "SAFE"
                SITE_STATE["safety_score"] = 99

            # Sync update to Firebase Firestore
            if firebase_manager.is_connected:
                firebase_manager.update_hazard_status(hazard_id, new_status, notes=notes, resolved_by=resolved_by)
                firebase_manager.update_site_metrics(SITE_STATE)
                
            return jsonify({"success": True, "hazard": h, "site_state": SITE_STATE})
            
    return jsonify({"error": "Hazard not found"}), 404


@app.route("/api/firebase/status", methods=["GET"])
def get_firebase_status():
    return jsonify({
        "connected": firebase_manager.is_connected,
        "project_id": "siteguard-7324f",
        "collections": ["hazards", "workers", "cameras", "site_metrics"] if firebase_manager.is_connected else [],
        "last_sync": time.strftime("%I:%M:%S %p")
    })


@app.route("/api/firebase/sync", methods=["POST"])
def trigger_firebase_sync():
    if not firebase_manager.is_connected:
        return jsonify({"success": False, "error": "Firebase Firestore is not connected"}), 503
    firebase_manager.sync_initial_state(SITE_STATE)
    return jsonify({
        "success": True,
        "message": "Full synchronization to Cloud Firestore complete.",
        "project_id": "siteguard-7324f"
    })



@app.route("/api/observations/<obs_id>/action", methods=["POST"])
def action_observation(obs_id):
    data = request.json or {}
    action = data.get("action", "confirm") # confirm or reject
    user = data.get("user", "Supervisor")
    
    obs_list = SITE_STATE["construction_activities"]["ai_observations"]
    for obs in obs_list:
        if obs["id"] == obs_id:
            if action == "confirm":
                obs["status"] = "Confirmed"
                obs["confirmed_by"] = user
                
                # Update floor activity progress if suggested
                fl_name = obs["floor"]
                floor_obj = next((f for f in SITE_STATE["construction_activities"]["floors"] if f["floor"] == fl_name), None)
                if floor_obj:
                    if "Beams" in obs["observation"]:
                        floor_obj["activities"]["Beams"]["pct"] = 80
                        floor_obj["activities"]["Beams"]["status"] = "In Progress"
                    elif "Columns" in obs["observation"]:
                        floor_obj["activities"]["Columns"]["pct"] = 90
                        floor_obj["activities"]["Columns"]["status"] = "In Progress"
                    
                    # Recalculate floor average
                    act_vals = [a["pct"] for a in floor_obj["activities"].values()]
                    floor_obj["progress"] = int(sum(act_vals) / len(act_vals))
                    
                # Recalculate overall site activity progress
                all_floors = SITE_STATE["construction_activities"]["floors"]
                SITE_STATE["project_activity_progress"] = int(sum(f["progress"] for f in all_floors) / len(all_floors))
                SITE_STATE["construction_activities"]["overall_progress"] = SITE_STATE["project_activity_progress"]
            else:
                obs["status"] = "Rejected"
                obs["rejected_by"] = user
                
            return jsonify({"success": True, "observation": obs, "activities": SITE_STATE["construction_activities"], "site_state": SITE_STATE})

    return jsonify({"error": "Observation not found"}), 404


@app.route("/api/report/export", methods=["GET"])
def export_report():
    report_data = {
        "title": "Construction Site Safety & Activity Intelligence Report",
        "generated_at": time.strftime("%B %d, %Y - %I:%M %p"),
        "site": SITE_STATE["site_name"],
        "overall_status": SITE_STATE["site_safety_status"],
        "safety_score": SITE_STATE["safety_score"],
        "summary": {
            "total_workers": SITE_STATE["active_workers_count"],
            "total_hazards": len(SITE_STATE["hazards"]),
            "active_hazards": SITE_STATE["active_hazards_count"],
            "high_risk_hazards": SITE_STATE["high_risk_hazards_count"],
            "overall_progress_pct": SITE_STATE["project_activity_progress"]
        },
        "hazards_breakdown": SITE_STATE["hazards"],
        "workers_status": SITE_STATE["workers"],
        "construction_progress": SITE_STATE["construction_activities"],
        "safety_rules": SITE_STATE["safety_rules"]
    }
    return jsonify(report_data)


if __name__ == "__main__":
    print("[SITEGUARD 360] Starting Construction Site Command Center Server...")
    app.run(host="0.0.0.0", port=5000, debug=True)

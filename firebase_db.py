import os
import time
import json
import logging
from typing import Dict, List, Optional, Any

import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger("SiteGuard.Firebase")

class FirebaseManager:
    """
    Manages Firebase Firestore database synchronization for SiteGuard 360 PPE & Safety Platform.
    Stores:
      - 'hazards': Safety Violations & Hazard Logs (OSHA breaches, missing helmets/vests)
      - 'workers': Worker Safety Roster, PPE Status, and Incident Counts
      - 'cameras': Camera Feeds & Live Risk Monitoring
      - 'site_metrics': Real-time Site Safety Score and Overall Risk Status
    """
    def __init__(self, cred_path: str = "serviceAccountKey.json"):
        self.cred_path = cred_path
        self.db = None
        self.is_connected = False
        self._initialize()

    def _initialize(self):
        try:
            if not os.path.exists(self.cred_path):
                logger.warning(f"[Firebase] Credential file '{self.cred_path}' not found. Operating in local memory fallback mode.")
                return

            if not firebase_admin._apps:
                cred = credentials.Certificate(self.cred_path)
                firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            self.is_connected = True
            logger.info("[Firebase] Successfully connected to Cloud Firestore.")
        except Exception as e:
            logger.error(f"[Firebase] Initialization failed: {e}. Falling back to local state.")
            self.is_connected = False

    def sync_initial_state(self, site_state: Dict[str, Any]):
        """
        Synchronizes existing cameras, workers, and initial hazards to Firestore on startup.
        Uses batched writes for fast network efficiency.
        """
        if not self.is_connected or not self.db:
            return

        try:
            batch = self.db.batch()
            count = 0

            # 1. Sync Cameras
            for cam in site_state.get("cameras", []):
                cam_id = cam.get("id")
                if cam_id:
                    doc_ref = self.db.collection("cameras").document(cam_id)
                    cam_data = {
                        "id": cam_id,
                        "name": cam.get("name"),
                        "floor": cam.get("floor"),
                        "zone": cam.get("zone"),
                        "status": cam.get("status"),
                        "risk": cam.get("risk"),
                        "active_worker": cam.get("active_worker"),
                        "source": cam.get("source"),
                        "updated_at": firestore.SERVER_TIMESTAMP
                    }
                    batch.set(doc_ref, cam_data, merge=True)
                    count += 1

            # 2. Sync Workers
            for worker in site_state.get("workers", []):
                w_id = worker.get("id")
                if w_id:
                    doc_ref = self.db.collection("workers").document(w_id)
                    w_data = {
                        "id": w_id,
                        "name": worker.get("name"),
                        "role": worker.get("role"),
                        "location": worker.get("location"),
                        "floor": worker.get("floor"),
                        "zone": worker.get("zone"),
                        "status": worker.get("status"),
                        "risk": worker.get("risk"),
                        "ppe": worker.get("ppe", {}),
                        "active_violations": worker.get("active_violations", 0),
                        "recent_violations": worker.get("recent_violations", 0),
                        "last_detected": worker.get("last_detected", ""),
                        "updated_at": firestore.SERVER_TIMESTAMP
                    }
                    batch.set(doc_ref, w_data, merge=True)
                    count += 1

            # 3. Sync Existing Hazards
            for hz in site_state.get("hazards", []):
                h_id = hz.get("id")
                if h_id:
                    doc_ref = self.db.collection("hazards").document(h_id)
                    hz_data = {
                        "id": h_id,
                        "worker_id": hz.get("worker_id"),
                        "worker_name": hz.get("worker_name"),
                        "issue": hz.get("issue"),
                        "rule": hz.get("rule"),
                        "location": hz.get("location"),
                        "floor": hz.get("floor"),
                        "zone": hz.get("zone"),
                        "risk": hz.get("risk"),
                        "camera": hz.get("camera"),
                        "time": hz.get("time"),
                        "timestamp": hz.get("timestamp", time.time()),
                        "status": hz.get("status", "Active"),
                        "resolve_notes": hz.get("resolve_notes", ""),
                        "resolved_by": hz.get("resolved_by", ""),
                        "updated_at": firestore.SERVER_TIMESTAMP
                    }
                    batch.set(doc_ref, hz_data, merge=True)
                    count += 1

            # 4. Sync Site Overall Metrics
            metrics_ref = self.db.collection("site_metrics").document("current")
            metrics_data = {
                "site_name": site_state.get("site_name", "SiteGuard 360"),
                "site_safety_status": site_state.get("site_safety_status", "SAFE"),
                "safety_score": site_state.get("safety_score", 95),
                "active_workers_count": site_state.get("active_workers_count", len(site_state.get("workers", []))),
                "active_hazards_count": site_state.get("active_hazards_count", 0),
                "high_risk_hazards_count": site_state.get("high_risk_hazards_count", 0),
                "project_activity_progress": site_state.get("project_activity_progress", 67),
                "last_updated": time.strftime("%I:%M:%S %p"),
                "updated_at": firestore.SERVER_TIMESTAMP
            }
            batch.set(metrics_ref, metrics_data, merge=True)
            count += 1

            # Commit batch
            batch.commit()
            logger.info(f"[Firebase] Initial state synced ({count} documents registered in Firestore).")
        except Exception as e:
            logger.error(f"[Firebase] Error syncing initial state: {e}")

    def save_hazard(self, hazard: Dict[str, Any]):
        """
        Saves or updates a safety hazard/violation document in Firestore.
        """
        if not self.is_connected or not self.db:
            return

        try:
            h_id = hazard.get("id")
            if not h_id:
                h_id = f"HAZ-{int(time.time() * 100) % 90000 + 10000}"
                hazard["id"] = h_id

            doc_ref = self.db.collection("hazards").document(h_id)
            doc_data = {
                "id": h_id,
                "worker_id": hazard.get("worker_id", "W08"),
                "worker_name": hazard.get("worker_name", ""),
                "issue": hazard.get("issue", "PPE Violation"),
                "rule": hazard.get("rule", "OSHA Safety Standard"),
                "location": hazard.get("location", "Floor 2 — Zone D"),
                "floor": hazard.get("floor", "Floor 2"),
                "zone": hazard.get("zone", "Zone D"),
                "risk": hazard.get("risk", "HIGH"),
                "camera": hazard.get("camera", "Camera Feed"),
                "time": hazard.get("time", time.strftime("%I:%M %p")),
                "timestamp": hazard.get("timestamp", time.time()),
                "status": hazard.get("status", "Active"),
                "resolve_notes": hazard.get("resolve_notes", ""),
                "resolved_by": hazard.get("resolved_by", ""),
                "updated_at": firestore.SERVER_TIMESTAMP
            }
            doc_ref.set(doc_data, merge=True)
        except Exception as e:
            logger.error(f"[Firebase] Failed to save hazard {hazard.get('id')}: {e}")

    def update_hazard_status(self, hazard_id: str, status: str, notes: str = "", resolved_by: str = "Safety Officer"):
        """
        Updates the status of a hazard (e.g., Active -> Acknowledged / Resolved).
        """
        if not self.is_connected or not self.db:
            return

        try:
            doc_ref = self.db.collection("hazards").document(hazard_id)
            payload = {
                "status": status,
                "updated_at": firestore.SERVER_TIMESTAMP,
                "time_updated": time.strftime("%I:%M %p")
            }
            if notes:
                payload["resolve_notes"] = notes
            if status == "Resolved":
                payload["resolved_by"] = resolved_by

            doc_ref.update(payload)
            logger.info(f"[Firebase] Hazard {hazard_id} status updated to {status}")
        except Exception as e:
            logger.error(f"[Firebase] Failed to update hazard status {hazard_id}: {e}")

    def update_worker(self, worker: Dict[str, Any]):
        """
        Updates a worker's PPE compliance and violation count in Firestore.
        """
        if not self.is_connected or not self.db:
            return

        try:
            w_id = worker.get("id")
            if not w_id:
                return

            doc_ref = self.db.collection("workers").document(w_id)
            doc_data = {
                "id": w_id,
                "name": worker.get("name"),
                "role": worker.get("role", "General Trades"),
                "location": worker.get("location"),
                "floor": worker.get("floor"),
                "zone": worker.get("zone"),
                "status": worker.get("status"),
                "risk": worker.get("risk"),
                "ppe": worker.get("ppe", {}),
                "active_violations": worker.get("active_violations", 0),
                "recent_violations": worker.get("recent_violations", 0),
                "last_detected": worker.get("last_detected", time.strftime("%I:%M %p")),
                "updated_at": firestore.SERVER_TIMESTAMP
            }
            doc_ref.set(doc_data, merge=True)
        except Exception as e:
            logger.error(f"[Firebase] Failed to update worker {worker.get('id')}: {e}")

    def update_camera(self, camera: Dict[str, Any]):
        """
        Updates camera status and live risk rating in Firestore.
        """
        if not self.is_connected or not self.db:
            return

        try:
            cam_id = camera.get("id")
            if not cam_id:
                return

            doc_ref = self.db.collection("cameras").document(cam_id)
            doc_data = {
                "id": cam_id,
                "name": camera.get("name"),
                "floor": camera.get("floor"),
                "zone": camera.get("zone"),
                "status": camera.get("status"),
                "risk": camera.get("risk"),
                "active_worker": camera.get("active_worker"),
                "source": camera.get("source"),
                "updated_at": firestore.SERVER_TIMESTAMP
            }
            doc_ref.set(doc_data, merge=True)
        except Exception as e:
            logger.error(f"[Firebase] Failed to update camera {camera.get('id')}: {e}")

    def update_site_metrics(self, site_state: Dict[str, Any]):
        """
        Updates overall site safety status, safety score, and hazard counts in Firestore.
        """
        if not self.is_connected or not self.db:
            return

        try:
            doc_ref = self.db.collection("site_metrics").document("current")
            doc_data = {
                "site_safety_status": site_state.get("site_safety_status", "SAFE"),
                "safety_score": site_state.get("safety_score", 95),
                "active_workers_count": site_state.get("active_workers_count", len(site_state.get("workers", []))),
                "active_hazards_count": site_state.get("active_hazards_count", 0),
                "high_risk_hazards_count": site_state.get("high_risk_hazards_count", 0),
                "project_activity_progress": site_state.get("project_activity_progress", 67),
                "last_updated": time.strftime("%I:%M:%S %p"),
                "updated_at": firestore.SERVER_TIMESTAMP
            }
            doc_ref.set(doc_data, merge=True)
        except Exception as e:
            logger.error(f"[Firebase] Failed to update site metrics: {e}")

    def get_all_hazards(self, limit: int = 60) -> List[Dict[str, Any]]:
        """
        Fetches recorded hazards from Firestore ordered by most recent first.
        """
        if not self.is_connected or not self.db:
            return []

        try:
            docs = self.db.collection("hazards").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit).stream()
            hazards = []
            for d in docs:
                data = d.to_dict()
                if "updated_at" in data:
                    data.pop("updated_at", None)
                hazards.append(data)
            return hazards
        except Exception as e:
            logger.error(f"[Firebase] Failed to query hazards: {e}")
            return []

    def get_all_workers(self) -> List[Dict[str, Any]]:
        """
        Fetches worker roster from Firestore.
        """
        if not self.is_connected or not self.db:
            return []

        try:
            docs = self.db.collection("workers").stream()
            workers = []
            for d in docs:
                data = d.to_dict()
                if "updated_at" in data:
                    data.pop("updated_at", None)
                workers.append(data)
            return sorted(workers, key=lambda x: x.get("id", ""))
        except Exception as e:
            logger.error(f"[Firebase] Failed to query workers: {e}")
            return []

    def get_all_cameras(self) -> List[Dict[str, Any]]:
        """
        Fetches cameras from Firestore.
        """
        if not self.is_connected or not self.db:
            return []

        try:
            docs = self.db.collection("cameras").stream()
            cameras = []
            for d in docs:
                data = d.to_dict()
                if "updated_at" in data:
                    data.pop("updated_at", None)
                cameras.append(data)
            return sorted(cameras, key=lambda x: x.get("id", ""))
        except Exception as e:
            logger.error(f"[Firebase] Failed to query cameras: {e}")
            return []


# Global Singleton Instance
firebase_manager = FirebaseManager()

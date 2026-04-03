import os
import json
import time
import math
import random
import threading
import numpy as np
import websocket
from kafka import KafkaProducer
from dotenv import load_dotenv
from datetime import datetime, timezone
from sklearn.ensemble import IsolationForest

load_dotenv()

print("""
╔══════════════════════════════════════════════════════════════╗
║     🚢 NAVARAKSHAK HYBRID AI ENGINE v9.0 (FINAL) 🚢         ║
║     Real-time AIS Stream + ML Anomaly Detection             ║
║     Realistic Global Ocean Scatter & Chokepoint Generator   ║
╚══════════════════════════════════════════════════════════════╝
""")

AISSTREAM_API_KEY = os.getenv("AISSTREAM_KEY", "YOUR_API_KEY_HERE")

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer): return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        if isinstance(obj, np.bool_): return bool(obj)
        if isinstance(obj, bool): return obj
        return super().default(obj)

try:
    producer = KafkaProducer(
        bootstrap_servers=['localhost:9092'],
        value_serializer=lambda v: json.dumps(v, cls=CustomJSONEncoder).encode('utf-8'),
        compression_type='gzip',
        linger_ms=100,
        batch_size=32768
    )
    print("✅ Kafka Producer Linked to localhost:9092")
except Exception as e:
    print(f"⚠️ Kafka Connection Failed: {e}")
    producer = None

# ─── MACHINE LEARNING AI ENGINE ───
print("🧠 Training Isolation Forest Behavioral Model...")
try:
    training_data = np.array([[float(random.uniform(8, 32)), float(random.uniform(0, 360))] for _ in range(5000)], dtype=np.float64)
    ai_model = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
    ai_model.fit(training_data)
    print("✅ ML Model Trained Successfully")
except Exception as e:
    ai_model = None

# ─── REAL AIS DATA DAEMON ───
def on_message(ws, message):
    try:
        data = json.loads(message)
        if data.get("MessageType") == "PositionReport":
            ship_info = data.get("Message", {}).get("PositionReport", {})
            meta_data = data.get("MetaData", {})
            payload = {
                "id": str(meta_data.get("MMSI", random.randint(10000,99999))),
                "shipName": str(meta_data.get("ShipName", "Unknown Vessel")).strip(),
                "vessel_type": "Real Commercial Vessel",
                "latitude": float(ship_info.get("Latitude", 0)),
                "longitude": float(ship_info.get("Longitude", 0)),
                "speed": float(ship_info.get("Sog", 0)),
                "heading": float(ship_info.get("Cog", 0)),
                "statusText": "✅ SAFE",
                "timestamp": str(datetime.now(timezone.utc).isoformat()),
                "data_source": "REAL_AIS",
                "anomaly_detected": False
            }
            if producer and payload["latitude"] != 0:
                producer.send('live_ship_data', value=payload)
    except Exception: pass

def start_real_ais_stream():
    print("🛰️ Connecting to Real-Time Satellite AIS Stream...")
    def run_ws():
        def on_open(ws):
            sub_msg = {"APIKey": AISSTREAM_API_KEY, "BoundingBoxes": [[[-90, -180], [90, 180]]], "FilterMessageTypes": ["PositionReport"]}
            ws.send(json.dumps(sub_msg))
        ws = websocket.WebSocketApp("wss://stream.aisstream.io/v0/stream", on_message=on_message, on_open=on_open)
        ws.run_forever()
    t = threading.Thread(target=run_ws)
    t.daemon = True
    t.start()

# ─── REALISTIC GLOBAL SCATTER (PREVENTS CLUMPING) ───
OCEAN_ZONES = [
    {"name": "North Atlantic", "lat": (10, 60), "lon": (-70, -10), "count": 700},
    {"name": "South Atlantic", "lat": (-50, 10), "lon": (-50, 15), "count": 600},
    {"name": "Indian Ocean", "lat": (-40, 20), "lon": (40, 100), "count": 800},
    {"name": "North Pacific", "lat": (10, 60), "lon": (130, 180), "count": 600},
    {"name": "North Pacific East", "lat": (10, 60), "lon": (-180, -110), "count": 600},
    {"name": "South Pacific", "lat": (-50, 10), "lon": (-180, -90), "count": 600},
    {"name": "South Pacific West", "lat": (-50, 0), "lon": (130, 180), "count": 400},
    {"name": "Mediterranean", "lat": (30, 45), "lon": (-5, 35), "count": 400},
    {"name": "Arabian Sea", "lat": (10, 25), "lon": (50, 75), "count": 400},
    {"name": "Gulf of Guinea", "lat": (-10, 5), "lon": (-15, 10), "count": 300},
    {"name": "Caribbean Sea", "lat": (10, 25), "lon": (-85, -60), "count": 400},
    {"name": "South China Sea", "lat": (5, 25), "lon": (105, 120), "count": 500},
    {"name": "East China Sea", "lat": (25, 40), "lon": (120, 130), "count": 400},
    {"name": "Sea of Japan", "lat": (35, 46), "lon": (128, 142), "count": 500},
    {"name": "Yellow Sea", "lat": (33, 39), "lon": (118, 126), "count": 400},
    {"name": "Russian Pacific", "lat": (45, 60), "lon": (135, 160), "count": 300},
    {"name": "Bering Sea", "lat": (50, 65), "lon": (-180, -160), "count": 200},
    {"name": "Tasman Sea", "lat": (-45, -25), "lon": (150, 170), "count": 200},
    {"name": "Southern Ocean", "lat": (-65, -50), "lon": (-180, 180), "count": 800},
]

CONFLICT_ZONES = [
    {"name": "Red Sea Blockade", "lat_range": (12, 28), "lon_range": (32, 45), "risk": "CRITICAL"},
    {"name": "Hormuz Tension", "lat_range": (24, 27), "lon_range": (54, 57), "risk": "CRITICAL"},
    {"name": "South China Sea", "lat_range": (5, 20), "lon_range": (110, 120), "risk": "HIGH"},
    {"name": "Black Sea Risk", "lat_range": (41, 47), "lon_range": (27, 40), "risk": "HIGH"}
]

def get_risk_status(lat, lon, is_ml_anomaly):
    for zone in CONFLICT_ZONES:
        if zone["lat_range"][0] <= lat <= zone["lat_range"][1] and zone["lon_range"][0] <= lon <= zone["lon_range"][1]:
            return f"🔴 CRITICAL: {zone['name']}" if zone["risk"] == "CRITICAL" else f"⚠️ HIGH RISK: {zone['name']}"
    if is_ml_anomaly: return "🔴 CRITICAL: AI Behavior Anomaly"
    return "✅ SAFE"

def start_simulation_engine():
    ships = []
    ship_prefixes = ["MSC", "MAERSK", "CMA CGM", "COSCO", "HAPAG-LLOYD", "ONE", "EVERGREEN", "HYUNDAI", "ZIM"]
    
    for zone in OCEAN_ZONES:
        for i in range(zone["count"]):
            ships.append({
                "id": f"SIM-{zone['name'][:3]}-{i}{random.randint(100,999)}",
                "name": f"{random.choice(ship_prefixes)} VOYAGER {random.randint(100,999)}",
                "vessel_type": random.choice(["Container Ship", "Oil Tanker", "Bulk Carrier"]),
                "lat": float(random.uniform(zone["lat"][0], zone["lat"][1])),
                "lon": float(random.uniform(zone["lon"][0], zone["lon"][1])),
                "speed": float(random.uniform(8, 24)),
                "base_speed": float(random.uniform(8, 24)),
                "heading": float(random.uniform(0, 360)),
                "anomalous": False
            })

    print(f"✅ Generated {len(ships)} Realistically Scattered Global Ships")
    last_time = time.time()
    
    while True:
        delta = min(time.time() - last_time, 2.0)
        last_time = time.time()
        
        for ship in ships:
            try:
                # ML Anomaly Injection
                if not ship["anomalous"] and random.random() < 0.0002:
                    ship["anomalous"] = True
                    ship["speed"] = random.uniform(0, 3)
                elif not ship["anomalous"]:
                    ship["speed"] = ship["base_speed"]
                    ship["heading"] = (ship["heading"] + random.uniform(-2, 2)) % 360
                    
                move_deg = ship["speed"] * 0.000008 * delta
                ship["lat"] += move_deg * math.cos(math.radians(ship["heading"]))
                ship["lon"] += move_deg * math.sin(math.radians(ship["heading"]))

                if ship["lat"] > 85: ship["lat"] = -85
                if ship["lat"] < -85: ship["lat"] = 85
                if ship["lon"] > 180: ship["lon"] = -180
                if ship["lon"] < -180: ship["lon"] = 180

                is_anomaly = False
                if ai_model:
                    pred = ai_model.predict(np.array([[ship["speed"], ship["heading"]]], dtype=np.float64))
                    is_anomaly = bool(pred[0] == -1)

                payload = {
                    "id": ship["id"], "shipName": ship["name"], "vessel_type": ship["vessel_type"],
                    "latitude": round(ship["lat"], 5), "longitude": round(ship["lon"], 5),
                    "speed": round(ship["speed"], 1), "heading": round(ship["heading"], 1),
                    "statusText": get_risk_status(ship["lat"], ship["lon"], is_anomaly or ship["anomalous"]),
                    "timestamp": str(datetime.now(timezone.utc).isoformat()),
                    "data_source": "SIMULATED", "anomaly_detected": is_anomaly
                }
                if producer: producer.send('live_ship_data', value=payload)
            except Exception: pass
        
        time.sleep(3)

if __name__ == "__main__":
    start_real_ais_stream()
    start_simulation_engine()
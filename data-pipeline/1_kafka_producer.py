import os
import websocket
import json
import time
import math
import random
import threading
from kafka import KafkaProducer
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

print("Initializing Advanced Global Maritime Digital Twin...")

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

API_KEY = os.getenv("AISSTREAM_KEY")

# ==========================================
# ENGINE 1: REAL AIS STREAM LISTENER
# ==========================================
def on_message(ws, message):
    data = json.loads(message)
    if data.get("MessageType") == "PositionReport":
        ship_info = data.get("Message", {}).get("PositionReport", {})
        meta_data = data.get("MetaData", {})
        
        payload = {
            "ship_id": meta_data.get("MMSI"),
            "ship_name": meta_data.get("ShipName", "Unknown").strip(),
            "vessel_type": "Real Commercial Vessel", 
            "destination": "Tracking Active",
            "latitude": ship_info.get("Latitude"),
            "longitude": ship_info.get("Longitude"),
            "speed": ship_info.get("Sog"),
            "heading": ship_info.get("Cog", 0), 
            "statusText": "✅ SAFE", # Real ships default to safe unless caught by Spark processor
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "data_source": "REAL_AIS"
        }
        producer.send('live_ship_data', value=payload)

def on_error(ws, error): print(f"❌ WebSocket Error: {error}")
def on_close(ws, close_status_code, close_msg): print("🛑 Connection Closed.")

def on_open(ws):
    print("✅ Connected! Requesting Strategic Real Traffic...")
    sub_msg = {
        "APIKey": API_KEY,
        "BoundingBoxes": [
            [[18.5, 72.5], [19.5, 73.5]],   # Mumbai
            [[29.0, 32.0], [32.0, 33.5]],   # Suez Canal
            [[24.0, 54.0], [26.0, 56.0]],   # Dubai
            [[1.0, 103.0], [2.0, 104.5]],   # Singapore
            [[50.0, 0.0], [52.0, 3.0]]      # English Channel
        ], 
        "FilterMessageTypes": ["PositionReport"]
    }
    ws.send(json.dumps(sub_msg))

def start_real_ais_stream():
    ws = websocket.WebSocketApp("wss://stream.aisstream.io/v0/stream", on_message=on_message, on_error=on_error, on_close=on_close, on_open=on_open)
    ws.run_forever(ping_interval=15, ping_timeout=10)

# ==========================================
# ENGINE 2: DATA-DRIVEN ROUTE SIMULATOR
# ==========================================
# Calculates compass heading between two coordinates
def get_heading(lat1, lon1, lat2, lon2):
    dLon = math.radians(lon2 - lon1)
    y = math.sin(dLon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dLon)
    brng = math.degrees(math.atan2(y, x))
    return (brng + 360) % 360

# Distance in degrees approx
def get_distance(lat1, lon1, lat2, lon2):
    return math.sqrt((lat2 - lat1)**2 + (lon2 - lon1)**2)

def start_simulation_engine():
    print("🚀 Starting Data-Driven Maritime Route Simulation...")
    
    # 🌍 CORE ROUTE DEFINITIONS (From User Spec)
    routes = [
        {
            "route_name": "Asia-Europe Main", "ships_per_day": 80,
            "coordinates": [[31.0, 32.0], [25.0, 45.0], [20.0, 60.0], [15.0, 70.0], [10.0, 75.0], [5.0, 80.0], [1.0, 103.0]],
            "ports": ["Suez", "Dubai", "Mumbai", "Colombo", "Singapore"],
            "ship_types": ["Container", "Oil Tanker", "Bulk Carrier"]
        },
        {
            "route_name": "Strait of Hormuz", "ships_per_day": 120,
            "coordinates": [[26.5, 56.0], [25.5, 55.0], [24.5, 54.0], [24.0, 52.0]],
            "ports": ["Dubai", "Abu Dhabi", "Bandar Abbas"],
            "ship_types": ["Oil Tanker", "LNG Carrier"]
        },
        {
            "route_name": "Strait of Malacca", "ships_per_day": 200,
            "coordinates": [[1.0, 103.0], [2.5, 102.0], [4.0, 100.0], [5.5, 99.0]],
            "ports": ["Singapore", "Port Klang"],
            "ship_types": ["Container", "Bulk", "Oil Tanker"]
        },
        {
            "route_name": "Indian Ocean Corridor", "ships_per_day": 150,
            "coordinates": [[25.0, 55.0], [20.0, 65.0], [15.0, 70.0], [10.0, 75.0], [5.0, 80.0], [1.0, 103.0]],
            "ports": ["Mumbai", "Kochi", "Colombo", "Singapore"],
            "ship_types": ["Container", "Oil Tanker"]
        },
        {
            "route_name": "Bab-el-Mandeb", "ships_per_day": 60,
            "coordinates": [[12.5, 43.0], [13.0, 45.0]],
            "ports": ["Djibouti", "Aden"],
            "ship_types": ["Container", "Oil Tanker"]
        },
        {
            "route_name": "Panama Canal", "ships_per_day": 35,
            "coordinates": [[9.0, -79.5], [9.2, -79.8]],
            "ports": ["Panama"],
            "ship_types": ["Container", "Bulk"]
        },
        {
            "route_name": "North Atlantic", "ships_per_day": 180,
            "coordinates": [[40.0, -74.0], [45.0, -30.0], [50.0, -10.0]],
            "ports": ["New York", "Rotterdam", "London"],
            "ship_types": ["Container", "Bulk"]
        }
    ]
    
    ship_prefixes = ["MSC", "MAERSK", "CMA CGM", "EVER", "HAPAG", "COSCO", "ONE", "FRONT", "BW", "OOCL"]
    ghost_ships = []
    
    # Instantiate Ships perfectly mapped along the paths
    for r_idx, route in enumerate(routes):
        num_ships = int(route["ships_per_day"] / 1.5) # Density formula
        for i in range(num_ships):
            v_type = random.choice(route["ship_types"])
            
            # Physics Engine: Tankers are slow, Containers are fast
            if "Tanker" in v_type or "LNG" in v_type: speed = random.uniform(10.0, 15.0)
            elif "Container" in v_type: speed = random.uniform(18.0, 24.0)
            else: speed = random.uniform(12.0, 18.0)
            
            # Pick a random segment on the multi-point route
            seg_idx = random.randint(0, len(route["coordinates"]) - 2)
            p1 = route["coordinates"][seg_idx]
            p2 = route["coordinates"][seg_idx + 1]
            
            # Place ship randomly along that segment
            fraction = random.uniform(0.0, 1.0)
            lat = p1[0] + (p2[0] - p1[0]) * fraction
            lon = p1[1] + (p2[1] - p1[1]) * fraction
            
            # Lateral drift to create lanes, not lines
            lat += random.uniform(-0.8, 0.8)
            lon += random.uniform(-0.8, 0.8)
            
            ghost_ships.append({
                "id": f"SIM-IMO-{r_idx}{i}{9000}",
                "name": f"{random.choice(ship_prefixes)} {random.choice(['APOLLO', 'PIONEER', 'VOYAGER', 'TITAN', 'EXPLORER', 'STAR'])}",
                "vessel_type": v_type,
                "destination": random.choice(route["ports"]),
                "route_obj": route,
                "seg_idx": seg_idx,
                "lat": lat,
                "lon": lon,
                "speed": speed
            })

    # The Core Physics & Update Loop
    last_time = time.time()
    while True:
        current_time = time.time()
        delta_time = current_time - last_time
        last_time = current_time
        
        for ship in ghost_ships:
            # Find current target waypoint
            p2 = ship["route_obj"]["coordinates"][ship["seg_idx"] + 1]
            heading = get_heading(ship["lat"], ship["lon"], p2[0], p2[1])
            
            # Move ship based on speed and time elapsed
            # 1 knot = ~0.0000046 degrees per second
            move_deg = ship["speed"] * 0.0000046 * delta_time
            ship["lat"] += move_deg * math.cos(math.radians(heading))
            ship["lon"] += move_deg * math.sin(math.radians(heading))
            
            # Check if reached waypoint. If so, move to next segment.
            if get_distance(ship["lat"], ship["lon"], p2[0], p2[1]) < 0.2:
                ship["seg_idx"] += 1
                if ship["seg_idx"] >= len(ship["route_obj"]["coordinates"]) - 1:
                    ship["seg_idx"] = 0 # Loop back to start to keep the simulation running forever
                    ship["lat"] = ship["route_obj"]["coordinates"][0][0]
                    ship["lon"] = ship["route_obj"]["coordinates"][0][1]

            # ==========================================
            # DYNAMIC GEOPOLITICAL AI RISK ENGINE
            # ==========================================
            risk_status = "✅ SAFE"
            
            # Red Sea / Bab-el-Mandeb War Zone (Houthi Threat)
            if 12.0 <= ship["lat"] <= 20.0 and 38.0 <= ship["lon"] <= 45.0:
                risk_status = "🚨 CRITICAL (WAR RISK ZONE)"
            # Strait of Hormuz (Iran/Israel Tension)
            elif 24.0 <= ship["lat"] <= 27.0 and 54.0 <= ship["lon"] <= 57.0:
                risk_status = "🚨 CRITICAL (NAVAL TENSION)"
            # Bay of Bengal (Cyclone)
            elif 10.0 <= ship["lat"] <= 20.0 and 80.0 <= ship["lon"] <= 95.0:
                risk_status = "⚠️ HIGH RISK (SEVERE CYCLONE)"
            # Port Delays
            elif ship["speed"] < 12.0 and "Tanker" not in ship["vessel_type"]:
                risk_status = "🟡 DELAYED (PORT CONGESTION)"
            
            payload = {
                "ship_id": ship["id"],
                "ship_name": ship["name"],
                "vessel_type": ship["vessel_type"],
                "destination": ship["destination"],
                "latitude": round(ship["lat"], 4),
                "longitude": round(ship["lon"], 4),
                "speed": round(ship["speed"], 1),
                "heading": round(heading, 1),
                "statusText": risk_status,
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                "data_source": "SIMULATED"
            }
            
            producer.send('live_ship_data', value=payload)
            if random.random() < 0.002: 
                print(f"👻 [SIM] {payload['ship_name']} | {risk_status} | Speed: {payload['speed']}kts")
        
        time.sleep(3) # Pulse to backend every 3 seconds

if __name__ == "__main__":
    sim_thread = threading.Thread(target=start_simulation_engine, daemon=True)
    sim_thread.start()
    start_real_ais_stream()
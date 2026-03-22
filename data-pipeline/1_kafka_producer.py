import os
import websocket
import json
from kafka import KafkaProducer
from dotenv import load_dotenv

load_dotenv()

print("Initializing Kafka Producer...")

# Connect to the local Kafka Docker container
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

# Paste your API Key here again!
API_KEY = os.getenv("AISSTREAM_KEY")
def on_message(ws, message):
    data = json.loads(message)
    
    if data.get("MessageType") == "PositionReport":
        ship_info = data.get("Message", {}).get("PositionReport", {})
        meta_data = data.get("MetaData", {})
        
        payload = {
            "ship_id": meta_data.get("MMSI"),
            "ship_name": meta_data.get("ShipName", "Unknown").strip(),
            "latitude": ship_info.get("Latitude"),
            "longitude": ship_info.get("Longitude"),
            "speed": ship_info.get("Sog"),
            "timestamp": meta_data.get("time_utc")
        }
        
        print(f"🚢 Sent to Kafka: {payload['ship_name']} at [{payload['latitude']}, {payload['longitude']}]", flush=True)
        producer.send('live_ship_data', value=payload)

def on_error(ws, error):
    print(f"❌ WebSocket Error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("🛑 Connection Closed by Server.")

def on_open(ws):
    print("✅ Connected! Requesting English Channel traffic...")
    
    # Requesting Strait of Malacca & Bay of Bengal (Busiest global shipping lane)
    sub_msg = {
        "APIKey": API_KEY,
        "BoundingBoxes": [[[0.0, 80.0], [20.0, 105.0]]], 
        "FilterMessageTypes": ["PositionReport"]
    }
    ws.send(json.dumps(sub_msg))

if __name__ == "__main__":
    print("Starting Live Supply Chain Feed...")
    ws = websocket.WebSocketApp("wss://stream.aisstream.io/v0/stream",
                                on_message=on_message,
                                on_error=on_error,
                                on_close=on_close,
                                on_open=on_open)
    
    # Added a heartbeat ping to stop the server from dropping us
    ws.run_forever(ping_interval=15, ping_timeout=10)
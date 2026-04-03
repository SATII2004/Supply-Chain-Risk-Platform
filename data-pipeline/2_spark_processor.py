#!/usr/bin/env python3
"""
NavaRakshak AI Risk Processor
- Consumes Kafka topic 'maritime.ships'
- Fetches live weather data (OpenWeatherMap)
- Applies ML delay prediction model (if available)
- Writes enriched ship data to MongoDB
- Sends Telegram alerts for CRITICAL threats
"""

import os
import json
import pickle
import pandas as pd
import requests
from kafka import KafkaConsumer
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# ==========================================
# 🔧 CONFIGURATION
# ==========================================
KAFKA_TOPIC = 'maritime.ships'          # Must match your producer topic
KAFKA_BOOTSTRAP = ['localhost:9092']

MONGO_URI = 'mongodb://127.0.0.1:27017/'
MONGO_DB = 'supply_chain_db'
MONGO_COLLECTION = 'real_time_alerts'   # Matches Spring Boot reading collection

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

ML_MODEL_PATH = 'supply_chain_risk_model.pkl'   # Optional – if not present, skip ML

# ==========================================
# 🔌 INITIALIZE CLIENTS
# ==========================================
# MongoDB
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
collection = db[MONGO_COLLECTION]
# Ensure index for fast lookups (optional)
collection.create_index([("shipName", ASCENDING)], unique=False)

# Kafka Consumer
consumer = KafkaConsumer(
    KAFKA_TOPIC,
    bootstrap_servers=KAFKA_BOOTSTRAP,
    auto_offset_reset='latest',
    enable_auto_commit=True,
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

# Load ML model (if exists)
model = None
try:
    with open(ML_MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    logger.info("✅ ML risk model loaded.")
except FileNotFoundError:
    logger.warning("⚠️ ML model not found. Risk assessment will rely on weather only.")
except Exception as e:
    logger.error(f"ML model load error: {e}")

# Pre‑fetch global news crisis flag (runs once)
crisis_active = False
if NEWS_API_KEY:
    try:
        news_url = f"https://newsdata.io/api/1/news?apikey={NEWS_API_KEY}&q=war OR strike OR blockade OR pirate OR conflict"
        resp = requests.get(news_url, timeout=10).json()
        if resp.get("status") == "success" and len(resp.get("results", [])) > 0:
            crisis_active = True
            logger.info("🌍 Geopolitical crisis detected in news feeds.")
    except Exception as e:
        logger.warning(f"News API error: {e}")
else:
    logger.info("News API key missing – skipping geopolitical flag.")

logger.info("🚢 Risk Processor started. Listening to Kafka topic '%s'", KAFKA_TOPIC)

# ==========================================
# 🧠 HELPER FUNCTIONS
# ==========================================
def get_weather(lat, lon):
    """Fetch current weather and wind speed (knots) from OpenWeatherMap."""
    if not WEATHER_API_KEY:
        return "No API key", 0.0
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=metric"
        data = requests.get(url, timeout=5).json()
        if data.get("cod") == 200:
            wind_ms = data["wind"]["speed"]          # m/s
            wind_kts = wind_ms * 1.94384
            desc = data["weather"][0]["description"]
            return desc, round(wind_kts, 1)
        else:
            return "Weather unavailable", 0.0
    except Exception:
        return "Weather fetch failed", 0.0

def predict_risk_ml(speed):
    """Dummy ML prediction – replace with your actual model input."""
    if model is None:
        return 0  # no model -> assume safe
    # Build feature vector – adapt to your model's expected columns
    features = pd.DataFrame([{
        'Type': 1,
        'Shipping Mode': 2 if speed > 15 else 1,
        'Category Name': 3,
        'Order Region': 4,
        'Order Country': 5,
        'Order Item Quantity': 100,
        'Product Price': 500.0
    }])
    return int(model.predict(features)[0])  # 0 = safe, 1 = risk

def send_telegram_alert(ship_name, lat, lon, risk_text, weather_desc, wind_kts):
    """Send urgent alert to Telegram channel."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    msg = (
        f"🚨 **URGENT FLEET ALERT** 🚨\n\n"
        f"🚢 Vessel: `{ship_name}`\n"
        f"📍 Coordinates: {lat}, {lon}\n"
        f"⚠️ Risk: {risk_text}\n"
        f"⛈️ Weather: {weather_desc.title()} ({wind_kts} kts wind)\n\n"
        f"**ACTION REQUIRED** – Contact Fleet Operations immediately."
    )
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        requests.post(url, data={"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "Markdown"}, timeout=5)
        logger.info(f"📡 Telegram alert sent for {ship_name}")
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")

# ==========================================
# 🔁 MAIN PROCESSING LOOP
# ==========================================
for msg in consumer:
    ship = msg.value

    # Extract fields (match Kafka producer structure)
    ship_name = ship.get('shipName')
    lat = ship.get('latitude')
    lon = ship.get('longitude')
    speed = ship.get('speed', 0)
    heading = ship.get('heading', 0)
    original_status = ship.get('statusText', '✅ SAFE')

    if not ship_name or ship_name == "Unknown" or speed < 0.5:
        continue   # ignore invalid or stationary entries

    # 1. Get weather
    weather_desc, wind_kts = get_weather(lat, lon)
    weather_str = f"{weather_desc} ({wind_kts} kts wind)"

    # 2. ML risk prediction (0 = safe, 1 = risk)
    ml_risk = predict_risk_ml(speed)

    # 3. Determine final risk level
    risk_level = "✅ SAFE"
    if wind_kts > 30:
        risk_level = "🚨 CRITICAL RISK (SEVERE WEATHER)"
    elif crisis_active and ml_risk == 1:
        risk_level = "🚨 HIGH RISK (GEOPOLITICAL ZONE)"
    elif ml_risk == 1 or speed < 5.0:
        risk_level = "⚠️ MODERATE RISK (ML DELAY PREDICTED)"
    else:
        risk_level = original_status   # keep existing if already critical/high

    # 4. Prepare enriched document
    enriched_ship = {
        "shipName": ship_name,
        "latitude": lat,
        "longitude": lon,
        "speed": speed,
        "heading": heading,
        "statusText": risk_level,
        "weather": weather_str,
        "vessel_type": ship.get('vessel_type', 'Unknown'),
        "timestamp": ship.get('timestamp'),
        "risk_assessment": 2 if "CRITICAL" in risk_level else (1 if "HIGH" in risk_level or ml_risk == 1 else 0)
    }

    # 5. Store in MongoDB (upsert by shipName + timestamp? Use replace with timestamp)
    #    Here we simply insert – the Java backend will fetch latest via /api/alerts/live.
    try:
        collection.insert_one(enriched_ship)
        logger.info(f"✅ [{ship_name}] speed={speed}kts | {weather_desc} | {risk_level}")
    except Exception as e:
        logger.error(f"MongoDB insert failed: {e}")

    # 6. Send Telegram for CRITICAL risks
    if "CRITICAL" in risk_level:
        send_telegram_alert(ship_name, lat, lon, risk_level, weather_desc, wind_kts)
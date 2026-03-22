import os
import json
import pickle
import pandas as pd
import requests
from kafka import KafkaConsumer
from pymongo import MongoClient
from dotenv import load_dotenv

# Load the hidden keys from the .env file
load_dotenv()

print("Initializing Advanced AI Risk Processor...")

# ==========================================
# 🔒 SECURE API KEYS
# ==========================================
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# 1. Connect to MongoDB (Using 27027 to match your Java Override)
try:
    mongo_client = MongoClient('mongodb://127.0.0.1:27017/', serverSelectionTimeoutMS=5000)
    db = mongo_client['supply_chain_db']
    alerts_collection = db['real_time_alerts']
except Exception as e:
    print(f"❌ MONGODB ERROR: {e}")
    exit()

# 2. Load ML Brain
with open('supply_chain_risk_model.pkl', 'rb') as file:
    model = pickle.load(file)

# 3. Cache Global Geopolitical News (Run Once to save API limits)
print("🌍 Scanning Global Geopolitical Intelligence...")
crisis_active = False
try:
    news_url = f"https://newsdata.io/api/1/news?apikey={NEWS_API_KEY}&q=war OR strike OR blockade OR pirate OR conflict"
    news_response = requests.get(news_url).json()
    if news_response.get("status") == "success" and len(news_response.get("results", [])) > 0:
        crisis_active = True
        print("⚠️ Geopolitical Crisis Detected in global news feeds.")
except Exception as e:
    print("News API skipped or failed.")

# 4. Connect to Kafka
consumer = KafkaConsumer(
    'live_ship_data',
    bootstrap_servers=['localhost:9092'],
    auto_offset_reset='latest',
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

print("\n✅ SYSTEM ONLINE. Monitoring global fleet...\n")

# 5. The Processing Loop
for message in consumer:
    ship_data = dict(message.value)
    ship_name = ship_data.get('ship_name')
    speed = ship_data.get('speed', 0)
    lat = ship_data.get('latitude')
    lon = ship_data.get('longitude')
    
    if not ship_name or ship_name == "Unknown" or speed < 1.0:
        continue

    # A. Run Base ML Prediction
    simulated_features = pd.DataFrame([{
        'Type': 1, 'Shipping Mode': 2 if speed > 15 else 1, 'Category Name': 3,      
        'Order Region': 4, 'Order Country': 5, 'Order Item Quantity': 100, 'Product Price': 500.0   
    }])
    ml_prediction = int(model.predict(simulated_features)[0])
    
    risk_level = "✅ SAFE"
    weather_desc = "Clear"
    wind_speed = 0.0

    # B. Tiered Logic: Only check weather if ML predicts risk OR ship is very slow
    if ml_prediction == 1 or speed < 5.0:
        try:
            weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=metric"
            weather_data = requests.get(weather_url).json()
            
            if weather_data.get("cod") == 200:
                wind_speed = weather_data["wind"]["speed"] * 1.94384 # Convert m/s to knots
                weather_desc = weather_data["weather"][0]["description"]
                
                # Upgrade to CRITICAL if weather is severe (>30 knots wind)
                if wind_speed > 30.0:
                    risk_level = "🚨 CRITICAL RISK (SEVERE WEATHER)"
                elif crisis_active:
                    risk_level = "🚨 HIGH RISK (GEOPOLITICAL ZONE)"
                else:
                    risk_level = "⚠️ MODERATE RISK (ML DELAY PREDICTED)"
        except Exception as e:
            risk_level = "⚠️ MODERATE RISK (ML DELAY PREDICTED)"

    # C. Save to Database
    ship_data['risk_assessment'] = 2 if "CRITICAL" in risk_level else ml_prediction
    ship_data['status_text'] = risk_level
    ship_data['weather'] = f"{weather_desc} ({round(wind_speed, 1)} kts wind)"
    
    if '_id' in ship_data:
        del ship_data['_id']
    alerts_collection.insert_one(ship_data)
    
    print(f"[{ship_name}] Speed: {speed}kts | Weather: {weather_desc} | Status: {risk_level}")

    # D. Simulate SATCOM Transmission (Telegram) ONLY for Critical Risks
    if "CRITICAL" in risk_level:
        print(f"📡 TRANSMITTING SATCOM ALERT TO {ship_name}...")
        telegram_msg = (
            f"🚨 URGENT FLEET ALERT 🚨\n\n"
            f"🚢 Vessel: {ship_name}\n"
            f"📍 Coordinates: {lat}, {lon}\n"
            f"⚠️ Reason: {risk_level}\n"
            f"⛈️ Weather: {weather_desc.title()} ({round(wind_speed, 1)} knots wind)\n\n"
            f"ACTION REQUIRED: Contact Fleet Operations immediately."
        )
        try:
            requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                data={"chat_id": TELEGRAM_CHAT_ID, "text": telegram_msg}
            )
        except Exception as e:
            print("SATCOM failure.")
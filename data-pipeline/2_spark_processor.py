import json
import pickle
import pandas as pd
from kafka import KafkaConsumer
from pymongo import MongoClient

print("Initializing Real-Time Stream Processor...")

# 1. Connect to MongoDB
try:
    mongo_client = MongoClient('mongodb://127.0.0.1:27017/', serverSelectionTimeoutMS=5000)
    db = mongo_client['supply_chain_db']
    alerts_collection = db['real_time_alerts']
    
    # FORCE A TEST INSERT TO WAKE UP MONGODB
    alerts_collection.insert_one({"system_status": "MongoDB Connection Successful"})
    print("✅ Successfully connected and wrote test data to MongoDB!")
except Exception as e:
    print(f"❌ CRITICAL MONGODB ERROR: {e}")
    exit()

# 2. Load the AI Brain (XGBoost Model)
print("Loading Machine Learning Model...")
with open('supply_chain_risk_model.pkl', 'rb') as file:
    model = pickle.load(file)

# 3. Connect to the Kafka Topic
print("Connecting to Kafka Topic 'live_ship_data'...")
consumer = KafkaConsumer(
    'live_ship_data',
    bootstrap_servers=['localhost:9092'],
    auto_offset_reset='latest',
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

print("✅ System Online. Waiting for ships...\n")

# 4. Process the Stream
for message in consumer:
    # Create a fresh copy of the dictionary to avoid BSON _id conflicts
    ship_data = dict(message.value) 
    ship_name = ship_data.get('ship_name')
    speed = ship_data.get('speed', 0)
    
    if not ship_name or ship_name == "Unknown" or speed < 1.0:
        continue

    simulated_features = pd.DataFrame([{
        'Type': 1,               
        'Shipping Mode': 2 if speed > 15 else 1, 
        'Category Name': 3,      
        'Order Region': 4,       
        'Order Country': 5,      
        'Order Item Quantity': 100, 
        'Product Price': 500.0   
    }])
    
    prediction = model.predict(simulated_features)[0]
    risk_status = "🚨 HIGH RISK (DELAY PREDICTED)" if prediction == 1 else "✅ SAFE"
    
    # Force cast to native Python types so MongoDB doesn't crash on numpy datatypes
    ship_data['risk_assessment'] = int(prediction)
    ship_data['status_text'] = str(risk_status)
    
    # 5. Save to MongoDB with strict error catching
    try:
        # If Kafka re-sends a message, we must remove the old Mongo ID or it will crash
        if '_id' in ship_data:
            del ship_data['_id']
            
        alerts_collection.insert_one(ship_data)
        print(f"[{ship_name}] Speed: {speed} knots -> {risk_status} (💾 SAVED TO DB)")
    except Exception as e:
        print(f"❌ FAILED TO SAVE [{ship_name}] TO MONGODB: {e}")
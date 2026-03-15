import json
import websocket
import ssl

API_KEY = "91e9d7bd12bafc12bbfee51bdcce57ae6676e087"

def on_message(ws, message):
    print("\n🚢 SUCCESS! WE GOT DATA:\n", message[:200], "...\n")
    ws.close() # Close immediately after proving it works

def on_error(ws, error):
    print(f"\n❌ Error Caught: {error}")

def on_close(ws, close_status_code, close_msg):
    print(f"\n🛑 Connection Closed by Server.")
    print(f"Status Code: {close_status_code}")
    print(f"Message: {close_msg}")

def on_open(ws):
    print("✅ Connection Opened! Sending authentication...")
    # We are using a global bounding box just to guarantee we hit a ship instantly
    sub_msg = {
        "APIKey": API_KEY,
        "BoundingBoxes": [[[-90.0, -180.0], [90.0, 180.0]]], 
        "FilterMessageTypes": ["PositionReport"]
    }
    ws.send(json.dumps(sub_msg))

if __name__ == "__main__":
    print("Starting Diagnostic Trace...")
    # Turn on deep network debugging
    websocket.enableTrace(True) 
    
    ws = websocket.WebSocketApp("wss://stream.aisstream.io/v0/stream",
                                on_message=on_message,
                                on_error=on_error,
                                on_close=on_close,
                                on_open=on_open)
    
    # Run with SSL verification bypassed to rule out Windows cert issues
    ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
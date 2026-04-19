from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

app = Flask(
    __name__,
    static_folder='../frontend',
    template_folder='../frontend'
)
CORS(app)
# ALERT STORAGE & dispatch tracking:
ALERTS = []
LAST_DISPATCH = {}
# CITY MAP (Graph Simulation)
CITY_MAP = {
    "Koramangala": ["Silk Board", "Indiranagar"],
    "Silk Board": ["Koramangala", "BTM"],
    "BTM": ["Silk Board", "Jayanagar"],
    "Jayanagar": ["BTM", "MG Road"],
    "MG Road": ["Jayanagar", "Indiranagar"],
    "Indiranagar": ["Koramangala", "MG Road"]
}

LOCATION_ALIASES = {
    "koramangala": "Koramangala",
    "silk board": "Silk Board",
    "btm": "BTM",
    "jayanagar": "Jayanagar",
    "mg road": "MG Road",
    "indiranagar": "Indiranagar",
    "whitefield": "Indiranagar",
    "manipal hospital": "Indiranagar",
    "st. john's hospital": "Koramangala",
    "st john's hospital": "Koramangala",
    "fortis hospital": "Jayanagar",
    "apollo hospital": "MG Road",
    "victoria hospital": "MG Road",
    "narayana health": "Silk Board"
}

def normalize_location(value):
    if not value:
        return value

    text = str(value).strip()
    lower_text = text.lower()

    for needle, node in LOCATION_ALIASES.items():
        if needle in lower_text:
            return node

    return text.split('(')[0].strip()

def get_request_data():
    return request.get_json(silent=True) or {}
# ROUTE FINDING (BFS)
def find_route(start, end):
    visited = set()
    queue = [[start]]

    while queue:
        path = queue.pop(0)
        node = path[-1]

        if node == end:
            return path

        if node not in visited:
            visited.add(node)

            for neighbor in CITY_MAP.get(node, []):
                new_path = list(path)
                new_path.append(neighbor)
                queue.append(new_path)

    return [start, end]  # fallback

# AI DECISION ENGINE:
def ai_signal_decision(distance):
    if distance == 0:
        return "GREEN"
    elif distance == 1:
        return "GREEN"
    elif distance == 2:
        return "PREPARE"
    else:
        return "RED"

# SMART SIGNAL + ZONE AWARE LOGIC
def get_signals(route):
    if not route:
        return []

    signals = []

    # Get zone locations (first 3 points)
    zone_locations = route[:3]

    for i, location in enumerate(route):
        distance = i

        if location in zone_locations:
            if distance == 0:
                state = ai_signal_decision(distance)
                priority = "HIGH"
            elif distance == 1:
                state = ai_signal_decision(distance)
                priority = "HIGH"
            else:
                state = "PREPARE"
                priority = "MEDIUM"
        else:
            state = "RED"
            priority = "LOW"

        signals.append({
            "junction": location,
            "signal": state,
            "priority": priority,
            "distance": distance,
            "zone_affected": location in zone_locations
        })

    return signals
# PREDICTIVE DECISION ENGINE
def predict_next_action(route):
    if not route or len(route) < 2:
        return "No prediction available"

    next_location = route[1]

    return f"Prepare clearance at {next_location} and pre-activate signals"
# ZONE(1km RADIUS SIMULATION):-
# # DYNAMIC ZONE SYSTEM
def get_zone(route):
    if route is None:
        return []

    if isinstance(route, str):
        route = [route]

    zones = []

    for i, location in enumerate(route):
        if i <= 2:  # only near future path
            zones.append({
                "center": location,
                "radius": "1km",
                "status": "ACTIVE",
                "priority": "HIGH" if i == 0 else "MEDIUM"
            })

    return zones
from flask import send_from_directory

@app.route('/')
def serve_index():
    return send_from_directory(app.template_folder, 'index.html')
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/dispatch', methods=['POST'])
def dispatch():
    try:
        data = get_request_data()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        origin = normalize_location(data.get("origin"))
        destination = normalize_location(data.get("destination"))

        if not origin or not destination:
            return jsonify({"error": "Origin and destination are required"}), 400

        route = find_route(origin, destination)
        eta = f"{len(route) * 2} mins"
        # Save latest dispatch
        global LAST_DISPATCH
        LAST_DISPATCH = {
            "origin": origin,
            "destination": destination,
            "route": route,
            "eta": eta
        }
        # STRUCTURED ALERT SYSTEM
        alerts = []
        ambulance_id = f"AMB-{len(ALERTS)+1:02d}"
        alerts.append({
            "type": "DISPATCH",
            "message": f"{ambulance_id} dispatched from {origin} → {destination}",
            "eta": eta
        })

        for loc in route:
            alerts.append({
                "type": "SIGNAL",
                "message": f"Signal cleared at {loc}",
                "location": loc
            })

        alerts.append({
            "type": "ZONE",
            "message": f"1km zone activated along route",
            "coverage": route[:3]
        })
        ALERTS.extend(alerts)
        return jsonify({
            "success": True,
            "ambulance": ambulance_id,
            "route": route,
            "eta": eta,
            "signals": get_signals(route),
            "zone": get_zone(route),
            "prediction": predict_next_action(route),
            "status": "dispatched"
        })
    except Exception as e:
        print(f"Error in dispatch: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/signals', methods=['POST'])
def signals():
    data = get_request_data()
    route = data.get("route", [])

    return jsonify({
        "signals": get_signals(route)
    })
@app.route('/zone', methods=['POST'])
def zone():
    data = get_request_data()
    location = normalize_location(data.get("location"))

    return jsonify({
        "zone": get_zone(location)
    })
@app.route('/alerts', methods=['GET'])
def get_alerts():
    return jsonify({
        "alerts": ALERTS[-20:]  # last 20 alerts
    })
#AI Assistant ADD
@app.route('/ai', methods=['POST'])
def ai_assistant():
    try:
        data = get_request_data()
        message = data.get("message", "").lower()

        # 🔥 CASE 1: LOCATION
        if "location" in message:
            return jsonify({
                "response": "Location detected via frontend. Use map for precise view."
            })

        # 🔥 CASE 2: ROUTE
        elif "route" in message or "fastest" in message:
            if LAST_DISPATCH:
                route = " → ".join(LAST_DISPATCH["route"])
                eta = LAST_DISPATCH["eta"]
                return jsonify({
                    "response": f"Fastest route: {route} (ETA: {eta})"
                })
            else:
                return jsonify({
                    "response": "No active dispatch. Please simulate first."
                })

        # 🔥 CASE 3: CORRIDOR
        elif "corridor" in message:
            if LAST_DISPATCH:
                return jsonify({
                    "response": f"Active corridor from {LAST_DISPATCH['origin']} to {LAST_DISPATCH['destination']}"
                })
            else:
                return jsonify({
                    "response": "No active corridor."
                })

        # 🔥 CASE 4: SYSTEM WORKING
        elif "how" in message or "work" in message:
            return jsonify({
                "response": "The system creates a moving 1km predictive zone, clears signals ahead, and optimizes ambulance routing in real-time."
            })

        # 🔥 DEFAULT
        return jsonify({
            "response": "Ask about route, corridor, or system."
        })

    except Exception as e:
        print("AI ERROR:", str(e))
        return jsonify({"response": "AI error"})      
# SYSTEM STATS API:
@app.route('/stats', methods=['GET'])
def stats():
    return jsonify({
        "alerts": len(ALERTS),
        "active_signals": 8,   # simulated count
        "active_zones": 3,
        "active_ambulance": "AMB-01"
    })
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "LsMapper Emergency System"})

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 
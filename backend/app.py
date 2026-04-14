from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

app = Flask(__name__)
CORS(app)
# CITY MAP (Graph Simulation)
CITY_MAP = {
    "Koramangala": ["Silk Board", "Indiranagar"],
    "Silk Board": ["Koramangala", "BTM"],
    "BTM": ["Silk Board", "Jayanagar"],
    "Jayanagar": ["BTM", "MG Road"],
    "MG Road": ["Jayanagar", "Indiranagar"],
    "Indiranagar": ["Koramangala", "MG Road"]
}
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

# SIGNAL CONTROL LOGIC
def get_signals(route):
    signals = []
    for i, location in enumerate(route):
        signals.append({
            "junction": location,
            "signal": "GREEN" if i < len(route)-1 else "RED"
        })
    return signals
# ZONE(1km RADIUS SIMULATION):-
def get_zone(location):
    return {
        "center": location,
        "radius": "1km",
        "status": "active"
    }
@app.route('/', methods=['GET'])
def home():
    return {"status": "Backend Running...", "version": "1.0.0"}

@app.route('/dispatch', methods=['POST'])
def dispatch():
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400

        origin = data.get("origin")
        destination = data.get("destination")

        if not origin or not destination:
            return jsonify({"error": "Origin and destination are required"}), 400

        route = [origin, "Signal 1", "Signal 2", destination]
        eta = f"{len(route) * 2} mins"

        return jsonify({
            "success": True,
            "ambulance": "AMB-01",
            "route": route,
            "eta": eta,
            "signals": get_signals(route),
            "zone": get_zone(origin),
            "status": "dispatched"
        })
    except Exception as e:
        print(f"Error in dispatch: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/signals', methods=['POST'])
def signals():
    data = request.json
    route = data.get("route", [])

    return jsonify({
        "signals": get_signals(route)
    })
@app.route('/zone', methods=['POST'])
def zone():
    data = request.json
    location = data.get("location")

    return jsonify({
        "zone": get_zone(location)
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
    app.run(debug=True, host='0.0.0.0', port=5000)
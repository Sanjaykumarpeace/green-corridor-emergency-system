from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

app = Flask(__name__)
CORS(app)

@app.route('/', methods=['GET'])
def home():
    return {"status": "Backend Running 🚀", "version": "1.0.0"}

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

        # Dummy logic (will improve later)
        route = [origin, "Signal 1", "Signal 2", destination]

        return jsonify({
            "success": True,
            "ambulance": "AMB-01",
            "route": route,
            "eta": "5 mins",
            "status": "dispatched"
        })
    except Exception as e:
        print(f"Error in dispatch: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

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
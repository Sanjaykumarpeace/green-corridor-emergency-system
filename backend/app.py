from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return "Backend Running 🚀"

@app.route('/dispatch', methods=['POST'])
def dispatch():
    data = request.json

    origin = data.get("origin")
    destination = data.get("destination")

    # Dummy logic (will improve later)
    route = [origin, "Signal 1", "Signal 2", destination]

    return jsonify({
        "ambulance": "AMB-01",
        "route": route,
        "eta": "5 mins"
    })

if __name__ == '__main__':
    app.run(debug=True)
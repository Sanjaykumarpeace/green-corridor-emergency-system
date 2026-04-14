function dispatchEmergency() {

  fetch('http://127.0.0.1:5000/dispatch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      origin: "Location A",
      destination: "Hospital"
    })
  })
  .then(response => response.json())
  .then(data => {
    document.getElementById("output").innerHTML =
      `🚑 Ambulance: ${data.ambulance} <br>
       📍 Route: ${data.route.join(" → ")} <br>
       ⏱ ETA: ${data.eta}`;
  })
  .catch(err => console.log(err));
}
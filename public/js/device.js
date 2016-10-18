(function(window){
	//Sensor data variables
    var ax = 0;
	var ay = 0;
	var az = 0;
	var oa = 0;
	var ob = 0;
	var og = 0;

	var client;
    var orgId;
	var clientId;
    var password;

	var topic = "iot-2/evt/sensorData/fmt/json";
    var isConnected = false;

	//Location data variables
	window.lat = 0;
	window.lng = 0;

	//Device motion event, captures motion data
	window.ondevicemotion = function(event) {
		ax = parseFloat((event.acceleration.x || 0));
		ay = parseFloat((event.acceleration.y || 0));
		az = parseFloat((event.acceleration.z || 0));
	}

	//Device orientation event, captures orientation data
	window.ondeviceorientation = function(event){

		oa = (event.alpha || 0);
		ob = (event.beta || 0);
		og = (event.gamma || 0);

		if(event.webkitCompassHeading){
			oa = -event.webkitCompassHeading;
		}

	}

	// function which captures patient's current latitude and longitude and updates to screen.
	var updatePatientLocation = function(position) {
		window.lat = position.coords.latitude;
		window.lng = position.coords.longitude;
		$("#lat").html(window.lat.toFixed(6));
		$("#lng").html(window.lng.toFixed(6));
	}

	//Device location change event
	if (navigator.geolocation) {
		navigator.geolocation.watchPosition(updatePatientLocation);
	}

	//Prompt to patient to enter patient id on start of appliacation
	function getPatientId() {
		window.patientId = prompt("Enter your patient ID (least 8 characters containing only letters and numbers):");
		if (window.patientId) {
			$("#patientId").html(window.patientId);
			getDeviceCredentials();
		}
	}

    function publish() {
    	// We only attempt to publish if we're actually connected, saving CPU and battery
		if (isConnected) {
			//Check if patient is inside walking zone
			var isinside = geolib.isPointInside({latitude: window.lat, longitude: window.lng},[
				{ "latitude": -33.868420101047064, "longitude": 151.2063360214233 },
				{ "latitude": -33.86172074954415, "longitude": 151.2063360214233 },
				{ "latitude": -33.86172074954415, "longitude": 151.21260166168213 },
				{ "latitude": -33.868420101047064, "longitude": 151.21260166168213 }
			]);
			console.log("isinside",isinside);
	    	var payload = {
	            "d": {
					"id": window.patientId,
					"ts": (new Date()).getTime(),
					"lat": parseFloat(window.lat),
					"lng": parseFloat(window.lng),
					"ax": parseFloat(ax.toFixed(2)),
					"ay": parseFloat(ay.toFixed(2)),
					"az": parseFloat(az.toFixed(2)),
					"oa": parseFloat(oa.toFixed(2)),
					"ob": parseFloat(ob.toFixed(2)),
					"og": parseFloat(og.toFixed(2)),
					"isinside":isinside
				}
	        };
	        var message = new Paho.MQTT.Message(JSON.stringify(payload));
	        message.destinationName = topic;
	       	try {
			     client.send(message);
			     console.log("[%s] Published", new Date().getTime());
			}
			catch (err) {
				isConnected = false;
				changeConnectionStatusImage("/images/disconnected.svg");
				document.getElementById("connection").innerHTML = "Disconnected";
				setTimeout(connectDevice(client), 1000);
			}
		}
    }

    function onConnectSuccess(){
    	// The device connected successfully
        console.log("Connected Successfully!");
        isConnected = true;
        changeConnectionStatusImage("/images/connected.svg");
        document.getElementById("connection").innerHTML = "Connected";
    }

    function onConnectFailure(){
    	// The device failed to connect. Let's try again in one second.
        console.log("Could not connect to IoT Foundation! Trying again in one second.");
        setTimeout(connectDevice(client), 1000);
    }

    function connectDevice(client){
    	changeConnectionStatusImage("/images/connecting.svg");
    	document.getElementById("connection").innerHTML = "Connecting";
    	console.log("Connecting device to IoT Foundation...");
		client.connect({
			onSuccess: onConnectSuccess,
			onFailure: onConnectFailure,
			userName: "use-token-auth",
			password: password
		});
    }

    function getDeviceCredentials() {
		$.ajax({
			url: "/credentials/"+window.patientId,
			type: "GET",
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			success: function(response){
				orgId = response.org;
				clientId = "d:"+orgId+":"+response.deviceType+":"+response.deviceId;
				password = response.token;

				client = new Paho.MQTT.Client(orgId+".messaging.internetofthings.ibmcloud.com", 1883, clientId);

				console.log("Attempting connect");

				connectDevice(client);

				setInterval(publish, 100);
			},
			error: function(xhr, status, error) {
				if (xhr.status==403) {
					// Authentication check succeeded and told us we're invalid
					alert("Incorrect code!");
				} else {
					// Something else went wrong
					alert("Failed to authenticate! "+error);
				}
			}
		});
    }

    $(document).ready(function() {
		// prompt the patient for id
		getPatientId();
    });

	function changeConnectionStatusImage(image) {
        document.getElementById("connectionImage").src=image;
    }

}(window));

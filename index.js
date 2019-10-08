var mqtt = require('mqtt')
var client = mqtt.connect('mqtt://10.10.10.1')

var devices = {

};


client.on('connect', function () {
    client.subscribe('room_presence/#', function (err) {
        console.log('error?', err);
    })
})

function twoDecimals(num) {
    return Math.round(num * 100) / 100
}

function calculateDistance(rssi) {
    if (rssi === 0) {
        return -1.0;
    }

    const txPower = -49;


    const ratio = rssi * 1.0 / txPower;
    if (ratio < 1.0) {
        return twoDecimals(Math.pow(ratio, 10));
    } else {
        return twoDecimals((0.89976) * Math.pow(ratio, 7.7095) + 0.111);
    }
}

var users = {
    "ee:9d:fe:be:37:fb": "mats",
    "14:8f:21:fd:d1:2a": "anna"
};

var userMap = {};

function getPosition(values, old) {
    var ret = "Unknown";
    const { basement = 40, uppe = 40 } = values;
    var diff = Math.abs(basement - uppe);
    var halfDiff = diff / 2;
    console.log(uppe, basement, halfDiff);
    if (uppe < 5) {
        ret = "Kontoret"
    }
    else if (uppe < halfDiff) {
        ret = "Uppe";
    }
    else if (basement < 5) {
        ret = "Gamerum";
    }
    else if (basement < halfDiff) {
        ret = "Källaren";
    }
    else if (uppe > 47 && uppe < 100 && basement>16 && basement<25) {
        ret = "Köket";
    }
    else if (diff < 25 && uppe>20 && basement>20) {
        ret = "Mellanvåning"
    }
    else {
        ret = old;
    }
    return ret;
}

function calculateUserPosition(device, mac) {

    if (users[mac]) {
        var values = device;
        var oldPosition = (userMap[users[mac]] || {}).position;
        var position = getPosition(values, oldPosition);
        const lastChange = new Date();
        if (oldPosition != position) {
            console.log('sending new position', users[mac]);
            client.publish("/user/" + users[mac] + "/state", position);
            userMap[users[mac]] = {
                position,
                lastChange
            };
        }

    }
}

setInterval(() => {
    const isDead = new Date();
    isDead.setMinutes( isDead.getMinutes() - 5 );
    for(var key in users) {
        var user = users[key];
        if (user.lastChange<isDead) {
            console.log('sending lost range ',user);
            client.publish("/user/" + user + "/state", "Okänd");
        }
    }
}, 40000);

client.on('message', function (topic, message) {
    // message is Buffer

    var placeAndMac = topic.replace('room_presence/', '');
    const [place, mac] = placeAndMac.split('/');

    devices[mac] = {
        ...devices[mac],
        [place]: calculateDistance((message - 0))
    };

    calculateUserPosition(devices[mac], mac);

    //console.log(userMap);

    //    console.log(place, mac, message.toString());

    //console.log(devices);

})


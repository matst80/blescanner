var mqtt = require('mqtt')
var client = mqtt.connect('mqtt://10.10.10.1')
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: '10.10.10.5',
    user: 'root',
    password: '123456',
    database: 'presence'
});

connection.connect();



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

function getPosition(values,old) {
    var ret = "Unknown";
    const { basement = 40, uppe = 40 } = values;
    var diff = Math.abs(basement - uppe);
    var halfDiff = diff/2;
    console.log(uppe, basement, halfDiff);
    
    if (uppe < halfDiff) {
        ret = "Kontoret";
    }
    else if (basement < halfDiff) {
        ret = "Källaren"
    }
    else if (diff < 4) {
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
        var oldPosition = userMap[users[mac]];
        var position = getPosition(values, oldPosition);
        if (oldPosition!=position) {
            client.publish("/user/"+users[mac]+"/state",position);
            userMap[users[mac]] = position;
        }
        
    }
}

client.on('message', function (topic, message) {
    // message is Buffer

    var placeAndMac = topic.replace('room_presence/', '');
    const [place, mac] = placeAndMac.split('/');

    devices[mac] = {
        ...devices[mac],
        [place]: calculateDistance((message - 0))
    };

    calculateUserPosition(devices[mac], mac);

    console.log(userMap);

    //    console.log(place, mac, message.toString());

    console.log(devices);

})


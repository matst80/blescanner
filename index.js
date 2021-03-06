var mqttClient = require('mqtt').connect('mqtt://10.10.10.1');
const MongoClient = require('mongodb').MongoClient;
const dbClient = new MongoClient('mongodb://10.10.10.1:27017');
var devices = {

};


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
        return Math.pow(ratio, 10);
    } else {
        return (0.89976) * Math.pow(ratio, 7.7095) + 0.111;
    }
}

var users = {
    // "ee:9d:fe:be:37:fb": "mats",
    // "14:8f:21:fd:d1:2a": "anna",
    // "d3:5f:34:eb:fe:39": "mats",
    // "7e:91:06:de:77:b2": "mats",
    // "50:64:fe:c8:5c:f7": "mats"
};

var userMap = {};

function getPosition(values, old) {
    var ret = "Unknown";
    const { basement = 203, uppe = 203, entre=203 } = values;
    if (uppe > 200 & basement > 200 & entre > 200)
        ret = "Inte hemma";
    else if (uppe < 20) {
        ret = "Kontoret"
    }
    else if (basement < 20) {
        ret = "Gamerum";
    }
    else if (entre < 20) {
        ret = "Entre"
    }
    else if (uppe < entre && uppe < basement) {
        ret = "Uppe";
    }
    else if (basement < entre && basement < uppe) {
        ret = "Källaren";
    }
    else if (entre < basement && entre < uppe) {
        ret = "Mellanvåning"
    }
    else {
        ret = old;
    }
    return ret;
}

const macPlaceHistory = {};

function calculateUserPosition(device, mac) {
    if (users[mac]) {
        var values = device;
        var oldPosition = (userMap[users[mac]] || {}).position;
        var position = getPosition(values, oldPosition);
        const lastChange = new Date();
        if (oldPosition != position) {
            console.log('update position:',users[mac], position)
            mqttClient.publish("/user/" + users[mac] + "/state", position);
            userMap[users[mac]] = {
                position,
                lastChange
            };
        }

    }
}


setInterval(() => {
    const isDead = new Date();
    isDead.setMinutes(isDead.getMinutes() - 5);
    for (var key in users) {
        var user = users[key];
        if (user.lastChange < isDead) {
            console.log('sending lost range ', user);
            mqttClient.publish("/user/" + user + "/state", "Okänd");
        }
    }
}, 40000);

const avergeLength = 3;

function getAverage(mac, place, distance) {

    if (!macPlaceHistory[mac + place])
        macPlaceHistory[mac + place] = [];

    const window = macPlaceHistory[mac + place];

    window.push(distance);
    if (window.length > avergeLength) {
        window.splice(0, 1);
    }

    var sum = window.reduce((tot, val) => tot + val);

    return twoDecimals(sum / window.length);
}

mqttClient.on('connect', function () {
    console.log('mqtt connected');
    mqttClient.subscribe('room_presence/#', function (err) {
        if (err)
            console.warn(err);
    })
});

let allmacs = {};

dbClient.connect((err) => {
    if (err)
        console.warn(err);
    else {
        console.log("Connected successfully to server");

        const db = dbClient.db('presence');

        const allCollection = db.collection('scans');
        const userCollection = db.collection('usermap');

        userCollection.find({}).toArray((err, docs) => {
            docs.forEach(({mac,user})=>{
                users[mac] = user;
            });
        });

        mqttClient.on('message', function (topic, message) {
            
            var placeAndMac = topic.replace('room_presence/', '');
            const [place, mac] = placeAndMac.split('/');
            const distance = calculateDistance((message - 0));

            //if (users[mac]) {
                devices[mac] = {
                    ...devices[mac],
                    [place]: getAverage(mac,place,distance)
                };
            //}

            allCollection.insertOne({ devices, when:new Date()}, (err,res)=>{
                if (err)
                    console.warn(err);
            });
            
            calculateUserPosition(devices[mac], mac);

            //console.log(devices);

        })
    }
});
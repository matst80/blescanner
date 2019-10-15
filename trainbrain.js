var fs = require('fs');
var path = require('path');
const MongoClient = require('mongodb').MongoClient;
const dbClient = new MongoClient('mongodb://10.10.10.1:27017');
var WebSocketServer = require('websocket').server;
var http = require('http');

const connections = [];

const deviceMac = 'd1:00:00:03:47:0d';

function findValues(start, stop, mac, all) {
    return all.filter(({ when, devices }) => start < when && stop > when && devices[deviceMac]).map(({ devices }) => {
        return devices[deviceMac];
    });
}

var currentRoom;
var startTime;

dbClient.connect((err) => {
    if (err)
        console.warn(err);

    var db = dbClient.db('presence');
    var server = http.createServer(function (request, response) {
        console.log('request starting...');

        var filePath = '.' + request.url;
        if (filePath == './')
            filePath = './index.html';

        var extname = path.extname(filePath);
        var contentType = 'text/html';
        switch (extname) {
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.css':
                contentType = 'text/css';
                break;
            case '.json':
                contentType = 'application/json';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.jpg':
                contentType = 'image/jpg';
                break;
            case '.wav':
                contentType = 'audio/wav';
                break;
        }

        fs.readFile(filePath, function (error, content) {
            if (error) {
                if (error.code == 'ENOENT') {
                    fs.readFile('./404.html', function (error, content) {
                        response.writeHead(200, { 'Content-Type': contentType });
                        response.end(content, 'utf-8');
                    });
                }
                else {
                    response.writeHead(500);
                    response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                    response.end();
                }
            }
            else {
                response.writeHead(200, { 'Content-Type': contentType });
                response.end(content, 'utf-8');
            }
        });
    });
    server.listen(1337, function () { });

    // create the server
    wsServer = new WebSocketServer({
        httpServer: server
    });

    // WebSocket server
    wsServer.on('request', function (request) {
        var connection = request.accept(null, request.origin);

        connection.on('message', function (message) {

            if (message.type === 'utf8') {
                // process WebSocket message
                
                var data = JSON.parse(message.utf8Data)
                console.log('got',data);
                if (data.room)
                    currentRoom = data.room;
                if (data.start)
                    startTime = new Date();
                if (data.stop) {
                    db.collection('rooms').insertOne({
                        room: currentRoom, start: startTime, stop: new Date()
                    });
                }
            }
        });

        connections.push(connection);

        connection.on('close', function (connection) {
            // close user connection


        });
    });



    const userCollection = db.collection('usermap');
    const allCollection = db.collection('scans');

    var roomNames = ['Kontoret', 'Köket', 'Vardagsrum', 'Bio', 'Sovrum'];
    var mac = deviceMac; //chipolo

    allCollection.find({}).toArray((err, docs) => {

        db.collection('rooms').find({}).toArray((err, rooms)=> {

        rooms.forEach(({room,start,stop}) => {
            var roomIdx = roomNames.indexOf(room);
            var values = findValues(start, stop, mac, docs).map(d => ({ input: [d.uppe||120, d.entre||120, d.basement||120], output: roomIdx }));
            console.log(start,stop, values);
        });

        

        });

        
    });

    userCollection.find({}).toArray((err, docs) => {
        console.log(err, docs);
    });


});
var fs = require('fs');
var path = require('path');
const { NeuralNetwork } = require('brain.js');
const MongoClient = require('mongodb').MongoClient;
const dbClient = new MongoClient('mongodb://10.10.10.1:27017');
var WebSocketServer = require('websocket').server;
var http = require('http');

const connections = [];

function findValues(start, stop, mac, all) {
    return all.filter(({ when, devices }) => start < when && stop > when && devices['57:d9:16:0f:84:22']).map(({ devices }) => {
        return devices['57:d9:16:0f:84:22'];
    }).filter(d => d.uppe && d.basement);
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

    var start = new Date();
    start.setHours(start.getHours() - 2);
    var stop = new Date();
    var mac = '67:ca:0e:39:b8:0c';

    allCollection.find({}).toArray((err, docs) => {

        var values = findValues(start, stop, mac, docs).map(d => ({ input: [d.uppe, d.basement], output: '1' }));

        const net = new NeuralNetwork();
        net.train(values);

        console.log(err, values);
    });

    userCollection.find({}).toArray((err, docs) => {
        console.log(err, docs);
    });


});
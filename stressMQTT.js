"use strict";

var mqtt = require("mqtt");

var spawnServer = true;

var serverLib = "./moscaServer.js";
//var serverLib = "./aedesServer.js";
//var serverLib = "./mosquittoServer.js";

var uri = "ws://127.0.0.1:3000";
var targetCount = 10000;
var requireOrder = true;
var zeroPad = true;

var client, nextMessageOut, nextMessageIn;
var startTime, lastTime;

var daemon = null;
function loadDaemon(cb){
    if(daemon){
        cb(daemon);
    }
    else{
        if(spawnServer){
            daemon = new (require("./servers/forkingServer.js").Daemon)();
            daemon.loadLib(serverLib, function(){
                cb(daemon);
            });
        }
        else{
            daemon = new (require("./servers/" + serverLib).Daemon)();
            cb(daemon);
        }
    }
}

describe("All the tests", function(){

    beforeEach(function(done){
        resetTimestamp();
        nextMessageOut = 0;
        nextMessageIn = 0;

        loadDaemon(function(){
            daemon.launch(function(){
                client = mqtt.connect(uri);
                client.on("error", function(err){
                    timestamp("Error:" + err.toString());
                    throw err;
                });
                client.on("connect", function(){
                    timestamp("Connected");
                    done();
                })
            });
        });
    });

    afterEach(function(done){
        client.end(true, function(){
            client = null;
            daemon.kill(function(){
                done();
            });
        });
    });

    it("Can receive synchronous retained messages", function(done) {
        console.log("Can receive synchronous retained messages");
        client.on("message", function(topic, bytes, packet){
            receive(bytes, done);
        });
        client.subscribe('#', { qos:1 }, function(err, granted){
            if(err) {
                throw err;
            }
            else {
                timestamp("Subscribed");
                var i;
                for (i = 0; i < targetCount; i++) {
                    send();
                }
            }
        });
    });

    it("Can receive previous retained messages", function(done){
        console.log("Can receive previous retained messages");
        client.on("message", function(topic, bytes, packet){
            receive(bytes, done);
        });
        var i;
        for (i = 0; i < targetCount; i++) {
            if(i < targetCount - 1){
                send(); //don't provide ack callback
            }
            else{
                send(function(){ //wait for ack before triggering subscription
                    client.subscribe('#', { qos:1 }, function(err, granted){
                        if(err) {
                            throw err;
                        }
                        else {
                            timestamp("Subscribed");
                        }
                    });
                })
            }
        }
    });

    it("Can ping back messages to test roundtrip time", function(done){
        console.log("Can ping back messages to test roundtrip time");
        client.on("message", function(topic, bytes, packet){
            receive(bytes, done); //receive message
            if(nextMessageOut < targetCount) {
                send(); //send next message
            }
        });
        client.subscribe('#', { qos:1 }, function(err, granted){
            if(err) {
                throw err;
            }
            else {
                timestamp("Subscribed");
                send(); //trigger first message in echo chain
            }
        });
    });
});

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function send(acked){
    timestamp("Sending msg:" + nextMessageOut);
    var topic = "/" + (zeroPad? pad(nextMessageOut,4): nextMessageOut);
    var payload = nextMessageOut.toString();
    client.publish(topic, payload, { qos:1, retain:true }, function(err, result){
        if(err) {
            throw err;
        }
        if(acked) {
            acked();
        }
    });
    nextMessageOut++;
}

function receive(bytes, done){
    var parsedMessageIn = Number(bytes.toString());
    timestamp("Received msg:" + parsedMessageIn);
    if(requireOrder && parsedMessageIn !== nextMessageIn){
        var errorMsg = "Out of order: expecting " + nextMessageIn + " but received " + parsedMessageIn;
        timestamp(errorMsg);
        throw new Error(errorMsg);
    }
    nextMessageIn++;
    if(nextMessageIn === targetCount) {
        done();
    }
}


resetTimestamp();

function resetTimestamp(){
    startTime = null;
    lastTime = null;
    console.log();
    console.log();
    console.log("Timestamp reset");
}


function timestamp(report){
    var time = Date.now();
    if(startTime === null){
        startTime = time;
    }
    console.log( (time - startTime) + (lastTime !== null ? ":" + (time-lastTime) : "") + " "  + report);
    lastTime = time;
}


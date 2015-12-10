"use strict";

var mqtt = require("mqtt");

var uri = "ws://127.0.0.1:3000";
var targetCount = 100;
var requireOrder = true;
var zeroPad = true;

var client, nextMessageOut, nextMessageIn;
var startTime, lastTime;

//uncomment below for Mosquitto
/*
 var mosquittoServer;
 var launchServer = launchMosquitto;
 var killServer = killMosquitto;
 */

//uncomment below for Mosca
/*
 var moscaServer;
 var launchServer = launchMosca;
 var killServer = killMosca;
 */

//uncomment below for Aedes
/*
 var aedesServer;
 var launchServer = launchAedes;
 var killServer = killAedes;
 */

describe("All the tests", function(){

    beforeEach(function(done){
        resetTimestamp();
        nextMessageOut = 0;
        nextMessageIn = 0;
        launchServer(function(){
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

    afterEach(function(done){
        client.end(true, function(){
            client = null;
            killServer(function(){
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

    /*
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
    */

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

function launchAedes(cb){
    var http = require("http"),
        websocketStream = require("websocket-stream"),
        aedesPersistence = require('aedes-persistence'),
        aedes = require('aedes');
    var aedesStore = aedesPersistence();
    var aedesInstance = aedes({persistence:aedesStore});
    var httpServer = http.createServer();
    var websocketServer = websocketStream.createServer({server: httpServer}, aedesInstance.handle);
    aedesServer = httpServer;
    httpServer.listen(3000, cb);
}

function killAedes(cb){
    aedesServer.close(cb);
}

function launchMosquitto(cb){
    var child_process = require("child_process"),
        spawn = child_process.spawn;
    mosquittoServer = spawn("/usr/local/sbin/mosquitto", ["--config-file", "./mosquitto.conf", "--verbose"], {cwd:__dirname});
    cb(); //TODO should something be awaited in Posixland?
}

function killMosquitto(cb){
    mosquittoServer.kill("SIGINT");
    mosquittoServer.on("exit", function(){
        cb();
    })
}

function launchMosca(cb){
    var mosca = require("mosca");
    var moscaSettings = {
        maxInflightMessages: 1024,
        persistence: {
            factory: mosca.persistence.Memory
        },
        http:{
            port:3000,
            static:false,
            bundle:false
        },
        onlyHttp:true
    };
    moscaServer = new mosca.Server(moscaSettings, cb);
}

function killMosca(cb){
    moscaServer.close(function(){
        moscaServer = null;
        cb();
    });
}
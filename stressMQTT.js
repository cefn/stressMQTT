"use strict";

var mqtt = require("mqtt");

var spawnBroker = true;

var serverType = "mosca";
//var serverType = "aedes";
//var serverType = "mosquitto";
var logVerbose = true;

var uri = "ws://127.0.0.1:3000";
var subscribeOpts = { qos:1 };
var publishOpts = { qos:1, retain:true };

var targetCount = 10000;                //the number of messages to be sent and received
var requireOrder = true;                //check that messages are delivered in numerical order (the order they were sent)
var zeroPadTopics = true;               //workaround for out-of-order lexically-based delivery from mosca
var ignoreReconnectionErrors = true;    //ignore duplicate 'onconnect' events from Mosca or Aedes

var client, nextSubscription, nextMessageOut, nextMessageIn, subscribeStart, sendStart, receiveStart;
var startTime, lastTime;

var daemon = null;
function loadDaemon(cb){
    if(daemon){
        cb(daemon);
    }
    else{
        if(spawnBroker){
            daemon = new (require("./servers/forkingServer.js").Daemon)();
            daemon.loadLib("./" + serverType + "Server.js", function(){
                cb(daemon);
            });
        }
        else{
            daemon = new (require("./servers/" + serverType + "Server.js").Daemon)();
            cb(daemon);
        }
    }
}

describe("All the tests", function(){

    beforeEach(function(done){
        resetTimestamp();
        nextSubscription = 0;
        nextMessageOut = 0;
        nextMessageIn = 0;

        subscribeStart = -1;
        sendStart = -1;
        receiveStart = -1;

        loadDaemon(function(){
            daemon.launch(function(){
                client = mqtt.connect(uri);
                client.on("error", function(err){
                    timestamp("Error:" + err.toString());
                    throw err;
                });
                var awaitingFirstConnection = true;
                client.on("connect", function(){
                    if(awaitingFirstConnection){
                        awaitingFirstConnection = false;
                        timestamp("Connected");
                        done();
                    }
                    else if(!ignoreReconnectionErrors){
                        done("Spurious reconnection");
                    }
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

    it("Wildcard subscription of synchronous messages", function(done) {
        console.log("Can receive synchronous retained messages");
        client.on("message", function(topic, bytes, packet){
            receive(bytes, done);
        });
        timestamp("Subscribing");
        resetSubscribe();
        subscribeAll(function(err, granted){
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

    it("Wildcard subscription of retained messages", function(done){
        console.log("Wildcard subscription of retained messages");
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
                    timestamp("Subscribing");
                    resetSubscribe();
                    subscribeAll();
                });
                reportSend();
            }
        }
    });

    it("Individual subscription of retained messages", function(done){
        console.log("Individual subscription of retained messages");
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
                    timestamp("Subscribing");
                    var i;
                    for (i = 0; i < targetCount; i++) {
                        subscribeTopic();
                    }
                });
                reportSend();
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
            else{
                reportSend();
            }
        });
        timestamp("Subscribing");
        subscribeAll(function(err, granted){
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

function resetSubscribe(){
    subscribeStart = Date.now();
    timestamp("Subscribed");
}

function resetSend(){
    sendStart = Date.now();
    timestamp("Sent first message");
}

function resetReceive(){
    var initiated = Math.max(subscribeStart, sendStart);
    timestamp("Received first message after " + (Date.now() - initiated) + " ms" );
    receiveStart = Date.now();
}

function reportSend(){
    var period = Date.now() - sendStart;
    timestamp("Sent " + nextMessageOut + " messages in " + period + " ms at " + (period / nextMessageOut) + "ms/msg");
}

function reportReceive(){
    var period = Date.now() - receiveStart;
    timestamp("Received " + nextMessageIn + " messages in " + period + " ms at " + (period / nextMessageIn) + "ms/msg");
}

function reportSubscribe(){
    var period = Date.now() - subscribeStart;
    timestamp("Subscribed to " + nextSubscription + " topics in " + period + " ms at " + (period / nextSubscription) + "ms/topic");
}


function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function subscribeAll(acked){
    client.subscribe('#', subscribeOpts, function(err, granted){
        if(err) {
            throw err;
        }
        else {
            if(acked){
                acked();
            }
        }
    });
}

function subscribeTopic(acked){
    if(nextSubscription===0) resetSubscribe();
    if(logVerbose) timestamp("Subscribing to topic:" + nextSubscription);
    var subscribedTopic = "/" + (zeroPadTopics? pad(nextSubscription,4): nextSubscription);
    client.subscribe(subscribedTopic, subscribeOpts, function(err, granted){
        if(err) {
            throw err;
        }
        else {
            if(acked){
                acked();
            }
        }
    });
    nextSubscription++;
    if(nextSubscription===targetCount) reportSend();
}


function send(acked){
    if(nextMessageOut===0) resetSend();
    if(logVerbose) timestamp("Sending msg:" + nextMessageOut);
    var topic = "/" + (zeroPadTopics? pad(nextMessageOut,4): nextMessageOut);
    var payload = nextMessageOut.toString();
    if(acked){
        client.publish(topic, payload, publishOpts, function(err, result){
            if(err) {
                throw err;
            }
            if(acked) {
                acked();
            }
        });
    }
    else{
        client.publish(topic, payload, publishOpts)
    }
    nextMessageOut++;
    if(nextMessageOut===targetCount) reportSend();
}

function receive(bytes, done){
    if(nextMessageIn===0) resetReceive();
    var parsedMessageIn = Number(bytes.toString());
    if(logVerbose) timestamp("Received msg:" + parsedMessageIn);
    if(requireOrder && parsedMessageIn !== nextMessageIn){
        var errorMsg = "Out of order: expecting " + nextMessageIn + " but received " + parsedMessageIn;
        timestamp(errorMsg);
        throw new Error(errorMsg);
    }
    nextMessageIn++;
    if(nextMessageIn === targetCount) {
        reportReceive();
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


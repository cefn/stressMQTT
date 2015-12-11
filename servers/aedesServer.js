var http = require("http"),
    websocketStream = require("websocket-stream"),
    aedesPersistence = require('aedes-persistence'),
    aedes = require('aedes');

function Daemon(){}

Daemon.prototype = {
    launch:function(cb){
        var aedesStore = aedesPersistence();
        var aedesInstance = aedes({persistence:aedesStore});
        var httpServer = http.createServer();
        var websocketServer = websocketStream.createServer({server: httpServer}, aedesInstance.handle);
        this.server = httpServer;
        httpServer.listen(3000, cb);
    },
    kill:function(cb){
        var that = this;
        that.server.close(function(){
            that.server = null;
            cb();
        });
    }
}

exports.Daemon = Daemon;

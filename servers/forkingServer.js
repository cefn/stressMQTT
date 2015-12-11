var childProcess = require("child-process-debug");

function Daemon(){}

Daemon.prototype = {
    loadLib:function(path, cb){
        this.containerProcess = childProcess.fork("./servers/forkedContainer.js");
        this.containerProcess.send(["path", path]);
        this.handleNextMessage(cb);
    },
    launch:function(cb){
        this.containerProcess.send(["launch"]);
        this.handleNextMessage(cb);
    },
    kill:function(cb){
        this.containerProcess.send(["kill"]);
        this.handleNextMessage(cb);
    },
    handleNextMessage:function(cb){
        var that = this;
        function handler(){
            that.containerProcess.removeListener("message", handler);
            cb.apply(null, arguments);
        }
        that.containerProcess.on("message", handler);
    },
}

exports.Daemon = Daemon;
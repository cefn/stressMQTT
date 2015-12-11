var child_process = require("child_process"),
    spawn = child_process.spawn;

function Daemon(){}

Daemon.prototype = {
    launch:function(cb){
        this.server = spawn("/usr/local/sbin/mosquitto", ["--config-file", "./mosquitto.conf", "--verbose"], {cwd:__dirname});
        cb(); //TODO should something be awaited in Posixland?
    },
    kill:function(cb){
        var that = this;
        that.server.kill("SIGINT");
        that.server.on("exit", function(){
            that.server = null;
            cb();
        })
    }
}

exports.Daemon = Daemon;

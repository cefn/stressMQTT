var child_process = require("child_process"),
    spawn = child_process.spawn;

function Daemon(){}

Daemon.prototype = {
    launch:function(cb){
        var that = this;
        that.server = spawn("/usr/local/sbin/mosquitto", ["--config-file", "./mosquitto.conf", "--verbose"], {cwd:__dirname});
        function consoleHandler(consoleData){
            var consoleString = consoleData.toString();
            if(consoleString.indexOf("Opening websockets listen socket on port 3000") !== -1){
                that.server.stdout.removeListener("data", consoleHandler);
                that.server.stderr.removeListener("data", consoleHandler);
                var _cb = cb;
                cb = null;
                _cb();
            }
        }
        that.server.stdout.on("data", consoleHandler);
        that.server.stderr.on("data", consoleHandler);
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

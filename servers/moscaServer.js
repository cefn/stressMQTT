var mosca = require("mosca");

function Daemon() {}

Daemon.prototype = {
    launch:function(cb){
        var moscaSettings = {
            maxInflightMessages: 2048,
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
        this.server = new mosca.Server(moscaSettings, cb);
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
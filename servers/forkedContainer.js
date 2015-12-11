var controller;

process.on("message", function(message){
    var command = message[0];
    var param = message[1];

    if(command === "path"){
        controller = new (require(param).Daemon)();
        ack();
    }
    else if(command === "launch"){
        controller.launch(function(){
            ack();
        });
    }
    else if(command === "kill"){
        controller.kill(function(){
            ack();
        });
    }
});

function ack(){
    process.send(null);
}

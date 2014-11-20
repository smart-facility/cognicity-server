//daemon.js - Daemon script for cognicity-server

os = require("os");

//Load configuration file
var config = require(__dirname+'/config.js');

//Daemon setup
var daemon = require("daemonize2").setup({
	main: "server.js",
	name: config.instance,
	pidfile: os.tmpdir()+config.instance+".pid"
});


//Command line options
switch (process.argv[2]){
	case "start":
		daemon.start();
		daemon.on("started", function(){
			console.log(config.instance+' running on port: '+config.port);
			})
		break;
	case "stop":
		daemon.stop();
		break;
	case "status":
		if (daemon.status() == 0){
			console.log(config.instance+' not running.');
			}
		else{
			console.log(config.instance+' running on port: '+config.port);
			}
		break;
	default:
		console.log("Usage:node daemon.js [start|stop|status]");
}

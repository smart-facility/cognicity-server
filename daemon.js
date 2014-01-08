//daemon.js - Daemon script for cognicity-server

//Load configuration file
if (process.argv[2] && process.argv[3]){
	var config = require(__dirname+'/'+process.argv[2]); 
	}
else{
	throw new Error('Missing parameters. Usage: node daemon.js config.js [start|stop|status]')
	}

//Daemon setup
var daemon = require("daemonize2").setup({
	main: "server.js",
	name: config.instance,
	pidfile: "/tmp/"+config.instance+".pid"
});

//Command line options
switch (process.argv[3]){
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
		console.log("Usage:node daemon.js config.js [start|stop|status]");
}

'use strict';

//server.js - nodejs server for cognicity framework

// Tomas Holderness January 2014

// Modules
var path = require('path');
var express = require('express');
var pg = require('pg');
var cache = require('memory-cache');
var topojson = require('topojson');
/** Winston logger module */
var logger = require('winston');
var CognicityServer = require('./CognicityServer.js');

// Read in config file from argument or default
var configFile = ( process.argv[2] ? process.argv[2] : 'config.js' );
var config = require( __dirname + path.sep + configFile );

// Express
var app = express();

// Logging
// Configure custom File transport to write plain text messages
var logPath = ( config.logger.logDirectory ? config.logger.logDirectory : __dirname );
logPath += path.sep;
logPath += config.instance + ".log";

logger
	.add(logger.transports.File, { 
		filename: logPath, // Write to projectname.log
		json: false, // Write in plain text, not JSON
		maxsize: config.logger.maxFileSize, // Max size of each file
		maxFiles: config.logger.maxFiles, // Max number of files
		level: config.logger.level // Level of log messages
	})
	// Console transport is no use to us when running as a daemon
	.remove(logger.transports.Console);

// Verify DB connection is up
pg.connect(config.pg.conString, function(err, client, done){
	if (err){
		logger.error("DB Connection error: " + err);
		logger.error("Fatal error: Application shutting down");
		done();
		exitWithStatus(1);
	}
});

var server = new CognicityServer(config, cache, logger, pg);

// Define a winston stream function we can plug in to express so we can
// capture its logs along with our own
var winstonStream = {
    write: function(message, encoding){
    	logger.info(message.slice(0, -1));
    }
};

// Setup express logger
app.use( express.logger( { stream : winstonStream } ) );

// Static file server
app.use(app.router);
app.use('/'+config.url_prefix, express.static(config.public_dir));

// Enable CORS for data streams
app.all('/'+config.url_prefix+'/data/*', function(req, res, next){
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	next();
});

// Route root path to some place.
app.get('/', function(req, res){
	res.redirect('/'+config.root_redirect);
});

app.get('/'+config.url_prefix, function(req, res){
	res.redirect('/'+config.root_redirect);
});

//Route empty API path to docs
app.get('/'+config.url_prefix+'/data/api', function(req, res){
	res.redirect('/'+config.url_prefix+'/in/data/api');
});

//Route empty API path to docs
app.get('/'+config.url_prefix+'/data/api/v1', function(req, res){
	res.redirect('/'+config.url_prefix+'/in/data/api');
});

//Route data path to docs
app.get('/'+config.url_prefix+'/data/', function(req, res){
	res.redirect('/'+config.url_prefix+'/in/data/');
});


if (config.data === true){

	// Data route for reports
	app.get('/'+config.url_prefix+'/data/api/v1/reports/confirmed', function(req, res){
	//No options from request passed to internal functions, default data parameters only.

		var opts = {};

		if (cache.get('reports') === null){
			server.getReports(opts, function(data){
				server.cacheReports('reports', data);
				writeGeoJSON(res, data[0], req.param('format'));
			});
		}
		else {
			writeGeoJSON(res, cache.get('reports')[0], req.param('format'));
			}
		});

	//Data route for unconfirmed reports
	app.get('/'+config.url_prefix+'/data/api/v1/reports/unconfirmed', function(req, res){

			//No options passed
			var opts = {};

			if (cache.get('reports_unconfirmed') === null){
				server.getUnConfirmedReports(opts, function(data){
					server.cacheReports('reports_unconfirmed', data);
					writeGeoJSON(res, data[0], req.param('format'));
				});
			}
			else {
				writeGeoJSON(res, cache.get('reports_unconfirmed')[0], req.param('format'));
			}
		});

	if (config.aggregates === true){

		//Data route for spatio-temporal aggregates
		app.get('/'+config.url_prefix+'/data/api/v1/aggregates/live', function(req, res){

					//Organise parameter options
					var level;
					var tbl;
					if (req.param('level') && config.pg.aggregate_levels[req.param('level')] !== undefined){
						level = req.param('level');
						tbl = config.pg.aggregate_levels[level];
					}
					else{
						//Use first aggregate level as default
						tbl = config.pg.aggregate_levels[ Object.keys(config.pg.aggregate_levels)[0] ];
					}
					
					var hours;
					var start;
					//3 hours
					if (req.param('hours') && req.param('hours') === 3){
						hours = req.param('hours');
						start = Math.floor(Date.now()/1000 - 10800);
					}
					//6 hours
					else if (req.param('hours') && req.param('hours') === 6){
						hours = req.param('hours');
						start = Math.floor(Date.now()/1000 - 21600);
					}
					//Default to one hour
					else {
						hours = 1;
						start = Math.floor(Date.now()/1000 - 3600);
					}
					// Get data from db and update cache.
					if (cache.get('count_'+level+'_'+hours) === null){
						server.getCountByArea({polygon_layer:tbl,start:start}, function(data){
							server.cacheCount('count_'+level+'_'+hours, data);

							// Write data
							writeGeoJSON(res, data[0], req.param('format'));
						});
					}

				else {
					//Return cached data
					writeGeoJSON(res, cache.get('count_'+level+'_'+hours)[0], req.param('format'));
				}
		});

		//Data route for historical aggregate archive
		app.get('/'+config.url_prefix+'/data/api/v1/aggregates/archive', function(req, res){
			var end_time;
			if (req.param('end_time')){
				end_time = req.param('end_time');
			}
			else {
				end_time = 'NULL';
			}
			server.getHistoricalCountByArea(end_time, function(data){
				writeGeoJSON(res, data[0], req.param('format'));
			});
		});
	}

	//Data route for waterways infrastructure
	app.get('/'+config.url_prefix+'/data/api/v1/infrastructure/waterways', function(req, res){
		server.getInfrastructure('waterways', function(data){
			writeGeoJSON(res, data[0], req.param('format'));
		});
	});

	//Data route for pump stations
	app.get('/'+config.url_prefix+'/data/api/v1/infrastructure/pumps', function(req, res){
		server.getInfrastructure('pumps', function(data){
			writeGeoJSON(res, data[0], req.param('format'));
		});
	});

	//Data route for floodgates
	app.get('/'+config.url_prefix+'/data/api/v1/infrastructure/floodgates', function(req, res){
		server.getInfrastructure('floodgates', function(data){
			writeGeoJSON(res, data[0], req.param('format'));
		});
	});
}

// 404 handling
app.use(function(req, res, next){
  res.send('Error 404 - Page not found', 404);
});

//Function to return GeoJson or TopoJson data to stream
function writeGeoJSON(res, data, format){
	if (format === 'topojson' && data.features !== null){
		//Clone the object because topojson edits in place.
		var topo = JSON.parse(JSON.stringify(data));
		var topology = topojson.topology({collection:topo},{"property-transform":function(object){return object.properties;}});

		res.writeHead(200, {"Content-type":"application/json"});
		res.end(JSON.stringify(topology, "utf8"));

	} else {
		// Firefox will hang and receive the request forever if it receives a content type and 0 bytes of data
		// In that case, data here is 'undefined', so we send nothing
		if (data) {
			res.writeHead(200, {"Content-type":"application/json"});
			res.end(JSON.stringify(data, "utf8"));
		} else {
			res.writeHead(204);
			res.end();
		}
	}
}

// Use the PORT environment variable (e.g. from AWS Elastic Beanstalk) or use 8081 as the default port
logger.info( "Application starting, listening on port " + config.port );
app.listen(config.port);

//FIXME This is a workaround for https://github.com/flatiron/winston/issues/228
//If we exit immediately winston does not get a chance to write the last log message.
//So we wait a short time before exiting.
function exitWithStatus(exitStatus) {
	logger.info( "Exiting with status " + exitStatus );
	setTimeout( function() {
		process.exit(exitStatus);
	}, 500 );
}

//Catch kill and interrupt signals and log a clean exit status
process.on('SIGTERM', function() {
	logger.info('SIGTERM: Application shutting down');
	exitWithStatus(0);
});
process.on('SIGINT', function() {
	logger.info('SIGINT: Application shutting down');
	exitWithStatus(0);
});

//Catch unhandled exceptions, log, and exit with error status
process.on('uncaughtException', function (err) {
	logger.error('uncaughtException: ' + err.message + ", " + err.stack);
	logger.error("Fatal error: Application shutting down");
	exitWithStatus(1);
});
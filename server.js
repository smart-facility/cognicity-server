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

var server = new CognicityServer(config, logger, pg);

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

	app.get( new RegExp('/'+config.url_prefix+'/data/api/v1/.*'), function(req, res, next){
		// See if we've got a cache hit on the request URL
		var cacheResponse = cache.get(req.originalUrl);
		// Render the cached response now or let express find the next matching route
		if (cacheResponse) writeResponse( res, cacheResponse );
		else next();
	});
		
	// Data route for reports
	app.get('/'+config.url_prefix+'/data/api/v1/reports/confirmed', function(req, res){
		// No options from request passed to internal functions, default data parameters only.
		server.getReports({}, function(data){
			// Prepare the response data, cache it, and write out the response
			var responseData = prepareGeoJSON(res, data[0], req.param('format'));
			cacheTemporarily(req.originalUrl, responseData);
			writeResponse(res, responseData);
		});
	});

	// Data route for unconfirmed reports
	app.get('/'+config.url_prefix+'/data/api/v1/reports/unconfirmed', function(req, res){
		// No options passed
		server.getUnConfirmedReports({}, function(data){
			// Prepare the response data, cache it, and write out the response
			var responseData = prepareGeoJSON(res, data[0], req.param('format'));
			cacheTemporarily(req.originalUrl, responseData);
			writeResponse(res, responseData);
		});
	});

	if (config.aggregates === true){

		// Data route for spatio-temporal aggregates
		app.get('/'+config.url_prefix+'/data/api/v1/aggregates/live', function(req, res){
			//Organise parameter options
			var tbl;
			if (req.query.level && config.pg.aggregate_levels[req.query.level]){
				tbl = config.pg.aggregate_levels[req.query.level];
			} else{
				// Use first aggregate level as default
				tbl = config.pg.aggregate_levels[ Object.keys(config.pg.aggregate_levels)[0] ];
			}
			logger.debug("Parsed option 'tbl' as '"+tbl+"'");
			
			var start;
			// 3 hours
			if (req.query.hours && req.query.hours === "3"){
				logger.debug("Parsed option 'hours' as '3'");
				start = Math.floor(Date.now()/1000 - 10800);
			}
			// 6 hours
			else if (req.query.hours && req.query.hours === "6"){
				logger.debug("Parsed option 'hours' as '6'");
				start = Math.floor(Date.now()/1000 - 21600);
			}
			// Default to one hour
			else {
				logger.debug("Parsed option 'hours' as '1'");
				start = Math.floor(Date.now()/1000 - 3600);
			}
					
			// Get data from db and update cache.
			server.getCountByArea({polygon_layer:tbl,start:start}, function(data){
				// Prepare the response data, cache it, and write out the response
				var responseData = prepareGeoJSON(res, data[0], req.param('format'));
				cacheTemporarily(req.originalUrl, responseData);
				writeResponse(res, responseData);
			});
		});

		//Data route for historical aggregate archive
		app.get('/'+config.url_prefix+'/data/api/v1/aggregates/archive', function(req, res){
			var end_time = req.param('end_time') ? req.param('end_time') : 'NULL';
			
			server.getHistoricalCountByArea(end_time, function(data){
				var responseData = prepareGeoJSON(res, data[0], req.param('format'));
				writeResponse(res, responseData);
			});
		});
	}

	app.get( new RegExp('/'+config.url_prefix+'/data/api/v1/infrastructure/.*'), function(req, res){
		// Get last segment of path - e.g. 'waterways' in '.../infrastructure/waterways'
		var infrastructureName = req.path.split("/").slice(-1)[0];
		// Fetch the infrastructure data from the DB
		server.getInfrastructure(infrastructureName, function(data){
			// Prepare the response data, cache it, and write out the response
			var responseData = prepareGeoJSON(res, data[0], req.param('format'));
			cachePermanently(req.originalUrl, responseData);
			writeResponse(res, responseData);
		});
	});

}

// Store in the memory cache with no timeout
function cachePermanently(cacheKey, data){
	cache.put(cacheKey, data);
}

// Store in the memory cache with timeout
function cacheTemporarily(cacheKey, data){
	cache.put(cacheKey, data, config.cache_timeout);
}

// 404 handling
app.use(function(req, res, next){
  res.send('Error 404 - Page not found', 404);
});

function prepareGeoJSON(res, data, format){
	var responseData = {};
	
	if (format === 'topojson' && data.features !== null){
		var topology = topojson.topology({collection:data},{"property-transform":function(object){return object.properties;}});

		responseData.code = 200;
		responseData.headers = {"Content-type":"application/json"};
		responseData.body = JSON.stringify(topology, "utf8");
	} else {
		// Firefox will hang and receive the request forever if it receives a content type and 0 bytes of data
		// In that case, data here is 'undefined', so we send nothing
		if (data) {
			responseData.code = 200;
			responseData.headers = {"Content-type":"application/json"};
			responseData.body = JSON.stringify(data, "utf8");
		} else {
			responseData.code = 204;
			responseData.headers = {};
			responseData.body = null;
		}
	}
	
	return responseData;
}

function writeResponse(res, responseData) {
	res.writeHead( responseData.code, responseData.headers );
	res.end( responseData.body );
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
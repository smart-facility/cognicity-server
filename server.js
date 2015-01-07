'use strict';

// server.js - nodejs server for cognicity framework

/**
 * @file REST service querying cognicity database and responding with JSON data
 * @copyright (c) Tomas Holderness & SMART Infrastructure Facility January 2014
 * @license Released under GNU GPLv3 License (see LICENSE.txt).
 * @example
 * Usage:	
 *     node server.js config.js
 */

// Node dependencies
var path = require('path');

// Modules
/** 
 * Express framework module, used to handle http server interface
 * @type {Object}
 */
var express = require('express');
/** 
 * Postgres 'pg' module, used for database interaction
 * @type {Object} 
 */
var pg = require('pg');
/** 
 * memory-cache module, used to cache responses
 * @type {Object} 
 */
var cache = require('memory-cache');
/** 
 * topojson module, used for response format conversion
 * @type {Object}
 */
var topojson = require('topojson');
/** 
 * Winston logger module, used for logging
 * @type {Object}
 */
var logger = require('winston');
// This variable name needs to be lower case otherwise the JSDoc output does not link to the class
/* 
 * CognicityServer module, application logic and database interaction is handled here
 * @type {CognicityServer}
 */
var CognicityServer = require('./CognicityServer.js');
// This variable name needs to be lower case otherwise the JSDoc output does not link to the class
/* 
 * Validation module, parameter validation functions
 * @type {Validation}
 */
var Validation = require('./Validation.js');
/** 
 * moment module, JS date/time manipulation library
 * @type {Object}
 */
var moment = require('moment');

// Read in config file from argument or default
var configFile = ( process.argv[2] ? process.argv[2] : 'config.js' );
var config = require( __dirname + path.sep + configFile );

/** 
 * Express application instance
 * @type {Object}
 */
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

// Handle postgres idle connection error (generated by RDS failover among other possible causes)
pg.on('error', function(err) {
	logger.error('Postgres connection error: ' + err);
	
	logger.info('Attempting to reconnect at intervals');
	
	var reconnectionAttempts = 0;
	var reconnectionFunction = function() {
		// Try and reconnect
		pg.connect(config.pg.conString, function(err, client, done){
			if (err) {
				reconnectionAttempts++;
				if (reconnectionAttempts >= config.pg.reconnectionAttempts) {
					// We have tried the maximum number of times, exit in failure state
					logger.error( 'Postgres reconnection failed' );
					logger.error( 'Maximum reconnection attempts reached, exiting' );
					exitWithStatus(1);
				} else {
					// If we failed, try and reconnect again after a delay
					logger.error( 'Postgres reconnection failed, queuing next attempt for ' + config.pg.reconnectionDelay + 'ms' );
					setTimeout( reconnectionFunction, config.pg.reconnectionDelay );
				}
			} else {
				// If we succeeded server will begin to respond again
				logger.info( 'Postgres connection re-established' );
			}
		});			
	};
	
	reconnectionFunction();
});

// Verify DB connection is up
pg.connect(config.pg.conString, function(err, client, done){
	if (err){
		logger.error("DB Connection error: " + err);
		logger.error("Fatal error: Application shutting down");
		done();
		exitWithStatus(1);
	}
});

/*
 * CognicityServer interface module
 * @type {CognicityServer}
 */
var server = new CognicityServer(config, logger, pg); // Variable needs to be lowercase or jsdoc output is not correctly linked
var validation = new Validation();

/**
 * Winston stream function we can plug in to express so we can capture its logs along with our own
 * @type {Object}
 */
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

// Route empty API path to docs
app.get('/'+config.url_prefix+'/data/api', function(req, res){
	res.redirect('/'+config.url_prefix+'/in/data/api');
});

// Route empty API path to docs
app.get('/'+config.url_prefix+'/data/api/v1', function(req, res){
	res.redirect('/'+config.url_prefix+'/in/data/api');
});

// Route data path to docs
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
	app.get('/'+config.url_prefix+'/data/api/v1/reports/confirmed', function(req, res, next){
		// No options from request passed to internal functions, default data parameters only.
		server.getReports({}, function(err, data){
			if (err) {
				next(err);
			} else {
				// Prepare the response data, cache it, and write out the response
				var responseData = prepareResponse(res, data[0], req.param('format'));
				cacheTemporarily(req.originalUrl, responseData);
				writeResponse(res, responseData);
			}
		});
	});

	// Data route for unconfirmed reports
	app.get('/'+config.url_prefix+'/data/api/v1/reports/unconfirmed', function(req, res, next){
		// No options passed
		server.getUnConfirmedReports({}, function(err, data){
			if (err) {
				next(err);
			} else {
				// Prepare the response data, cache it, and write out the response
				var responseData = prepareResponse(res, data[0], req.param('format'));
				cacheTemporarily(req.originalUrl, responseData);
				writeResponse(res, responseData);
			}
		});
	});

	if (config.aggregates === true){

		// Data route for spatio-temporal aggregates
		app.get('/'+config.url_prefix+'/data/api/v1/aggregates/live', function(req, res, next){
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
			server.getCountByArea({polygon_layer:tbl,start:start}, function(err, data){
				if (err) {
					next(err);
				} else {
					// Prepare the response data, cache it, and write out the response
					var responseData = prepareResponse(res, data[0], req.param('format'));
					cacheTemporarily(req.originalUrl, responseData);
					writeResponse(res, responseData);
				}
			});
		});

		// Data route for historical aggregate archive
		app.get('/'+config.url_prefix+'/data/api/v1/aggregates/archive', function(req, res, next){
			var options = {};
			var err;
			
			// Parse start time parameter or use default
			if ( req.param('start_time') ) {
				options.start_time = req.param('start_time');
				options.start_time = moment( req.param('start_time'), moment.ISO_8601 ).unix();
			} else {
				options.start_time = Math.floor( Date.now() / 1000 - (60*60*6) ); // Default - 1 hour ago
			}			
			// Validate parameter
			if ( !validation.validateNumberParameter(options.start_time, 0, Date.now()) ) {
				err = new Error("'start_time' parameter is not valid, it must be an ISO8601 string for a time between 1970 and now");
				err.status = 400;
				next(err);
				return;
			}
			
			// Parse blocks parameter or use default
			if ( req.param('blocks') ) {
				options.blocks = Math.floor( Number(req.param('blocks')) );
			} else {
				options.blocks = 6; // Default - 6 hours
			}
			// Validate parameter
			if ( !validation.validateNumberParameter(options.blocks, 1, 24) ) {
				err = new Error("'blocks' parameter is not valid, it must be a number between 1 and 24");
				err.status = 400;
				next(err);
				return;
			}
			
			// Set polygon_layer to default value defined by config
			options.polygon_layer = config.pg.aggregate_levels[ config.api.aggregates.archive.level ];
			
			server.getHistoricalCountByArea(options, function(err, data){
				if (err) {
					next(err);
				} else {
					var responseData = prepareResponse(res, data[0], req.param('format'));
					writeResponse(res, responseData);
				}
			});
		});
	}

	app.get( new RegExp('/'+config.url_prefix+'/data/api/v1/infrastructure/.*'), function(req, res, next){
		// Get last segment of path - e.g. 'waterways' in '.../infrastructure/waterways'
		var infrastructureName = req.path.split("/").slice(-1)[0];
		// Fetch the infrastructure data from the DB
		server.getInfrastructure(infrastructureName, function(err, data){
			if (err) {
				next(err);
			} else {
				// Prepare the response data, cache it, and write out the response
				var responseData = prepareResponse(res, data[0], req.param('format'));
				cachePermanently(req.originalUrl, responseData);
				writeResponse(res, responseData);
			}
		});
	});

}

/** 
 * Store the response in the memory cache with no timeout 
 * @param {String} cacheKey Key for the cache entry
 * @param {Object} data Data to store in the cache
 */
function cachePermanently(cacheKey, data){
	cache.put(cacheKey, data);
}

/** 
 * Store the response the memory cache with timeout 
 * @param {String} cacheKey Key for the cache entry
 * @param {Object} data Data to store in the cache
 */
function cacheTemporarily(cacheKey, data){
	cache.put(cacheKey, data, config.cache_timeout);
}

// 404 handling
app.use(function(req, res, next){
  res.send('Error 404 - Page not found', 404);
});

// Error handler function
app.use(function(err, req, res, next){
	// TODO Uncomment this code when the client can cope with error status codes
	logger.error( "Express error: " + err.status + ", " + err.message + ", " + err.stack );
//	res.status( err.status || 500 );
//	res.send( err.message );
	
	// TODO Delete this code when the client can cope with error status codes
	writeResponse( res, { code: 204, headers: {}, body: null } );
});

/**
 * Prepare the response data for sending to the client.
 * Will optionally format the data as topojson if this is requested via the 'format' parameter.
 * Returns a response object containing everything needed to send a response which can be sent or cached.
 * 
 * @param {Object} res The express 'res' response object
 * @param {Object} data The data we're going to return to the client
 * @param {String} format Optional format parameter for the response data; either nothing or 'topojson'
 * @returns {Object} Response object with code, headers and body properties.
 */
function prepareResponse(res, data, format){
	var responseData = {};
	
	if (format === 'topojson' && data.features){
		// Convert to topojson and construct the response object
		var topology = topojson.topology({collection:data},{"property-transform":function(object){return object.properties;}});

		responseData.code = 200;
		responseData.headers = {"Content-type":"application/json"};
		responseData.body = JSON.stringify(topology, "utf8");
	} else {
		// Construct the response object in JSON format or an empty (but successful) response
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

/**
 * Write a response object to the client using express.
 * Will write the response code, response headers and response body, and then end the response stream.
 * 
 * @param {Object} res Express 'res' response object
 * @param {Object} responseData The response data object with code, headers and body properties.
 */
function writeResponse(res, responseData) {
	res.writeHead( responseData.code, responseData.headers );
	res.end( responseData.body );
}

// Use the PORT environment variable (e.g. from AWS Elastic Beanstalk) or use 8081 as the default port
logger.info( "Application starting, listening on port " + config.port );
app.listen(config.port);

// FIXME This is a workaround for https://github.com/flatiron/winston/issues/228
// If we exit immediately winston does not get a chance to write the last log message.
// So we wait a short time before exiting.
function exitWithStatus(exitStatus) {
	logger.info( "Exiting with status " + exitStatus );
	setTimeout( function() {
		process.exit(exitStatus);
	}, 500 );
}

// Catch kill and interrupt signals and log a clean exit status
process.on('SIGTERM', function() {
	logger.info('SIGTERM: Application shutting down');
	exitWithStatus(0);
});
process.on('SIGINT', function() {
	logger.info('SIGINT: Application shutting down');
	exitWithStatus(0);
});

// Catch unhandled exceptions, log, and exit with error status
process.on('uncaughtException', function (err) {
	logger.error('uncaughtException: ' + err.message + ", " + err.stack);
	logger.error("Fatal error: Application shutting down");
	exitWithStatus(1);
});
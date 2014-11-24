'use strict';

//daemon.js - Daemon script for cognicity-reports module

/* jshint node:true */
/* jshint unused:vars */ // We want to keep function parameters on callbacks like the originals
/* jshint curly:false */ // Don't require curly brackets around one-line statements

//server.js - nodejs server for cognicity framework
//Tomas Holderness January 2014

// Modules
var path = require('path');
var express = require('express');
var pg = require('pg');
var cache = require('memory-cache');
var topojson = require('topojson');
/** Winston logger module */
var logger = require('winston');

// Read in config file from argument or default
var configFile = ( process.argv[2] ? process.argv[2] : 'config.js' );
var config = require( __dirname + path.sep + configFile );

// Express
var app = express();

// Logging
// Configure custom File transport to write plain text messages
var logPath = config.logger.path + path.sep + config.instance + ".log";
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

// Define a winston stream function we can plug in to express so we can
// capture its logs along with our own
var winstonStream = {
    write: function(message, encoding){
    	logger.info(message.slice(0, -1));
    }
};
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

// Function for database calls
function dataQuery(pgcon, sql, callback){
	pg.connect(pgcon, function(err, client, done){
		client.query(sql, function(err, result){
			if (err){
				logger.error(sql +'\n'+ err);
				callback({"data":null});
			}
			else if (result && result.rows){
				if (result.rows.length === 0){
					callback({"data":null});
					done();
				}
				else{
					callback(result.rows);
					done();
				}
			}
			// something bad happened, return data:null, so client can handle error.
			else {
				callback({"data":null});
				done();
			}
		});
	});
}

//Cache reports
function cacheReports(name, data){
	cache.put(name, data, config.cache_timeout);
}

function getReports(options, callback){

	// Default parameters for this data
	// Time parameters hard coded for operation
	var param = ({
		start: Math.floor(Date.now()/1000 - 3600), //60 minutes ago.
		end:  Math.floor(Date.now()/1000), // now
		limit: config.pg.limit // user adjustable limit
	});

	for (var key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key];
		}
	}

	// SQL
	var sql = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.the_geom)::json As geometry, row_to_json((SELECT l FROM (SELECT pkey, created_at at time zone 'ICT' created_at, text) As l)) As properties FROM "+config.pg.tbl_reports+" As lg WHERE created_at >= to_timestamp("+param.start+") AND created_at <= to_timestamp("+param.end+") ORDER BY created_at DESC LIMIT "+param.limit+")As f ;";

	// Call data query
	dataQuery(config.pg.conString, sql, callback);
}

// Unconfirmed reports
function getUnConfirmedReports(options, callback){

	// Default parameters for this data
	var param = ({
		start: Math.floor(Date.now()/1000 - 3600), //60 minutes ago.
		end:  Math.floor(Date.now()/1000), //now
		limit: config.pg.uc_limit //user adjustable limit
	});

	for (var key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key];
		}
	}

	// SQL
	var sql = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.the_geom)::json As geometry, row_to_json((SELECT l FROM (SELECT pkey) As l)) As properties FROM "+config.pg.tbl_reports_unconfirmed+" As lg WHERE created_at >= to_timestamp("+param.start+") AND created_at <= to_timestamp("+param.end+") ORDER BY created_at DESC LIMIT "+param.limit+")As f ;";
	// Call data query
	dataQuery(config.pg.conString, sql, callback);
}

// Function to count unconfirmed reports within given polygon layer (e.g. wards)
function getCountByArea(options, callback){

	// Default parameters for this data
	var param = ({
		start: Math.floor(Date.now()/1000 - 3600), //60 minutes ago
		end:  Math.floor(Date.now()/1000), // now
		point_layer_uc: config.pg.tbl_reports_unconfirmed, // unconfirmed reports
		point_layer: config.pg.tbl_reports, //confirmed reports
		polygon_layer: config.pg.tbl_polygon_0 // smallest scale polygon table
	});

	for (var key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key];
		}
	}
	// SQL
var sql = "SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features FROM (SELECT 'Feature' AS type, ST_AsGeoJSON(lg.the_geom)::json As geometry,  row_to_json((SELECT l FROM (SELECT lg.pkey, lg.area_name as level_name, lg.sum_count as count) AS l)) AS properties  FROM (SELECT c1.pkey, c1.area_name, c1.the_geom, c1.count+c2.count sum_count  FROM (SELECT p1.pkey, p1.area_name, p1.the_geom, COALESCE(count.count,0) count  FROM "+param.polygon_layer+" AS p1 LEFT OUTER JOIN(SELECT b.pkey, count(a.pkey)  FROM "+param.point_layer_uc+" a, "+param.polygon_layer+" b WHERE ST_WITHIN(a.the_geom, b.the_geom) AND a.created_at >=to_timestamp("+param.start+") AND a.created_at <= to_timestamp("+param.end+") GROUP BY b.pkey) as count ON (p1.pkey = count.pkey)) as c1, ( SELECT p1.pkey, COALESCE(count.count,0) count  FROM "+param.polygon_layer+" AS p1 LEFT OUTER JOIN(SELECT b.pkey, count(a.pkey)  FROM "+param.point_layer+" a, "+param.polygon_layer+" b WHERE ST_WITHIN(a.the_geom, b.the_geom) AND a.created_at >= to_timestamp("+param.start+") AND a.created_at <= to_timestamp("+param.end+") GROUP BY b.pkey) as count ON (p1.pkey = count.pkey)) as c2 WHERE c1.pkey=c2.pkey ORDER BY pkey) AS lg) AS f;";

	// Call data query
	dataQuery(config.pg.conString, sql, callback);
}

// Function to cache aggregates of report counts per polygon area
function cacheCount(name, data){
	cache.put(name, data, config.cache_timeout);
}

//Sum of confirmed and unconfirmed aggregates from archive
function getHistoricalCountByArea(end_time, callback){

	var sql = "SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features FROM (SELECT 'Feature' AS type, ST_AsGeoJSON(lg.the_geom)::json AS geometry, row_to_json((SELECT l FROM (SELECT lg.level_name, lg.sum_count, lg.start_time, lg.end_time) AS l)) AS properties FROM (SELECT a.area_name as level_name, a.the_geom, b.count+c.count sum_count, b.start_time, b.end_time FROM jkt_rw_boundary a, rw_count_reports_confirmed b, rw_count_reports_unconfirmed c WHERE b.rw_pkey = a.pkey AND b.rw_pkey = c.rw_pkey AND b.end_time = to_timestamp("+end_time+") AND c.end_time = to_timestamp("+end_time+")) AS lg) AS f;";

	//Call data query
	dataQuery(config.pg.conString, sql, callback);
}

function getInfrastructure(name, callback){

	var sql = "SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features FROM (SELECT 'Feature' AS type, ST_AsGeoJSON(lg.the_geom)::json AS geometry, row_to_json((SELECT l FROM (SELECT name) as l)) AS properties FROM "+config.pg.infrastructure_tbls[name]+" AS lg) AS f;";

	//Call data query
	dataQuery(config.pg.conString, sql, callback);
}

//Function to cache infrastructure on first call, no timeout set
function cacheInfrastructure(name, data){
	cache.put(name, data);
}

if (config.data === true){

	// Data route for reports
	app.get('/'+config.url_prefix+'/data/api/v1/reports/confirmed', function(req, res){
	//No options from request passed to internal functions, default data parameters only.

		var opts = {};

		if (cache.get('reports') === null){
			getReports(opts, function(data){
				cacheReports('reports', data);
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
				getUnConfirmedReports(opts, function(data){
					cacheReports('reports_unconfirmed', data);
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
						for (var i in config.pg.aggregate_levels)break; level = i;
						tbl = config.pg.aggregate_levels[level];
					}
					
					var hours;
					var start;
					//3 hours
					if (req.param('hours') && req.param('hours') == 3){
						hours = req.param('hours');
						start = Math.floor(Date.now()/1000 - 10800);
					}
					//6 hours
					else if (req.param('hours') && req.param('hours') == 6){
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
						getCountByArea({polygon_layer:tbl,start:start}, function(data){
							cacheCount('count_'+level+'_'+hours, data);

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
			getHistoricalCountByArea(end_time, function(data){
				writeGeoJSON(res, data[0], req.param('format'));
			});
		});
	}

	//Data route for waterways infrastructure
	app.get('/'+config.url_prefix+'/data/api/v1/infrastructure/waterways', function(req, res){
		if (cache.get('waterways') === null){
			getInfrastructure('waterways', function(data){
				cacheInfrastructure('waterways', data);
				writeGeoJSON(res, data[0], req.param('format'));
			});
		}
		else {
			writeGeoJSON(res, cache.get('waterways')[0], req.param('format'));
		}
	});

	//Data route for pump stations
	app.get('/'+config.url_prefix+'/data/api/v1/infrastructure/pumps', function(req, res){
		if (cache.get('pumps') === null){
			getInfrastructure('pumps', function(data){
				cacheInfrastructure('pumps', data);
				writeGeoJSON(res, data[0], req.param('format'));
			});
		}
		else {
			writeGeoJSON(res, cache.get('pumps')[0], req.param('format'));
		}
	});

	//Data route for floodgates
	app.get('/'+config.url_prefix+'/data/api/v1/infrastructure/floodgates', function(req, res){
		if (cache.get('floodgates') === null){
			getInfrastructure('floodgates', function(data){
				cacheInfrastructure('floodgates', data);
				writeGeoJSON(res, data[0], req.param('format'));
			});
		}
		else {
			writeGeoJSON(res, cache.get('floodgates')[0], req.param('format'));
		}
	});
}

// Function to return GeoJson or TopoJson data to stream
function writeGeoJSON(res, data, format){
	if (format === 'topojson' && data.features !== null){
		//Clone the object because topojson edits in place.
		var topo = JSON.parse(JSON.stringify(data));
		var topology = topojson.topology({collection:topo},{"property-transform":function(object){return object.properties;}});


		res.writeHead(200, {"Content-type":"application/json"});
		res.end(JSON.stringify(topology, "utf8"));

		}
	else{
		res.writeHead(200, {"Content-type":"application/json"});
		res.end(JSON.stringify(data, "utf8"));
		}
}

// 404 handling
app.use(function(req, res, next){
  res.send('Error 404 - Page not found', 404);
});

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
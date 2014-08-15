//server.js - nodejs server for cognicity framework
//Tomas Holderness January 2014

// Modules
var sys = require('util');
var fs = require('fs');
var http = require('http');
var express = require('express');
var pg = require('pg');
var cache = require('memory-cache');
var topojson = require('topojson');
var api = require(__dirname+'/api.json');

// Configuration
if (process.argv[2]){
	var config = require(__dirname+'/'+process.argv[2]);
	}
else{
	throw new Error('No config file. Usage: node app.js config.js')
	}

// Express
var app = express();

// Logging
var logfile = fs.createWriteStream(__dirname+'/'+config.instance+".log", {flags:'a'});
app.use(express.logger({stream:logfile}));

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

// Function for database calls
function dataQuery(pgcon, sql, callback){
	pg.connect(pgcon, function(err, client, done){
		client.query(sql, function(err, result){
			if (err){
				console.log(sql +'\n'+ err);
				callback({"data":null})
			}
			else if (result && result.rows){
				if (result.rows.length == 0){
					callback({"data":null})
					done();
				}
				else{
					callback(result.rows);
					done()
				}
			}
			// something bad happened, return data:null, so client can handle error.
			else {
				callback({"data":null})
				done();
			}
		})
	})
};

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

	for (key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key]
		}
	}

	// SQL
	var sql = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(ST_Transform(lg.the_geom,4326))::json As geometry, row_to_json((SELECT l FROM (SELECT pkey, created_at at time zone 'ICT' created_at, source, text) As l)) As properties FROM "+config.pg.tbl_reports+" As lg WHERE created_at >= to_timestamp("+param.start+") AND created_at <= to_timestamp("+param.end+") ORDER BY created_at DESC LIMIT "+param.limit+")As f ;"

	// Call data query
	dataQuery(config.pg.conString, sql, callback)
}

// Unconfirmed reports
function getUnConfirmedReports(options, callback){

	// Default parameters for this data
	var param = ({
		start: Math.floor(Date.now()/1000 - 1800), //30 minutes ago.
		end:  Math.floor(Date.now()/1000), //now
		limit: config.pg.uc_limit //user adjustable limit
	});

	for (key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key]
		}
	}

	// SQL
	var sql = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(ST_Transform(lg.the_geom,4326))::json As geometry, row_to_json((SELECT l FROM (SELECT pkey) As l)) As properties FROM "+config.pg.tbl_reports_unconfirmed+" As lg WHERE created_at >= to_timestamp("+param.start+") AND created_at <= to_timestamp("+param.end+") ORDER BY created_at DESC LIMIT "+param.limit+")As f ;"
	// Call data query
	dataQuery(config.pg.conString, sql, callback)
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

	for (key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key]
		}
	}
	// SQL
var sql = "SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features FROM (SELECT 'Feature' AS type, ST_AsGeoJSON(lg.the_geom)::json As geometry,  row_to_json((SELECT l FROM (SELECT lg.pkey, lg.area_name as level_name, lg.sum_count as count) AS l)) AS properties  FROM (SELECT c1.pkey, c1.area_name, c1.the_geom, c1.count+c2.count sum_count  FROM (SELECT p1.pkey, p1.area_name, p1.the_geom, COALESCE(count.count,0) count  FROM "+param.polygon_layer+" AS p1 LEFT OUTER JOIN(SELECT b.pkey, count(a.pkey)  FROM "+param.point_layer_uc+" a, "+param.polygon_layer+" b WHERE ST_WITHIN(a.the_geom, b.the_geom) AND a.created_at >=to_timestamp("+param.start+") AND a.created_at <= to_timestamp("+param.end+") GROUP BY b.pkey) as count ON (p1.pkey = count.pkey)) as c1, ( SELECT p1.pkey, COALESCE(count.count,0) count  FROM "+param.polygon_layer+" AS p1 LEFT OUTER JOIN(SELECT b.pkey, count(a.pkey)  FROM "+param.point_layer+" a, "+param.polygon_layer+" b WHERE ST_WITHIN(a.the_geom, b.the_geom) AND a.created_at >= to_timestamp("+param.start+") AND a.created_at <= to_timestamp("+param.end+") GROUP BY b.pkey) as count ON (p1.pkey = count.pkey)) as c2 WHERE c1.pkey=c2.pkey ORDER BY pkey) AS lg) AS f;"

	// Call data query
	dataQuery(config.pg.conString, sql, callback)
}

// Function to cache aggregates of report counts per polygon area
function cacheCount(name, data){
	cache.put(name, data, config.cache_timeout);
}

//Sum of confirmed and unconfirmed aggregates from archive
function getHistoricalCountByArea(end_time, callback){

	var sql = "SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features FROM (SELECT 'Feature' AS type, ST_AsGeoJSON(lg.the_geom)::json AS geometry, row_to_json((SELECT l FROM (SELECT lg.level_name, lg.sum_count, lg.start_time, lg.end_time) AS l)) AS properties FROM (SELECT a.area_name as level_name, a.the_geom, b.count+c.count sum_count, b.start_time, b.end_time FROM jkt_rw_boundary a, rw_count_reports_confirmed b, rw_count_reports_unconfirmed c WHERE b.rw_pkey = a.pkey AND b.rw_pkey = c.rw_pkey AND b.end_time = to_timestamp("+end_time+") AND c.end_time = to_timestamp("+end_time+")) AS lg) AS f;"

	//Call data query
	dataQuery(config.pg.conString, sql, callback)
}

function getInfrastructure(name, callback){

	var sql = "SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features FROM (SELECT 'Feature' AS type, ST_AsGeoJSON(lg.the_geom)::json AS geometry, row_to_json((SELECT l FROM (SELECT name) as l)) AS properties FROM "+config.pg.infrastructure_tbls[name]+" AS lg) AS f;"

	//Call data query
	dataQuery(config.pg.conString, sql, callback);
}

//Function to cache infrastructure on first call, no timeout set
function cacheInfrastructure(name, data){
	cache.put(name, data);
}

if (config.data == true){

	// Serving API information from api.json
	app.get('/'+config.url_prefix+'/data', function(req, res){

		// Write the cached file out with white spaces for readability
		res.writeHead(200, {"Content-type":"application/json"});
		res.end(JSON.stringify(api, "utf8", 2));

	});

	// Data route for reports
	app.get('/'+config.url_prefix+'/data/api/v1/reports/confirmed', function(req, res){
	//No options from request passed to internal functions, default data parameters only.

		opts = {}

		if (cache.get('reports') == null){
			getReports(opts, function(data){
				cacheReports('reports', data);
				writeGeoJSON(res, data[0], req.param('format'));
			})
		}
		else {
			writeGeoJSON(res, cache.get('reports')[0], req.param('format'));
			}
		});

	//Data route for unconfirmed reports
	app.get('/'+config.url_prefix+'/data/api/v1/reports/unconfirmed', function(req, res){

			//No options passed
			opts = {}

			if (cache.get('reports_unconfirmed') == null){
				getUnConfirmedReports(opts, function(data){
					cacheReports('reports_unconfirmed', data);
					writeGeoJSON(res, data[0], req.param('format'));
				})
			}
			else {
				writeGeoJSON(res, cache.get('reports_unconfirmed')[0], req.param('format'));
			}
		});

	if (config.aggregates == true){

		//Data route for spatio-temporal aggregates
		app.get('/'+config.url_prefix+'/data/api/v1/aggregates/live', function(req, res){

					//Organise parameter options
					if (req.param('level') && config.pg.aggregate_levels[req.param('level')] != undefined){
						var level = req.param('level');
						var tbl = config.pg.aggregate_levels[level];
					}
					else{
						//Use first aggregate level as default
						for (var i in config.pg.aggregate_levels)break; var level = i;
						var tbl = config.pg.aggregate_levels[level];
					};
					//3 hours
					if (req.param('hours') && req.param('hours') == 3){
						var hours = req.param('hours');
						var start = Math.floor(Date.now()/1000 - 10800);
					}
					//6 hours
					else if (req.param('hours') && req.param('hours') == 6){
						var hours = req.param('hours');
						var start = Math.floor(Date.now()/1000 - 21600);
					}
					//Default to one hour
					else {
						var hours = 1;
						var start = Math.floor(Date.now()/1000 - 3600);
					}
					// Get data from db and update cache.
					if (cache.get('count_'+level+'_'+hours) == null){
						getCountByArea({polygon_layer:tbl,start:start}, function(data){
							cacheCount('count_'+level+'_'+hours, data);

							// Write data
							writeGeoJSON(res, data[0], req.param('format'));
						})
					}

				else {
					//Return cached data
					writeGeoJSON(res, cache.get('count_'+level+'_'+hours)[0], req.param('format'));
				}
		});

		//Data route for historical aggregate archive
		app.get('/'+config.url_prefix+'/data/api/v1/aggregates/archive', function(req, res){
			if (req.param('end_time')){
				var end_time = req.param('end_time');
			}
			else {
				var end_time = 'NULL';
			}
			getHistoricalCountByArea(end_time, function(data){
				writeGeoJSON(res, data[0], req.param('format'));
			});
		});
	}

	//Data route for waterways infrastructure
	app.get('/'+config.url_prefix+'/data/api/v1/infrastructure/waterways', function(req, res){
		if (cache.get('waterways') == null){
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

	//Data route for flood gates
}

// Function to return GeoJson or TopoJson data to stream
function writeGeoJSON(res, data, format){
	if (format === 'topojson' && data.features != null){
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

app.listen(config.port);

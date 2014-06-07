//server.js - nodejs server for cognicity framework
//Tomas Holderness January 2014

// Modules
var sys = require('util');
var fs = require('fs');
var http = require('http');
var express = require('express');
var pg = require('pg');
var cache = require('memory-cache');

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

//Function for database calls
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

function getReports(options, callback){

	// Default parameters for this data
	var param = ({
		start: config.pg.start,
		end:  Math.floor(Date.now()/1000), // now
		limit: config.pg.limit // user adjustable limit
	});

	for (key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key]
		}
	}

	//SQL
	var sql = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(ST_Transform(lg.the_geom,4326))::json As geometry, row_to_json((SELECT l FROM (SELECT pkey, created_at at time zone 'ICT' created_at, source, text) As l)) As properties FROM "+config.pg.tbl_reports+" As lg WHERE created_at >= to_timestamp("+param.start+") AND created_at <= to_timestamp("+param.end+") ORDER BY created_at DESC LIMIT "+param.limit+")As f ;"

	// Call data query
	dataQuery(config.pg.conString, sql, callback)
}

function cacheReports(data){
	cache.put('reports', data, config.cache_timeout);
}

//Unconfirmed reports
function getUnConfirmedReports(options, callback){

	// Default parameters for this data
	var param = ({
		start: config.pg.start,
		end:  Math.floor(Date.now()/1000), // now
		limit: config.pg.uc_limit // user adjustable limit
	});

	for (key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key]
		}
	}

	//SQL
	var sql = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(ST_Transform(lg.the_geom,4326))::json As geometry, row_to_json((SELECT l FROM (SELECT pkey) As l)) As properties FROM "+config.pg.tbl_reports_unconfirmed+" As lg WHERE created_at >= to_timestamp("+param.start+") AND created_at <= to_timestamp("+param.end+") ORDER BY created_at DESC LIMIT "+param.limit+")As f ;"

	// Call data query
	dataQuery(config.pg.conString, sql, callback)
}

function cacheUnConfirmedReports(data){
	cache.put('reports_unconfirmed', data, config.cache_timeout);
}

function getCountRW(options, callback){

	// Default parameters for this data
	var param = ({
		start: config.pg.start,
		end:  Math.floor(Date.now()/1000), // now
		limit: config.pg.limit // user adjustable limit
	});

	for (key in param){
		if (options.hasOwnProperty(key)){
			param[key] = options[key]
		}
	}
	//Note - still needs parameterising and normalising
	//SQL
	var sql = "SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(ST_Transform(lg.the_geom,4326))::json As geometry, row_to_json((SELECT l FROM (SELECT lg.objectid, COALESCE(count.count,0) count) As l)) As properties FROM batas_rw As lg LEFT OUTER JOIN (SELECT b.objectid, count(a.pkey) count FROM unconfirmed_reports a, batas_rw b WHERE ST_Within(a.the_geom, b.the_geom) GROUP BY b.objectid) as count ON (lg.objectid = count.objectid) ORDER BY count DESC) As f;"

	// Call data query
	dataQuery(config.pg.conString, sql, callback)
}

function cacheCountRW(data){
	cache.put('count_rw', data, config.cache_timeout);
}

if (config.data == true){
	// Data route for reports
	app.get('/'+config.url_prefix+'/data/reports.json', function(req, res){

		opts = {}

		if (req.param('type') == 'unconfirmed'){

				if (cache.get('reports_unconfirmed') == null){
					getUnConfirmedReports(opts, function(data){
						cacheUnConfirmedReports(data);
						res.writeHead(200, {"Content-type":"application/json"});
						res.end(JSON.stringify(data[0], "utf8")); //get only db row.
						})
					}

				else {
					res.writeHead(200, {"Content-type":"application/json"});
					res.end(JSON.stringify(cache.get('reports_unconfirmed')[0], "utf8"));
					}
		}
		else {
			if (cache.get('reports') == null){
				getReports(opts, function(data){
					cacheReports(data);
					res.writeHead(200, {"Content-type":"application/json"});
					res.end(JSON.stringify(data[0], "utf8")); //get only db row.
					})
			}

		else {
			res.writeHead(200, {"Content-type":"application/json"});
			res.end(JSON.stringify(cache.get('reports')[0], "utf8"));
			}
		}
	});

	//Data route for spatio-temporal aggregates
	app.get('/'+config.url_prefix+'/data/aggregates.json', function(req, res){

				opts = {}

				if (cache.get('count_rw') == null){
					getCountRW(opts, function(data){
						cacheCountRW(data);
						res.writeHead(200, {"Content-type":"application/json"});
						res.end(JSON.stringify(data[0], "utf8")); //get only db row.
						})
					}

				else {
					res.writeHead(200, {"Content-type":"application/json"});
					res.end(JSON.stringify(cache.get('count_rw')[0], "utf8"));
					}
	});

}

// 404 handling
app.use(function(req, res, next){
  res.send('Error 404 - Page not found', 404);
});

app.listen(config.port);

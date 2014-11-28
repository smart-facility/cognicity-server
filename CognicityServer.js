'use strict';

var CognicityServer = function(
	config,
	cache,
	logger,
	pg	
	){
	
	this.config = config;
	this.cache = cache;
	this.logger = logger;
	this.pg = pg;	
};

CognicityServer.prototype = {
	config: null,
	cache: null,
	logger: null,
	pg: null,
	
	//Function for database calls
	dataQuery: function(pgcon, queryObject, callback){
		var self = this;
		
		self.logger.debug("queryObject:"+JSON.stringify(queryObject));
		self.pg.connect(pgcon, function(err, client, done){
			if (err){
				self.logger.error("dataQuery: " + JSON.stringify(queryObject) + ", " + err);
				done();
				callback({"data":null});
				return;
			}
			
			client.query(queryObject, function(err, result){
				if (err){
					self.logger.error(JSON.stringify(queryObject) +'\n'+ err);
					done();
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
	},
	
	//Cache reports
	cacheReports: function(name, data){
		var self = this;
		
		self.cache.put(name, data, self.config.cache_timeout);
	},

	getReports: function(options, callback){
		var self = this;
		
		// Default parameters for this data
		// Time parameters hard coded for operation
		var param = ({
			start: Math.floor(Date.now()/1000 - 3600), //60 minutes ago.
			end:  Math.floor(Date.now()/1000), // now
			limit: self.config.pg.limit // user adjustable limit
		});

		for (var key in param){
			if (options.hasOwnProperty(key)){
				param[key] = options[key];
			}
		}

		// SQL
		var queryObject = {
			text: "SELECT 'FeatureCollection' As type, " + 
					"array_to_json(array_agg(f)) As features " +
				"FROM (SELECT 'Feature' As type, " + 
					"ST_AsGeoJSON(lg.the_geom)::json As geometry, " + 
					"row_to_json( " + 
						"(SELECT l FROM " +
							"(SELECT pkey, " +
							"created_at at time zone 'ICT' created_at, " +
							"text) " +
						" As l) " +
					") As properties " +
					"FROM " + self.config.pg.tbl_reports + " As lg " +
					"WHERE created_at >= to_timestamp($1) AND " +
						"created_at <= to_timestamp($2) " +
					"ORDER BY created_at DESC LIMIT $3" + 
				" ) As f ;",
			values: [
	            param.start,
	            param.end,
	            param.limit
			]
		};

		// Call data query
		self.dataQuery(self.config.pg.conString, queryObject, callback);
	},

	// Unconfirmed reports
	getUnConfirmedReports: function(options, callback){
		var self = this;
		
		// Default parameters for this data
		var param = ({
			start: Math.floor(Date.now()/1000 - 3600), //60 minutes ago.
			end:  Math.floor(Date.now()/1000), //now
			limit: self.config.pg.uc_limit //user adjustable limit
		});

		for (var key in param){
			if (options.hasOwnProperty(key)){
				param[key] = options[key];
			}
		}

		// SQL
		var queryObject = {
			text: "SELECT 'FeatureCollection' As type, " +
					"array_to_json(array_agg(f)) As features " +
				"FROM (SELECT 'Feature' As type, " +
					"ST_AsGeoJSON(lg.the_geom)::json As geometry, " +
					"row_to_json( " +
						"(SELECT l FROM " +
							"(SELECT pkey) " +
						"As l) " +
					") As properties " +
					"FROM " + self.config.pg.tbl_reports_unconfirmed + " As lg " +
					"WHERE created_at >= to_timestamp($1) AND " +
						"created_at <= to_timestamp($2) " +
					"ORDER BY created_at DESC LIMIT $3" +
				" ) As f ;",
			values: [
	            param.start,
	            param.end,
	            param.limit
			]
		};

		// Call data query
		self.dataQuery(self.config.pg.conString, queryObject, callback);
	},

	// Function to count unconfirmed reports within given polygon layer (e.g. wards)
	getCountByArea: function(options, callback){
		var self = this;

		// Default parameters for this data
		var param = ({
			start: Math.floor(Date.now()/1000 - 3600), //60 minutes ago
			end:  Math.floor(Date.now()/1000), // now
			point_layer_uc: self.config.pg.tbl_reports_unconfirmed, // unconfirmed reports
			point_layer: self.config.pg.tbl_reports, //confirmed reports
			polygon_layer: self.config.pg.tbl_polygon_0 // smallest scale polygon table
		});

		for (var key in param){
			if (options.hasOwnProperty(key)){
				param[key] = options[key];
			}
		}
		// SQL
		// Note that references to tables were left unparameterized as these cannot be passed by user
		var queryObject = {
			text: "SELECT 'FeatureCollection' AS type, " +
					"array_to_json(array_agg(f)) AS features " +
				"FROM (SELECT 'Feature' AS type, " +
					"ST_AsGeoJSON(lg.the_geom)::json As geometry," +
					"row_to_json( " +
						"(SELECT l FROM " +
							"(SELECT lg.pkey, " +
								"lg.area_name as level_name, " +
								"lg.sum_count as count " +
							") AS l " +
						") " +
					") AS properties " +
					"FROM ( " +
						"SELECT c1.pkey, " +
							"c1.area_name, " +
							"c1.the_geom, " +
							"c1.count+c2.count sum_count " +
						"FROM ( " +
							"SELECT p1.pkey, " +
								"p1.area_name, " +
								"p1.the_geom, " +
								"COALESCE(count.count,0) count " +
							"FROM " + param.polygon_layer + " AS p1 " +
							"LEFT OUTER JOIN ( " +
								"SELECT b.pkey, " +
									"count(a.pkey) " +
								"FROM " + param.point_layer_uc + " a, " + 
									param.polygon_layer + " b " +
								"WHERE ST_WITHIN(a.the_geom, b.the_geom) AND " +
									"a.created_at >=to_timestamp($1) AND " +
									"a.created_at <= to_timestamp($2) " +
								"GROUP BY b.pkey " +
							") as count " +
							"ON (p1.pkey = count.pkey) " +
						") as c1, ( " +
							"SELECT p1.pkey, " +
								"COALESCE(count.count,0) count  " +
							"FROM " + param.polygon_layer + " AS p1 " +
							"LEFT OUTER JOIN( " +
								"SELECT b.pkey, " +
									"count(a.pkey) " +
								"FROM " + param.point_layer + " a, " + 
									param.polygon_layer + " b " +
								"WHERE ST_WITHIN(a.the_geom, b.the_geom) AND " +
									"a.created_at >= to_timestamp($1) AND " +
									"a.created_at <= to_timestamp($2) " +
									"GROUP BY b.pkey) as count " +
							"ON (p1.pkey = count.pkey) " +
						") as c2 " +
						"WHERE c1.pkey=c2.pkey " +
						"ORDER BY pkey " +
					") AS lg " +
				") AS f;",
			values: [
			    param.start,
			    param.end
			]
		};

		// Call data query
		self.dataQuery(self.config.pg.conString, queryObject, callback);
	},

	// Function to cache aggregates of report counts per polygon area
	cacheCount: function(name, data){
		var self = this;
		
		self.cache.put(name, data, self.config.cache_timeout);
	},

	//Sum of confirmed and unconfirmed aggregates from archive
	getHistoricalCountByArea: function(end_time, callback){
		var self = this;
		
		var queryObject = {
			text: "SELECT 'FeatureCollection' AS type, " +
					"array_to_json(array_agg(f)) AS features " +
				"FROM (SELECT 'Feature' AS type, " +
					"ST_AsGeoJSON(lg.the_geom)::json AS geometry, " +
					"row_to_json( " +
						"(SELECT l FROM " +
							"(SELECT lg.level_name, lg.sum_count, lg.start_time, lg.end_time) AS l " +
						") " +
					") AS properties FROM (" +
						"SELECT a.area_name as level_name, " +
							"a.the_geom, " +
							"b.count+c.count sum_count, " +
							"b.start_time, " +
							"b.end_time " +
						"FROM jkt_rw_boundary a, " +
							"rw_count_reports_confirmed b, " +
							"rw_count_reports_unconfirmed c " +
						"WHERE b.rw_pkey = a.pkey AND " +
							"b.rw_pkey = c.rw_pkey AND " +
							"b.end_time = to_timestamp($1) AND " +
							"c.end_time = to_timestamp($1) " +
					") AS lg " +
				") AS f;",
			values: [
			    end_time
			]
		};

		//Call data query
		self.dataQuery(self.config.pg.conString, queryObject, callback);
	},

	getInfrastructure: function(name, callback){
		var self = this;
		
		var queryObject = {
			text: "SELECT 'FeatureCollection' AS type, " +
					"array_to_json(array_agg(f)) AS features " +
				"FROM (SELECT 'Feature' AS type, " +
					"ST_AsGeoJSON(lg.the_geom)::json AS geometry, " +
					"row_to_json( " +
						"(SELECT l FROM (SELECT name) as l) " +
					") AS properties " +
					"FROM " + self.config.pg.infrastructure_tbls[name] + " AS lg " +
				") AS f;",
			values: []		
		};

		//Call data query
		self.dataQuery(self.config.pg.conString, queryObject, callback);	
	},
	
	//Function to cache infrastructure on first call, no timeout set
	cacheInfrastructure: function(name, data){
		var self = this;
		
		self.cache.put(name, data);
	}
	
};

//Export our object constructor method from the module
module.exports = CognicityServer;
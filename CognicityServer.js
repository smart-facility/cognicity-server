'use strict';

/**
 * A CognicityServer object queries against the cognicity database and returns data to be returned
 * to the client via the REST service.
 * @constructor
 * @this {CognicityServer}
 * @param {Object} config The server configuration object loaded from the configuration file
 * @param {Object} logger Winston logger instance
 * @param {Object} pg Postgres 'pg' module instance
 */
var CognicityServer = function(
	config,
	logger,
	pg
	){

	this.config = config;
	this.logger = logger;
	this.pg = pg;
};

CognicityServer.prototype = {

	/**
	 * Server configuration object loaded from the configuration file
	 * @type {Object}
	 */
	config: null,

	/**
	 * Winston logger instance
	 * @type {Object}
	 */
	logger: null,

	/**
	 * 'pg' module Postgres interface instance
	 * @type {Object}
	 */
	pg: null,

	/**
	 * DB query callback
	 * @callback dataQueryCallback
	 * @param {Error} err An error instance describing the error that occurred, or null if no error
	 * @param {Object} data Response data object which is 'result.rows' from the pg module response
	 */

	/**
	 * Perform a query against the database using the parameterized query in the queryObject.
	 * Call the callback with error information or result information.
	 *
	 * @param {Object} queryObject Query object for parameterized postgres query
	 * @param {dataQueryCallback} callback Callback function for handling error or response data
	 */
	dataQuery: function(queryObject, callback){
		var self = this;

		self.logger.debug( "dataQuery: queryObject=" + JSON.stringify(queryObject) );

		self.pg.connect(self.config.pg.conString, function(err, client, done){
			if (err){
				self.logger.error("dataQuery: " + JSON.stringify(queryObject) + ", " + err);
				done();
				callback( new Error('Database connection error') );
				return;
			}

			client.query(queryObject, function(err, result){
				if (err){
					done();
					self.logger.error( "dataQuery: Database query failed, " + err.message + ", queryObject=" + JSON.stringify(queryObject) );
					callback( new Error('Database query error') );
				} else if (result && result.rows){
					self.logger.debug( "dataQuery: " + result.rows.length + " rows returned" );
					done();
					callback(null, result.rows);
				} else {
					// TODO Can we ever get to this point?
					done();
					callback( new Error('Unknown query error, queryObject=' + JSON.stringify(queryObject) ) );
				}
			});
		});
	},

	/**
	 * Get confirmed reports from the database.
	 * Call the callback function with error or response data.
	 * @param {Object} options Configuration options for the query
	 * @param {dataQueryCallback} callback Callback for handling error or response data
	 */
	getReports: function(options, callback){
		var self = this;

		// TODO Define default param values and param parsing in the server

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
		self.dataQuery(queryObject, callback);
	},

	/**
	 * Get unconfirmed reports from the database.
	 * Call the callback function with error or response data.
	 * @param {Object} options Configuration options for the query
	 * @param {dataQueryCallback} callback Callback for handling error or response data
	 */
	getUnConfirmedReports: function(options, callback){
		var self = this;

		// TODO Define default param values and param parsing in the server

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
		self.dataQuery(queryObject, callback);
	},

	/**
	* Count confirmed unconfirmed reports within a given number of hours
	* Call the callback function with error or response data.
	* @param {Object} options Configuration options for the query
	* @param {dataQueryCallback} callback Callback for handling error or response data
	*/
	getReportsCount: function(options, callback){
		var self = this;

		// TODO Define default param values and param parsing in the server

		// Default parameters for this data
		var param = ({
			start: Math.floor(Date.now()/1000 - 3600), //60 minutes ago
			end:  Math.floor(Date.now()/1000) // now
			});

		for (var key in param){
			if (options.hasOwnProperty(key)){
				param[key] = options[key];
			}
		}

		//SQL
		var queryObject = {
			text: "SELECT row_to_json(row) As data "+
				 "FROM (SELECT (SELECT count(pkey) FROM "+self.config.pg.tbl_reports_unconfirmed+
				" WHERE created_at >= to_timestamp($1) AND "+
					"created_at <= to_timestamp($2)) as uc_count, "+
					"(SELECT count(pkey) FROM "+self.config.pg.tbl_reports+
						" WHERE created_at >= to_timestamp($1) AND "+
						"created_at <= to_timestamp($2)) as c_count) as row;",
			values: [
							param.start,
							param.end
			]
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	},

	getReportsTimeSeries: function(options, callback){
			var self = this;

			// TODO Define default param values and param parsing in the server

			// Default parameters for this data
			var param = ({
				start: Math.floor(Date.now()/1000 - 86400), // 24 hours ago
				end:  Math.floor(Date.now()/1000) - 3600 // on hour ago
			});

			for (var key in param){
				if (options.hasOwnProperty(key)){
					param[key] = options[key];
				}
			}

			//SQL
			var queryObject = {
				text: "SELECT array_to_json(array_agg(row_to_json(row))) as data "+
					"FROM (SELECT to_char(c.stamp::time,'HH24:MI') stamp, c.count as c_count, uc.count as uc_count "+
					"FROM (SELECT time.stamp, COALESCE(count.count,0) count "+
					"FROM (select generate_series(date_trunc('hour',to_timestamp($1)), "+
						"date_trunc('hour',to_timestamp($2)), '1 hours') AT TIME ZONE 'ICT' as stamp) as time "+
					"LEFT OUTER JOIN (SELECT count(pkey), date_trunc('hour', created_at) AT TIME ZONE 'ICT' tweettime "+
						"FROM "+self.config.pg.tbl_reports_unconfirmed+" GROUP BY date_trunc('hour', created_at))as count "+
					"ON count.tweettime = time.stamp ORDER BY time.stamp ASC) as uc, "+
					"(SELECT time.stamp, COALESCE(count.count,0) count FROM "+
					"(select generate_series(date_trunc('hour',to_timestamp($1)), "+
					"date_trunc('hour',to_timestamp($2)), '1 hours') AT TIME ZONE 'ICT' as stamp) as time "+
					"LEFT OUTER JOIN (SELECT count(pkey), date_trunc('hour', created_at) AT TIME ZONE 'ICT' tweettime "+
					"FROM "+self.config.pg.tbl_reports+" GROUP BY date_trunc('hour', created_at))as count "+
					"ON count.tweettime = time.stamp ORDER BY time.stamp ASC) as c WHERE c.stamp = uc.stamp) as row;",
				values :
					[
						param.start,
						param.end
					]
			};

			// Call data query
			self.dataQuery(queryObject, callback);
	},

	/**
	 * Count unconfirmed reports within given polygon layer (e.g. wards)
	 * Call the callback function with error or response data.
	 * @param {Object} options Configuration options for the query
	 * @param {dataQueryCallback} callback Callback for handling error or response data
	 */
	getCountByArea: function(options, callback){
		var self = this;

		// Database table references
		var point_layer_uc = self.config.pg.tbl_reports_unconfirmed; // unconfirmed reports
		var point_layer = self.config.pg.tbl_reports; // confirmed reports

		// TODO Define default param values and param parsing in the server

		// Default parameters for this data
		var param = {
			start: Math.floor(Date.now()/1000 - 3600), //60 minutes ago
			end: Math.floor(Date.now()/1000), // now

			// TODO The default definition for this is duplicated in server.js and here, where's the best place for it to happen?
			polygon_layer: self.config.pg.aggregate_levels[ Object.keys(self.config.pg.aggregate_levels)[0] ]
		};

		for (var key in param) {
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
								"FROM " + point_layer_uc + " a, " +
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
								"FROM " + point_layer + " a, " +
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
		self.dataQuery(queryObject, callback);
	},

	/**
	 * Sum of confirmed and unconfirmed aggregates from archive
	 * @param {Object} options Options object, containing start_time, blocks and polygon_layer properties
	 * @param {dataQueryCallback} callback Callback for handling error or response data
	 */
	getHistoricalCountByArea: function(options, callback){
		var self = this;

		// TODO There is 1 second of overlap in the start and end times - we should fix this

		// Setup variables so we can do a count-by-area query for each block and join the responses together
		var blocksQueried = 0;
		var aggregateData = { blocks:[] };
		var queryOptions = {
			start: options.start_time,
			end: options.start_time + 3600,
			polygon_layer: options.polygon_layer
		};

		// Perform one count-by-area query for a single block, on completion recurse and continue
		// until we've done all the blocks. Then call the callback passed in to the function to
		// handle completion of the entire request.
		var chainQueries = function(err,data) {
			if (err) {
				// On error, return the error immediately and no data
				callback(err, null);
				return;

			} else {
				// Move on to the next block as this one completed
				blocksQueried++;

				// Transform the data for simplicity
				data = data[0];
				// Store the start and end times that this block was created for in the data
				data.start_time = new Date(queryOptions.start*1000).toISOString();
				data.end_time = new Date(queryOptions.end*1000).toISOString();
				// Store the new data in our list of blocks
				aggregateData.blocks.push(data);

				if ( blocksQueried === options.blocks ) {
					// If we've done all the blocks, call the main function success callback
					callback(null, [aggregateData]);
				} else {
					// Increase the start and end times by an hour for the next block
					queryOptions.start += 3600;
					queryOptions.end += 3600;
					// Recurse and handle the next block
					self.getCountByArea(queryOptions, chainQueries);
				}
			}
		};

		// Start building the data for the first block
		self.getCountByArea(queryOptions, chainQueries);
	},

	/**
	 * Sum of confirmed and unconfirmed aggregates from archive
	 * @param {String} name The key of the infrastructure configuration item
	 * @param {dataQueryCallback} callback Callback for handling error or response data
	 */
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

		// Call data query
		self.dataQuery(queryObject, callback);
	}

};

//Export our object constructor method from the module
module.exports = CognicityServer;

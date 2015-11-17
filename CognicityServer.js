'use strict';

// Validation module, parameter validation functions
var Validation = require('./Validation.js');

/**
 * A CognicityServer object queries against the cognicity database and returns data to be returned
 * to the client via the REST service.
 * @constructor
 * @param {config} config The server configuration object loaded from the configuration file
 * @param {object} logger Configured Winston logger instance
 * @param {object} pg Configured PostGres 'pg' module instance
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
	 * Server configuration
	 * @type {object}
	 */
	config: null,

	/**
	 * Configured Winston logger instance
	 * @type {object}
	 */
	logger: null,

	/**
	 * Configured 'pg' module PostGres interface instance
	 * @type {object}
	 */
	pg: null,

	/**
	 * DB query callback
	 * @callback DataQueryCallback
	 * @param {Error} err An error instance describing the error that occurred, or null if no error
	 * @param {object} data Response data object which is 'result.rows' from the pg module response
	 */

	/**
	 * Perform a query against the database using the parameterized query in the queryObject.
	 * Call the callback with error information or result information.
	 *
	 * @param {object} queryObject Query object for parameterized postgres query
	 * @param {string} queryObject.text The SQL query text for the parameterized query
	 * @param {Array} queryObject.values Values for the parameterized query
	 * @param {DataQueryCallback} callback Callback function for handling error or response data
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
					callback( new Error('Unknown query error, queryObject=' + JSON.stringify(queryObject)) );
				}
			});
		});
	},

	/**
	 * Get confirmed reports from the database.
	 * Call the callback function with error or response data.
	 * @param {object} options Configuration options for the query
	 * @param {number} options.start Unix timestamp for start of query period
	 * @param {number} options.end Unix timestamp for end of query period
	 * @param {string} options.tbl_reports Database table for confirmed reports
	 * @param {?number} options.limit Number of results to limit to, or null for all
	 * @param {DataQueryCallback} callback Callback for handling error or response data
	 */
	getReports: function(options, callback){
		var self = this;

		// Validate options
		var err;
		if ( !Validation.validateNumberParameter(options.start,0) ) err = new Error( "'start' parameter is invalid" );
		if ( !Validation.validateNumberParameter(options.end,0) ) err = new Error( "'end' parameter is invalid" );
		if ( !options.tbl_reports ) err = new Error( "'tbl_reports' option must be supplied" );
		if ( !options.limit && options.limit!==null ) err = new Error( "'limit' option must be supplied" );
		if (err) {
			callback(err);
			return;
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
							"source, " +
							"url, " +
							"image_url, " +
							"title, " +
							"text) " +
						" As l) " +
					") As properties " +
					"FROM " + options.tbl_reports + " As lg " +
					"WHERE created_at >= to_timestamp($1) AND " +
						"created_at <= to_timestamp($2) " +
					"ORDER BY created_at DESC LIMIT $3" +
				" ) As f ;",
			values: [
	            options.start,
	            options.end,
	            options.limit
			]
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	},

	/**
	 * Get an individual confirmed report from the database.
	 * Call the callback function with error or response data.
	 * @param {object} options Configuration options for the query
	 * @param {number} options.id Unique ID for the report
	 * @param {string} options.tbl_reports Database table for confirmed reports
	 * @param {DataQueryCallback} callback Callback for handling error or response data
	 */
	getReport: function(options, callback){
		var self = this;

		// Validate options
		var err;
		if ( !Validation.validateNumberParameter(options.id,0) ) err = new Error( "'id parameter is invalid" );
		if ( !options.id && options.id!==null) err = new Error( "'id' options must be supplied" );
		if ( !options.tbl_reports ) err = new Error( "'tbl_reports' option must be supplied" );
		if (err) {
			callback(err);
			return;
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
					"FROM " + options.tbl_reports + " As lg " +
					"WHERE pkey = $1 " +
				" ) As f ;",
			values: [
				options.id
			]
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	},

	/**
	 * Get unconfirmed reports from the database.
	 * Call the callback function with error or response data.
	 * @param {object} options Configuration options for the query
	 * @param {number} options.start Unix timestamp for start of query period
	 * @param {number} options.end Unix timestamp for end of query period
	 * @param {string} options.tbl_reports_unconfirmed Database table for unconfirmed reports
	 * @param {?number} options.limit Number of results to limit to, or null for all
	 * @param {DataQueryCallback} callback Callback for handling error or response data
	 */
	getUnConfirmedReports: function(options, callback){
		var self = this;

		// Validate options
		var err;
		if ( !Validation.validateNumberParameter(options.start,0) ) err = new Error( "'start' parameter is invalid" );
		if ( !Validation.validateNumberParameter(options.end,0) ) err = new Error( "'end' parameter is invalid" );
		if ( !options.tbl_reports_unconfirmed ) err = new Error( "'tbl_reports_unconfirmed' option must be supplied" );
		if ( !options.limit && options.limit!==null ) err = new Error( "'limit' option must be supplied" );
		if (err) {
			callback(err);
			return;
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
					"FROM " + options.tbl_reports_unconfirmed + " As lg " +
					"WHERE created_at >= to_timestamp($1) AND " +
						"created_at <= to_timestamp($2) " +
					"ORDER BY created_at DESC LIMIT $3" +
				" ) As f ;",
			values: [
	            options.start,
	            options.end,
	            options.limit
			]
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	},

	/**
	* Attribute confirmed reports with the name of the containing (parent) city boundary
	* Return as JSON with location of report as embedded GeoJSON
	* @param {object} options Configuration options for the query
	* @param {number} options.start Unix timestamp for start of query period
	* @param {number} options.end Unix timestamp for end of query period
	* @param {string} options.area_name Optional name of city as filter
	* @param {string} options.tbl_reports Database table for confirmed reports
	* @param {string} options.polygon_layer Database table for city polygons
	* @param {?number} options.limit Number of results to limit to, or null for all
	* @param {DataQueryCallback} callback Callback for handling error or response data
	*/
	getReportsByArea: function(options, callback){
		var self = this;

		// Validate Options
		var err;
		if ( !Validation.validateNumberParameter(options.start,0) ) err = new Error( "'start' parameter is invalid" );
		if ( !Validation.validateNumberParameter(options.end,0) ) err = new Error( "'end' parameter is invalid" );
		if ( !options.tbl_reports ) err = new Error( "'tbl_reports' option must be supplied" );
		if ( !options.polygon_layer ) err = new Error( "'polygon_layer' option must be supplied" );
		if ( !options.limit && options.limit!==null ) err = new Error( "'limit' option must be supplied" );
		if (err) {
			callback(err);
			return;
		}

		// SQL
		var queryObject = {
			text: "SELECT array_to_json(array_agg(row_to_json(row))) as data FROM " +
						"(SELECT a.pkey, " +
							"a.created_at, " +
							"a.text, " +
							"a.source, " +
							"ST_AsGeoJSON(a.the_geom), " +
							"b.area_name " +
						"FROM " + options.tbl_reports + " a, " +
							options.polygon_layer + " b " +
						"WHERE created_at >= to_timestamp($1) AND " +
							"created_at <= to_timestamp($2) AND " +
							"ST_Within(a.the_geom, b.the_geom) AND " +
							"($4::varchar is null or b.area_name = $4::varchar) " +
							"ORDER BY created_at DESC LIMIT $3 ) row;",

			values: [
				options.start,
				options.end,
				options.limit,
				options.area_name
			]
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	},

	/**
	* Count confirmed unconfirmed reports within a given number of hours.
	* Call the callback function with error or response data.
	* @param {object} options Configuration options for the query
	* @param {number} options.start Unix timestamp for start of query period
	* @param {number} options.end Unix timestamp for end of query period
	* @param {string} options.tbl_reports Database table for confirmed reports
	* @param {string} options.tbl_reports_unconfirmed Database table for unconfirmed reports
	* @param {DataQueryCallback} callback Callback for handling error or response data
	*/
	getReportsCount: function(options, callback){
		var self = this;

		// Validate options
		var err;
		if ( !Validation.validateNumberParameter(options.start,0) ) err = new Error( "'start' parameter is invalid" );
		if ( !Validation.validateNumberParameter(options.end,0) ) err = new Error( "'end' parameter is invalid" );
		if ( !options.tbl_reports_unconfirmed ) err = new Error( "'tbl_reports_unconfirmed' option must be supplied" );
		if ( !options.tbl_reports ) err = new Error( "'tbl_reports' option must be supplied" );
		if (err) {
			callback(err);
			return;
		}

		//SQL
		var queryObject = {
			text: "SELECT row_to_json(row) As data "+
				 "FROM (SELECT (SELECT count(pkey) FROM "+options.tbl_reports_unconfirmed+
				" WHERE created_at >= to_timestamp($1) AND "+
					"created_at <= to_timestamp($2)) as uc_count, "+
					"(SELECT count(pkey) FROM "+options.tbl_reports+
						" WHERE created_at >= to_timestamp($1) AND "+
						"created_at <= to_timestamp($2)) as c_count) as row;",
			values: [
				options.start,
				options.end
			]
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	},

	/**
	* Get a time series of report counts at hourly intervals over the specified period.
	* Call the callback function with error or response data.
	* @param {object} options Configuration options for the query
	* @param {number} options.start Unix timestamp for start of query period
	* @param {number} options.end Unix timestamp for end of query period
	* @param {string} options.tbl_reports Database table for confirmed reports
	* @param {string} options.tbl_reports_unconfirmed Database table for unconfirmed reports
	* @param {DataQueryCallback} callback Callback for handling error or response data
	*/
	getReportsTimeSeries: function(options, callback){
		var self = this;

		// Validate options
		var err;
		if ( !Validation.validateNumberParameter(options.start,0) ) err = new Error( "'start' parameter is invalid" );
		if ( !Validation.validateNumberParameter(options.end,0) ) err = new Error( "'end' parameter is invalid" );
		if ( !options.tbl_reports_unconfirmed ) err = new Error( "'tbl_reports_unconfirmed' option must be supplied" );
		if ( !options.tbl_reports ) err = new Error( "'tbl_reports' option must be supplied" );
		if (err) {
			callback(err);
			return;
		}

		//SQL
		var queryObject = {
			text: "SELECT array_to_json(array_agg(row_to_json(row))) as data "+
				"FROM (SELECT to_char(c.stamp::time,'HH24:MI') stamp, c.count as c_count, uc.count as uc_count "+
				"FROM (SELECT time.stamp, COALESCE(count.count,0) count "+
				"FROM (select generate_series(date_trunc('hour',to_timestamp($1)), "+
					"date_trunc('hour',to_timestamp($2)), '1 hours') AT TIME ZONE 'ICT' as stamp) as time "+
				"LEFT OUTER JOIN (SELECT count(pkey), date_trunc('hour', created_at) AT TIME ZONE 'ICT' tweettime "+
					"FROM "+options.tbl_reports_unconfirmed+" GROUP BY date_trunc('hour', created_at))as count "+
				"ON count.tweettime = time.stamp ORDER BY time.stamp ASC) as uc, "+
				"(SELECT time.stamp, COALESCE(count.count,0) count FROM "+
				"(select generate_series(date_trunc('hour',to_timestamp($1)), "+
				"date_trunc('hour',to_timestamp($2)), '1 hours') AT TIME ZONE 'ICT' as stamp) as time "+
				"LEFT OUTER JOIN (SELECT count(pkey), date_trunc('hour', created_at) AT TIME ZONE 'ICT' tweettime "+
				"FROM "+options.tbl_reports+" GROUP BY date_trunc('hour', created_at))as count "+
				"ON count.tweettime = time.stamp ORDER BY time.stamp ASC) as c WHERE c.stamp = uc.stamp) as row;",
			values : [
				options.start,
				options.end
			]
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	},

	/**
	 * Count reports within given polygon layer (e.g. wards).
	 * Call the callback function with error or response data.
	 * @param {object} options Configuration options for the query
	 * @param {number} options.start Unix timestamp for start of query period
	 * @param {number} options.end Unix timestamp for end of query period
	 * @param {string} options.polygon_layer Database table for layer of geo data
	 * @param {string} options.point_layer Database table for confirmed reports
	 * @param {string} options.point_layer_uc Database table for unconfirmed reports
	 * @param {DataQueryCallback} callback Callback for handling error or response data
	 */
	getCountByArea: function(options, callback){
		var self = this;

		// Validate options
		var err;
		if ( !Validation.validateNumberParameter(options.start,0) ) err = new Error( "'start' parameter is invalid" );
		if ( !Validation.validateNumberParameter(options.end,0) ) err = new Error( "'end' parameter is invalid" );
		if ( !options.polygon_layer ) err = new Error( "'polygon_layer' option must be supplied" );
		if ( !options.point_layer_uc ) err = new Error( "'point_layer_uc' option must be supplied" );
		if ( !options.point_layer ) err = new Error( "'point_layer' option must be supplied" );
		if (err) {
			callback(err);
			return;
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
							"FROM " + options.polygon_layer + " AS p1 " +
							"LEFT OUTER JOIN ( " +
								"SELECT b.pkey, " +
									"count(a.pkey) " +
								"FROM " + options.point_layer_uc + " a, " +
									options.polygon_layer + " b " +
								"WHERE ST_WITHIN(a.the_geom, b.the_geom) AND " +
									"a.created_at >=to_timestamp($1) AND " +
									"a.created_at <= to_timestamp($2) " +
								"GROUP BY b.pkey " +
							") as count " +
							"ON (p1.pkey = count.pkey) " +
						") as c1, ( " +
							"SELECT p1.pkey, " +
								"COALESCE(count.count,0) count  " +
							"FROM " + options.polygon_layer + " AS p1 " +
							"LEFT OUTER JOIN( " +
								"SELECT b.pkey, " +
									"count(a.pkey) " +
								"FROM " + options.point_layer + " a, " +
									options.polygon_layer + " b " +
								"WHERE ST_WITHIN(a.the_geom, b.the_geom) AND " +
									"a.created_at >= to_timestamp($1) AND " +
									"a.created_at < to_timestamp($2) " +
									"GROUP BY b.pkey) as count " +
							"ON (p1.pkey = count.pkey) " +
						") as c2 " +
						"WHERE c1.pkey=c2.pkey " +
						"ORDER BY pkey " +
					") AS lg " +
				") AS f;",
			values: [
			    options.start,
			    options.end
			]
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	},

	/**
	 * Get a series of report counts by polygon layer for a historical time period.
	 * @param {object} options Configuration options for the query
	 * @param {number} options.start_time Unix timestamp for start of query period
	 * @param {number} options.blocks Number of hourly blocks to return
	 * @param {string} options.polygon_layer Database table for layer of geo data
	 * @param {string} options.point_layer Database table for confirmed reports
	 * @param {string} options.point_layer_uc Database table for unconfirmed reports
	 * @param {DataQueryCallback} callback Callback for handling error or response data
	 */
	getHistoricalCountByArea: function(options, callback){
		var self = this;

		// Validate options
		var err;
		if ( !Validation.validateNumberParameter(options.start_time,0) ) err = new Error( "'start_time' parameter is invalid" );
		if ( !Validation.validateNumberParameter(options.blocks,1) ) err = new Error( "'blocks' parameter is invalid" );
		if ( !options.polygon_layer ) err = new Error( "'polygon_layer' option must be supplied" );
		if ( !options.point_layer_uc ) err = new Error( "'point_layer_uc' option must be supplied" );
		if ( !options.point_layer ) err = new Error( "'point_layer' option must be supplied" );
		if (err) {
			callback(err);
			return;
		}

		// Setup variables so we can do a count-by-area query for each block and join the responses together
		var blocksQueried = 0;
		var aggregateData = { blocks:[] };
		var queryOptions = {
			start: options.start_time,
			end: options.start_time + 3600,
			polygon_layer: options.polygon_layer,
			point_layer_uc: options.point_layer_uc,
			point_layer: options.point_layer
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
	 * Get infrastructure details as JSON/GeoJSON response.
	 * @param {object} options Options object for the server query
	 * @param {string} options.infrastructureTableName Table name of the infrastructure table to query
	 * @param {DataQueryCallback} callback Callback for handling error or response data
	 */
	getInfrastructure: function(options, callback){
		var self = this;

		// Validate options
		if (!options.infrastructureTableName) {
			callback( new Error("Infrastructure table is not valid") );
			return;
		}

		var queryObject = {
			text: "SELECT 'FeatureCollection' AS type, " +
					"array_to_json(array_agg(f)) AS features " +
				"FROM (SELECT 'Feature' AS type, " +
					"ST_AsGeoJSON(lg.the_geom)::json AS geometry, " +
					"row_to_json( " +
						"(SELECT l FROM (SELECT name) as l) " +
					") AS properties " +
					"FROM " + options.infrastructureTableName + " AS lg " +
				") AS f;",
			values: []
		};

		// Call data query
		self.dataQuery(queryObject, callback);
	}

};

//Export our object constructor method from the module
module.exports = CognicityServer;

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
							"status, " +
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
						"source, " +
						"status, " +
						"url, " +
						"image_url, " +
						"title, " +
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
	* Attribute confirmed reports with the name of the containing (parent) city boundary
	* Return as JSON with location of report as embedded GeoJSON
	* @param {object} options Configuration options for the query
	* @param {number} options.start Unix timestamp for start of query period
	* @param {number} options.end Unix timestamp for end of query period
	* @param {string=} options.area_name Optional name of city as filter
	* @param {string} options.tbl_reports Database table for confirmed reports
	* @param {string} options.polygon_layer Database table for city polygons
	* @param {number=} options.limit Number of results to limit to, or null for all
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
		if ( typeof options.limit !== 'undefined' && options.limit !== null && !Validation.validateNumberParameter(options.limit) ) err = new Error( "'limit' option must be supplied" );
		if (err) {
			callback(err);
			return;
		}

		// Set default values
		if ( !options.limit ) {
			options.limit = null;
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
	* Get floodsensor readings.
	* Call the callback function with error or response data
	* @param {object} options Configuration options for the query
	* @param {number} options.start Unix timestamp for the start time of first available observation
	* @param {number} options.end Unix timestamp for the end time of the last available observation
	* @param {string} options.tbl_sensor_data Database table for the floodsensor observations
	* @param {string} options.tbl_sensor_metadata Database table for the floodsensor metadata
	* @param {DataQueryCallback} callback Callback for handling error or response data
	*/
	getFloodsensors: function(options, callback){
	  var self = this;

	  // Validate options
	  var err;
	  if ( !Validation.validateNumberParameter(options.start,0) ) err = new Error("'start' parameter is invalid" );
	  if ( !Validation.validateNumberParameter(options.end,0)  ) err = new Error("'end' parameter is invalid" );
	  if ( !options.tbl_sensor_data ) err = new Error( "'tbl_sensor_data' option must be supplied" );
		if ( !options.tbl_sensor_metadata ) err = new Error( "'tbl_sensor_metadata' option must be supplied" );
	  if (err) {
	    callback(err);
	    return;
	  }

	  // SQL
	  var queryObject = {
	    text: "SELECT 'FeatureCollection' as type, " +
	    "array_to_json(array_agg(f)) as features " +
	      "FROM (SELECT 'Feature' as type, " +
	        "ST_AsGeoJSON(props.location)::json as geometry, " +
	        "row_to_json((props.id, props.height_above_riverbed, props.measurements)::sensor_metadata_type) as properties " +
	        "FROM (SELECT " +
	         "m.location, m.id, m.height_above_riverbed, " +
	          "array_to_json(array_agg((obs.measurement_time AT TIME ZONE 'AESST', obs.distance, m.height_above_riverbed - obs.distance, obs.temperature, obs.humidity)::sensor_data_type ORDER BY obs.measurement_time ASC)) as " +
	          "measurements " +
	            "FROM " +
	              options.tbl_sensor_data+" as obs, " +
								options.tbl_sensor_metadata+" as m " +
	              "WHERE obs.sensor_id = m.id " +
								"AND obs.measurement_time >= to_timestamp($1) " +
	              "AND obs.measurement_time <= to_timestamp($2) " +
	              "GROUP BY m.location, m.id, m.height_above_riverbed ) as props ) as f;",
	      values : [
	        options.start,
	        options.end
	      ]
	  };
	  // Call data query
	  self.dataQuery(queryObject, callback);
	},

	/**
	* Get floodgauge readings.
	* Call the callback function with error or response data
	* @param {object} options Configuration options for the query
	* @param {number} options.start Unix timestamp for the start time of first available observation
	* @param {number} options.end Unix timestamp for the end time of the last available observation
	* @param {string} options.tbl_floodgauges Database table for the floodgauge observations
	* @param {DataQueryCallback} callback Callback for handling error or response data
	*/
	getFloodgauges: function(options, callback){
		var self = this;

		// Validate options
		var err;
		if ( !Validation.validateNumberParameter(options.start,0) ) err = new Error("'start' parameter is invalid" );
		if ( !Validation.validateNumberParameter(options.end,0)  ) err = new Error("'end' parameter is invalid" );
		if ( !options.tbl_floodgauges ) err = new Error( "'tbl_floodgauges' option must be supplied" );
		if (err) {
			callback(err);
			return;
		}

		// SQL
		var queryObject = {
			text: "SELECT 'FeatureCollection' as type, " +
			"array_to_json(array_agg(f)) as features " +
				"FROM (SELECT 'Feature' as type, " +
					"ST_AsGeoJSON(props.the_geom)::json as geometry, " +
					"row_to_json((props.gaugeid, props.gaugenameid, props.observations)::prop_type) as properties " +
					"FROM (SELECT " +
					 "the_geom, gaugeid, gaugenameid, " +
						"array_to_json(array_agg((obs.measuredatetime AT TIME ZONE 'ICT', obs.depth, obs.warninglevel, obs.warningnameid)::obs_type ORDER BY obs.measuredatetime ASC)) as " +
						"observations " +
							"FROM " +
								options.tbl_floodgauges+" as obs " +
								"WHERE obs.measuredatetime >= to_timestamp($1) " +
								"AND obs.measuredatetime <= to_timestamp($2) " +
								"GROUP BY gaugeid, the_geom, gaugenameid ) as props ) as f;",
				values : [
					options.start,
					options.end
				]
		};
		// Call data query
		self.dataQuery(queryObject, callback);
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

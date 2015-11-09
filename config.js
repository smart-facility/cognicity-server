'use strict';

// config.js - Configuration for cognicity-server

/**
 * Cognicity server configuration object.
 * @namespace {object} config
 * @property {string} instance The name of this instance of the cognicity server
 * @property {string} public_dir Path to root of files to serve
 * @property {string} robots Path to robots.txt to server under at '/robots.txt'
 * @property {string} url_prefix Prefix for start of public URLs
 * @property {string} root_redirect If the user browses to '/', redirect them to here
 * @property {object} languages Multi-language support, should match templates of any static HTML
 * @property {number} cache_timeout How long data will live in the cache, in milliseconds
 * @property {boolean} data If true, enable the data query routes
 * @property {boolean} aggregates If true, enable the aggregate query routes
 * @property {boolean} compression If true, enable gzip compression on the server responses
 * @property {object} api Configuration options for the API
 * @property {object} api.aggregates Configuration options for the aggregates
 * @property {object} api.aggregates.archive Configuration options for the archive aggregates
 * @property {string} api.aggregates.archive.level Polygon level to bucket response data in an archive aggregate query
 * @property {object} pg Configuration options for the PostGres connection
 * @property {string} pg.conString The connection URL for PostGres
 * @property {number} pg.reconnectionDelay The delay between attempts to reconnect to PostGres
 * @property {number} pg.reconnectionAttempts The number of attempts to reconnect to PostGres before exiting
 * @property {string} pg.tbl_reports Database table containing confirmed reports
 * @property {string} pg.tbl_reports_unconfirmed Database table containing unconfirmed reports
 * @property {object} pg.aggregate_levels Object of aggregate levels mapping a name to a database table
 * @property {string} pg.aggregate_levels.(name) Name of the aggregate level
 * @property {string} pg.aggregate_levels.(value) Database table for the aggregate level
 * @property {object} pg.infrastructure_tbls Object of infrastructure tables mapping a name to a database table
 * @property {string} pg.infrastructure_tbls.(name) Name of the infrastructure type
 * @property {string} pg.infrastructure_tbls.(value) Database table for the infrastructure type
 * @property {?number} pg.limit Limit of number of confirmed reports to return in data query
 * @property {?number} pg.uc_limit Limit of number of unconfirmed reports to return in data query
 * @property {object} logger Configuration options for logging
 * @property {string} logger.level Log level - info, verbose or debug are most useful. Levels are (npm defaults): silly, debug, verbose, info, warn, error.
 * @property {number} logger.maxFileSize Maximum size of each log file in bytes
 * @property {number} logger.maxFiles Maximum number of log files to keep
 * @property {?number} logger.logDirectory Full path to directory to store log files in, if not set logs will be written to the application directory
 * @property {number} port Port to launch server on
 */
var config = {};

// Instance name - default name for this configuration (will be server process name)
config.instance = 'cognicity-server';

// Location of HTML files to serve
config.public_dir = __dirname+'/petajakarta-web/build/banjir';

// Location of robots.txt file to server at root level
config.robots = __dirname+'/petajakarta-web/build/robots.txt';

// Optional URL prefix - e.g. http://localhost/project-name/
config.url_prefix = 'banjir';

// Optional redirect path for root ['/'] requests
config.root_redirect = 'banjir';

// Dual language support
config.languages = {};
config.languages.locale = 'id/'; // Indonesian
config.languages.default= 'en/'; // English

// Default cache time expiry
config.cache_timeout = 60000; // Data cache expiry (1 minute)

config.data = true; // Enable data routes
config.aggregates = true; // Enable aggregate data outputs
config.compression = false; // Enable express compression middleware

// API settings
config.api = {};
config.api.aggregates = {};
config.api.aggregates.archive = {};
config.api.aggregates.archive.level = 'rw';

// Postgres database connection
config.pg = {};

// Example postgres string for running on localhost
config.pg.conString = 'postgres://postgres@localhost/cognicity';

/* Sample connection string using environment variables from AWS Elastic Beanstalk.
config.pg.conString = 'postgres://' + process.env.RDS_USERNAME + ':' + process.env.RDS_PASSWORD +'@' + process.env.RDS_HOSTNAME + ':' + process.env.RDS_PORT + '/' + process.env.DB_NAME;
	On other platforms you would replace those variables as necessary
*/

/* Example of setting up config.pg.conString for running on IBM bluemix using user-provided postgres running on compose.io
var vcapServices = JSON.parse(process.env.VCAP_SERVICES)
var pgdetails = vcapServices['user-provided'][0];
config.pg.conString = 'postgres://' + pgdetails.credentials.username + ':' + pgdetails.credentials.password + '@' + pgdetails.credentials.public_hostname +'/cognicity';
*/

// Database reconnection settings
config.pg.reconnectionDelay = 1000 * 60 * 3; // Delay before attempting a reconnection in ms
config.pg.reconnectionAttempts = 5; // Number of times to attempt reconnection before notifying admin and exiting
// Database tables
config.pg.tbl_reports = 'all_reports'; // Change to use multiple data sources
config.pg.tbl_reports_unconfirmed = 'tweet_reports_unconfirmed';

// Optional support for report aggregation, required if config.data.aggregates set to true.
config.pg.aggregate_levels = {
	'city':'jkt_city_boundary',
	'subdistrict':'jkt_subdistrict_boundary',
	'village':'jkt_village_boundary',
	'rw':'jkt_rw_boundary'
};
config.pg.infrastructure_tbls = {
	'waterways':'waterways',
	'pumps':'pumps',
	'floodgates':'floodgates'
};
config.pg.limit = null; // Limit number of rows returned in a query
config.pg.uc_limit = null; // Limit number of unconfirmed reports.

// Logging configuration
config.logger = {};
config.logger.level = "debug"; // What level to log at; info, verbose or debug are most useful. Levels are (npm defaults): silly, debug, verbose, info, warn, error.
config.logger.maxFileSize = 1024 * 1024 * 100; // Max file size in bytes of each log file; default 100MB
config.logger.maxFiles = 10; // Max number of log files kept
config.logger.logDirectory = '.'; // Set this to a full path to a directory - if not set logs will be written to the application directory.

// Server port
config.port = process.env.PORT || 8081;
// on IBM bluemix use config.port = process.env.VCAP_APP_PORT || 8081;

module.exports = config;

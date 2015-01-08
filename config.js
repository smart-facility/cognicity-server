'use strict';

// config.js - Configuration for cognicity-server

var config = {};

// Instance name - default name for this configuration (will be server process name)
config.instance = 'cognicity-server';

// Location of HTML files to serve
config.public_dir = __dirname+'/petajakarta-web/build/banjir';

// Optional URL prefix - e.g. http://localhost/project-name/
config.url_prefix = 'banjir';

// Optional redirect path for root ['/] requests
config.root_redirect = 'banjir/in';

// Default cache time expiry
config.cache_timeout = 60000; // Data cache expiry (1 minute)

config.data = true; // Enable data routes
config.aggregates = true; // Enable aggregate data outputs

// API settings
config.api = {};
config.api.aggregates = {};
config.api.aggregates.archive = {};
config.api.aggregates.archive.level = 'rw';

// Postgres database connection
config.pg = {};
// Sample connection string using environment variables, e.g. from AWS Elastic Beanstalk.
// Substitute variable names for constants in other environments.
config.pg.conString = 'postgres://' + process.env.RDS_USERNAME + ':' + process.env.RDS_PASSWORD +'@' + process.env.RDS_HOSTNAME + ':' + process.env.RDS_PORT + '/' + process.env.DB_NAME;
// Database reconnection settings
config.pg.reconnectionDelay = 1000 * 60 * 3; // Delay before attempting a reconnection in ms
config.pg.reconnectionAttempts = 5; // Number of times to attempt reconnection before notifying admin and exiting
// Database tables
config.pg.tbl_reports = 'tweet_reports';
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
config.logger.logDirectory = '/var/log/nodejs'; // Set this to a full path to a directory - if not set logs will be written to the application directory.

// Server port
config.port = process.env.PORT || 8081;

module.exports = config;

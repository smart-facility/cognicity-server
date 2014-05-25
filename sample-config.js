//sample-config.js - Configuration for cognicity-server

var config = {};

// Server port
config.port = 8080; // Must be unused on host.

// Instance name - default name for this configuration (will be server process name)
config.instance = 'project-name';

// Location of HTML files to serve
config.public_dir = '/project-name/cognicity-web/'

// Optional URL prefix - e.g. http://localhost/project-name/
config.url_prefix = config.instance; 

// Optional redirect path for root ['/'] requests
config.root_redirect = '';

// Default cache time expiry
config.cache_timeout = 600000; // Data cache expiry (default 600000ms/10 minutes)

config.data = true; // Enable data routes

//Postgres database connection
config.pg = {};
config.pg.conString = 'postgres://postgres:password@localhost:5432/cognicity'
config.pg.tbl_reports = 'reports';
config.pg.tbl_reports_unconfirmed = 'tweet_reports_unconfirmed';
config.pg.limit = '1000'; // Limit number of rows returned in a query
config.pg.uc_limit = '1000'; // Limit number of unconfirmed reports
config.pg.start = -1; // Optional default start date for report queries in Unix time (default -1, no limit)

module.exports = config;

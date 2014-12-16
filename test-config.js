'use strict';

// test-config.js - include the sample config and change some properties for test

var config = require("./config.js");

// Change instance name so we log to test.log
config.instance = 'test';

// Log into application directory
config.logger.logDirectory = null;

// Export our modified config
module.exports = config;
'use strict';

/* jshint -W079 */ // Ignore this error for this import only, as we get a redefinition problem
var test = require('unit.js');
/* jshint +W079 */
var CognicityServer = require('../CognicityServer.js');

// Create server with empty objects
// We will mock these objects as required for each test suite
var server = new CognicityServer(
	{},
	{},
	{}
);

// Mocked logger we can use to let code run without error when trying to call logger messages
server.logger = {
	error:function(){},
	warn:function(){},
	info:function(){},
	verbose:function(){},
	debug:function(){}
};

describe( "dataQuery", function() {
	var connectionWillErr = false;
	var queryWillErr = false;
	
	var lastErr = null;
	var lastData = null;
	var callback = function(err,data) {
		lastErr = err;
		lastData = data;
	};
	var doneCalled = false;
	var doneFunction = function() {
		doneCalled = true;
	};
	
	before( function() {
		server.config.pg = {};
		var pgClientObject = {
			query: function(queryObject, queryHandler) {
				if (queryWillErr) queryHandler(new Error(), null);
				else queryHandler(null, {rows:[]});
			}	
		};
		server.pg = {
			connect: function(conString, pgConnectFunction) {
				if (connectionWillErr) pgConnectFunction(new Error(), pgClientObject, doneFunction);
				else pgConnectFunction(null, pgClientObject, doneFunction);
			}
		};
	});
	
	beforeEach( function() {
		connectionWillErr = false;
		queryWillErr = false;	
		lastErr = null;
		lastData = null;
		doneCalled = false;
	});
	
	it( 'Successful query calls callback with no error and with data', function() {
		server.dataQuery({},callback);
		test.value( lastErr ).is( null );
		test.value( lastData instanceof Object ).is( true );
	});

	it( 'Connection failure calls callback with error and no data', function() {
		connectionWillErr = true;
		server.dataQuery({},callback);
		test.value( lastErr instanceof Error ).is( true );
		test.value( lastData ).is( undefined );
	});

	it( 'Query failure calls callback with error and no data', function() {
		queryWillErr = true;
		server.dataQuery({},callback);
		test.value( lastErr instanceof Error ).is( true );
		test.value( lastData ).is( undefined );
	});

	after( function(){
		server.config = {};
	});
});

// Test template
//	describe( "suite", function() {
//		before( function() {	
//		});
//		
//		beforeEach( function() {
//		});
//		
//		it( 'case', function() {
//		});
//
//		after( function(){
//		});
//	});

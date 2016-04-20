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

describe( "getReports validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'blue';

	function createOptions(start,end,tbl_reports,limit){
		return {
			start: start,
			end: end,
			tbl_reports: tbl_reports,
			limit: limit
		};
	}

	function callback(err,data) {
		callbackErr = err;
		callbackData = data;
	}

	before( function() {
		oldDataQuery = server.dataQuery;
		server.dataQuery = function(queryOptions, callback){
			dataQueryCalled = true;
			callback(null,callbackDataResponse);
		};
	});

	beforeEach( function() {
		dataQueryCalled = false;
		callbackErr = null;
		callbackData = null;
	});

	it( "should call the database if parameters are valid", function() {
		server.getReports( createOptions(1, 2, 'red', 5), callback );
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	});

	it( "should throw an error with an invalid 'start' parameter", function() {
		server.getReports( createOptions('green', 2, 'red', 5), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'end' parameter", function() {
		server.getReports( createOptions(1, 'orange', 'red', 5), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'tbl_reports' parameter", function() {
		server.getReports( createOptions(1, 2, null, 5), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'limit' parameter", function() {
		server.getReports( createOptions(1, 2, 'red', undefined), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.dataQuery = oldDataQuery;
	});
});

describe( "getReport validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'magnolia';

	function createOptions(id,tbl_reports){
		return {
			id: id,
			tbl_reports: tbl_reports
		};
	}

	function callback(err,data) {
		callbackErr = err;
		callbackData = data;
	}

	before( function() {
		oldDataQuery = server.dataQuery;
		server.dataQuery = function(queryOptions, callback){
			dataQueryCalled = true;
			callback(null,callbackDataResponse);
		};
	});

	beforeEach( function() {
		dataQueryCalled = false;
		callbackErr = null;
		callbackData = null;
	});

	it( "should call the database if parameters are valid", function() {
		server.getReport( createOptions(1, 'magnolia'), callback );
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	});

	it( "should throw an error with an 'id' parameter less than 1", function() {
		server.getReport( createOptions('0', 'magnolia'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'id' parameter", function() {
		server.getReport( createOptions('rose', 'magnolia'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'pkey' parameter", function() {
		server.getReport( createOptions('green', 'magnolia'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'tbl_reports' parameter", function() {
		server.getReport( createOptions(1, null), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.dataQuery = oldDataQuery;
	});
});

describe( "getReportsByArea validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'response';

	function createOptions(start,end,tbl_reports,polygon_layer,limit){
		return {
			start: start,
			end: end,
			tbl_reports: tbl_reports,
			polygon_layer: polygon_layer,
			limit: limit
		};
	}

	function callback(err,data) {
		callbackErr = err;
		callbackData = data;
	}

	before( function() {
		oldDataQuery = server.dataQuery;
		server.dataQuery = function(queryOptions, callback){
			dataQueryCalled = true;
			callback(null,callbackDataResponse);
		};
	});

	beforeEach( function() {
		dataQueryCalled = false;
		callbackErr = null;
		callbackData = null;
	});
	
	// Called when we expect a test to have passed and called the database
	function assertSuccess() {
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	}
	
	// Called when we expect a test to have failed and returned an error
	function assertFailure() {
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	}

	it( "should call the database if parameters are valid", function() {
		server.getReportsByArea( createOptions(1, 2, 'tbl_reports', 'polygon_layer', 5), callback );
		assertSuccess();
	});

	it( "should throw an error with an invalid 'start' parameter", function() {
		server.getReportsByArea( createOptions(null, 2, 'tbl_reports', 'polygon_layer', 5), callback );
		assertFailure();
	});

	it( "should throw an error with an invalid 'end' parameter", function() {
		server.getReportsByArea( createOptions(1, null, 'tbl_reports', 'polygon_layer', 5), callback );
		assertFailure();
	});

	it( "should throw an error with an invalid 'tbl_reports' parameter", function() {
		server.getReportsByArea( createOptions(1, 2, null, 'polygon_layer', 5), callback );
		assertFailure();
	});

	it( "should throw an error with an invalid 'polygon_layer' parameter", function() {
		server.getReportsByArea( createOptions(1, 2, 'tbl_reports', null, 5), callback );
		assertFailure();
	});

	it( "should throw an error with an invalid 'limit' parameter", function() {
		server.getReportsByArea( createOptions(1, 2, 'tbl_reports', 'polygon_layer', 'foo'), callback );
		assertFailure();
	});

	it( "should allow limit parameter of 'null'", function() {
		server.getReportsByArea( createOptions(1, 2, 'tbl_reports', 'polygon_layer', null), callback );
		assertSuccess();
	});

	it( "should allow limit parameter of 'undefined'", function() {
		server.getReportsByArea( createOptions(1, 2, 'tbl_reports', 'polygon_layer', undefined), callback );
		assertSuccess();
	});

	after( function(){
		server.dataQuery = oldDataQuery;
	});
});

describe( "getFloodgauges validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'water';

	function createOptions(start, end, tbl_floodgauges){
		return {
			start: start,
			end: end,
			tbl_floodgauges: tbl_floodgauges
		};
	}

	function callback(err,data) {
		callbackErr = err;
		callbackData = data;
	}

	before( function() {
		oldDataQuery = server.dataQuery;
		server.dataQuery = function(queryOptions, callback){
			dataQueryCalled = true;
			callback(null,callbackDataResponse);
		};
	});

	beforeEach( function() {
		dataQueryCalled = false;
		callbackErr = null;
		callbackData = null;
	});

	it( "should call the database if parameters are valid", function() {
		server.getFloodgauges( createOptions(1, 2, 'tbl_floodgauges'), callback );
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	});

	it( "should throw an error with an invalid 'start' parameter", function() {
		server.getFloodgauges( createOptions(null, 2, 'tbl_floodgauges'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'end' parameter", function() {
		server.getFloodgauges( createOptions(1, null, 'tbl_floodgauges'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'tbl_floodgauges' parameter", function() {
		server.getFloodgauges( createOptions(1, 2, null), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.dataQuery = oldDataQuery;
	});
});

describe( "getInfrastructure validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'water';

	function createOptions(infrastructureTableName){
		return {
			infrastructureTableName: infrastructureTableName
		};
	}

	function callback(err,data) {
		callbackErr = err;
		callbackData = data;
	}

	before( function() {
		oldDataQuery = server.dataQuery;
		server.dataQuery = function(queryOptions, callback){
			dataQueryCalled = true;
			callback(null,callbackDataResponse);
		};
	});

	beforeEach( function() {
		dataQueryCalled = false;
		callbackErr = null;
		callbackData = null;
	});

	it( "should call the database if parameters are valid", function() {
		server.getInfrastructure( createOptions('land'), callback );
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	});

	it( "should throw an error with an invalid 'start' parameter", function() {
		server.getInfrastructure( createOptions(null), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.dataQuery = oldDataQuery;
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

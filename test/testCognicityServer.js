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

describe( "getHistoricalCountByArea processing", function() {
	var oldGetCountByArea;

	var getCountByAreaCalledTimes;
	var getCountByAreaLastQueryOptions;
	var getCountByAreaCallbackError;
	var getCountByAreaCallbackData;

	var getHistoricalCountByAreaCallback;
	var getHistoricalCountByAreaCallbackError;
	var getHistoricalCountByAreaCallbackData;

	var options;

	before( function() {
		// Retain a reference to functions we are mocking out
		oldGetCountByArea = server.getCountByArea;

		// Mock the getCountByArea function to store what it was passed and execute its callback based on our settings
		server.getCountByArea = function(queryOptions, getCountByAreaCallback){
			var callbackData;
			// Count that we were run and store the options we were run with
			getCountByAreaCalledTimes++;
			getCountByAreaLastQueryOptions = queryOptions;
			// If we have canned response data use it, otherwise return an empty object as the data value
			if (getCountByAreaCallbackData) callbackData = getCountByAreaCallbackData[getCountByAreaCalledTimes-1];
			else callbackData = {};
			// Call the callback passed to the function with our preset error and data objects
			getCountByAreaCallback(getCountByAreaCallbackError,[callbackData]);
		};

		// Create a simple callback for our historical aggregates function which just captures the data it is passed
		getHistoricalCountByAreaCallback = function(err, data) {
			getHistoricalCountByAreaCallbackError = err;
			getHistoricalCountByAreaCallbackData = data;
		};
	});

	beforeEach( function() {
		// Reset variables which store internals so we can look at their state after the function runs
		getCountByAreaCalledTimes = 0;
		getCountByAreaLastQueryOptions = null;

		getCountByAreaCallbackError = null;
		getCountByAreaCallbackData = null;

		getHistoricalCountByAreaCallbackError = null;
		getHistoricalCountByAreaCallbackData = null;

		// Setup a basic options object, we can override this in each test case if need be
		options = {
			blocks: 3,
			start_time: 441860645, // 19840102T030405Z
			polygon_layer: 'protea',
			point_layer_uc: 'pandorea',
			point_layer: 'hibiscus'
		};
	});

	it( 'calls getCountByArea initially', function() {
		options.blocks = 1;
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.value( getCountByAreaCalledTimes ).is( 1 );
	});

	it( 'calls getCountByArea "blocks" times', function() {
		options.blocks = 7;
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.value( getCountByAreaCalledTimes ).is( 7 );
	});

	it( 'uses "startTime" as timestamp for initial query', function() {
		options.blocks = 1;
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.value( getCountByAreaLastQueryOptions.start ).is( options.start_time );
	});

	it( 'query end time is timestamp plus 1 hour', function() {
		options.blocks = 1;
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.value( getCountByAreaLastQueryOptions.end ).is( options.start_time + 3600 );
	});

	it( 'increases start and end times by 1 hour for each block', function() {
		options.blocks = 2;
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.value( getCountByAreaLastQueryOptions.start ).is( options.start_time + 3600 );
		test.value( getCountByAreaLastQueryOptions.end ).is( options.start_time + 3600 + 3600 );

		options.blocks = 3;
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.value( getCountByAreaLastQueryOptions.start ).is( options.start_time + 3600 + 3600 );
		test.value( getCountByAreaLastQueryOptions.end ).is( options.start_time + 3600 + 3600 + 3600 );
	});

	it( 'returns no data on error', function() {
		getCountByAreaCallbackError = new Error();
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.object( getHistoricalCountByAreaCallbackError ).isInstanceOf( Error );
		test.value( getHistoricalCountByAreaCallbackData ).isNull();
	});

	it( 'returns data as list from multiple successful blocks', function() {
		getCountByAreaCallbackData = [
			{ plant: "grevillea" },
			{ plant: "banksia" },
			{ plant: "lillypilly" }
		];
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.value( getHistoricalCountByAreaCallbackError ).isNull();
		test.array( getHistoricalCountByAreaCallbackData[0].blocks ).hasLength( 3 );
		test.value( getHistoricalCountByAreaCallbackData[0].blocks[0].plant ).is( getCountByAreaCallbackData[0].plant );
		test.value( getHistoricalCountByAreaCallbackData[0].blocks[1].plant ).is( getCountByAreaCallbackData[1].plant );
		test.value( getHistoricalCountByAreaCallbackData[0].blocks[2].plant ).is( getCountByAreaCallbackData[2].plant );
	});

	it( 'start and end times are included with each block', function() {
		server.getHistoricalCountByArea(options, getHistoricalCountByAreaCallback);
		test.value( getHistoricalCountByAreaCallbackData[0].blocks[0].start_time ).is( "1984-01-02T03:04:05.000Z" );
		test.value( getHistoricalCountByAreaCallbackData[0].blocks[0].end_time ).is( "1984-01-02T04:04:05.000Z" );

		test.value( getHistoricalCountByAreaCallbackData[0].blocks[1].start_time ).is( "1984-01-02T04:04:05.000Z" );
		test.value( getHistoricalCountByAreaCallbackData[0].blocks[1].end_time ).is( "1984-01-02T05:04:05.000Z" );

		test.value( getHistoricalCountByAreaCallbackData[0].blocks[2].start_time ).is( "1984-01-02T05:04:05.000Z" );
		test.value( getHistoricalCountByAreaCallbackData[0].blocks[2].end_time ).is( "1984-01-02T06:04:05.000Z" );
	});

	after( function(){
		server.getCountByArea = oldGetCountByArea;
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

describe( "getUnConfirmedReports validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'parrot';

	function createOptions(start,end,tbl_reports_unconfirmed,limit){
		return {
			start: start,
			end: end,
			tbl_reports_unconfirmed: tbl_reports_unconfirmed,
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
		server.getUnConfirmedReports( createOptions(1, 2, 'magpie', 5), callback );
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	});

	it( "should throw an error with an invalid 'start' parameter", function() {
		server.getUnConfirmedReports( createOptions('cockatoo', 2, 'magpie', 5), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'end' parameter", function() {
		server.getUnConfirmedReports( createOptions(1, 'lorikeet', 'magpie', 5), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'tbl_reports_unconfirmed' parameter", function() {
		server.getUnConfirmedReports( createOptions(1, 2, null, 5), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'limit' parameter", function() {
		server.getUnConfirmedReports( createOptions(1, 2, 'magpie', undefined), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.dataQuery = oldDataQuery;
	});
});

describe( "getReportsCount validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'raspberry';

	function createOptions(start,end,tbl_reports_unconfirmed,tbl_reports){
		return {
			start: start,
			end: end,
			tbl_reports_unconfirmed: tbl_reports_unconfirmed,
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
		server.getReportsCount( createOptions(1, 2, 'strawberry', 'blueberry'), callback );
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	});

	it( "should throw an error with an invalid 'start' parameter", function() {
		server.getReportsCount( createOptions('cherry', 2, 'strawberry', 'blueberry'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'end' parameter", function() {
		server.getReportsCount( createOptions(1, 'blackberry', 'strawberry', 'blueberry'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'tbl_reports_unconfirmed' parameter", function() {
		server.getReportsCount( createOptions(1, 2, null, 'blueberry'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'tbl_reports' parameter", function() {
		server.getReportsCount( createOptions(1, 2, 'strawberry', null), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.dataQuery = oldDataQuery;
	});
});

describe( "getReportsTimeSeries validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'galaxy';

	function createOptions(start,end,tbl_reports_unconfirmed,tbl_reports){
		return {
			start: start,
			end: end,
			tbl_reports_unconfirmed: tbl_reports_unconfirmed,
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
		server.getReportsTimeSeries( createOptions(1, 2, 'nebula', 'star'), callback );
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	});

	it( "should throw an error with an invalid 'start' parameter", function() {
		server.getReportsTimeSeries( createOptions('planet', 2, 'nebula', 'star'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'end' parameter", function() {
		server.getReportsTimeSeries( createOptions(1, 'blackhole', 'nebula', 'star'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'tbl_reports_unconfirmed' parameter", function() {
		server.getReportsTimeSeries( createOptions(1, 2, null, 'star'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'tbl_reports' parameter", function() {
		server.getReportsTimeSeries( createOptions(1, 2, 'nebula', null), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.dataQuery = oldDataQuery;
	});
});

describe( "getCountByArea validation", function() {
	var oldDataQuery;
	var dataQueryCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = 'hydrogen';

	function createOptions(start,end,polygon_layer,point_layer_uc,point_layer){
		return {
			start: start,
			end: end,
			polygon_layer: polygon_layer,
			point_layer_uc: point_layer_uc,
			point_layer: point_layer
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
		server.getCountByArea( createOptions(1, 2, 'helium', 'strontium', 'neon'), callback );
		test.bool( dataQueryCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData ).is( callbackDataResponse );
	});

	it( "should throw an error with an invalid 'start' parameter", function() {
		server.getCountByArea( createOptions('mercury', 2, 'helium', 'strontium', 'neon'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'end' parameter", function() {
		server.getCountByArea( createOptions(1, 'platinum', 'helium', 'strontium', 'neon'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'polygon_layer' parameter", function() {
		server.getCountByArea( createOptions(1, 2, null, 'strontium', 'neon'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'point_layer_uc' parameter", function() {
		server.getCountByArea( createOptions(1, 2, 'helium', null, 'neon'), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'point_layer' parameter", function() {
		server.getCountByArea( createOptions(1, 2, 'helium', 'strontium', null), callback );
		test.bool( dataQueryCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.dataQuery = oldDataQuery;
	});
});

describe( "getHistoricalCountByArea validation", function() {
	var oldGetCountByArea;
	var getCountByAreaCalled;
	var callbackErr;
	var callbackData;
	var callbackDataResponse = [{type:'ale'}];

	function createOptions(start_time,blocks,polygon_layer,point_layer_uc,point_layer){
		return {
			start_time: start_time,
			blocks: blocks,
			polygon_layer: polygon_layer,
			point_layer_uc: point_layer_uc,
			point_layer: point_layer
		};
	}

	function callback(err,data) {
		callbackErr = err;
		callbackData = data;
	}

	before( function() {
		oldGetCountByArea = server.getCountByArea;
		server.getCountByArea = function(queryOptions, callback){
			getCountByAreaCalled = true;
			callback(null,callbackDataResponse);
		};
	});

	beforeEach( function() {
		getCountByAreaCalled = false;
		callbackErr = null;
		callbackData = null;
	});

	it( "should call the database if parameters are valid", function() {
		server.getHistoricalCountByArea( createOptions(1, 1, 'mead', 'porter', 'lager'), callback );
		test.bool( getCountByAreaCalled ).isTrue();
		test.value( callbackErr ).isNull();
		test.value( callbackData[0].blocks[0] ).is( callbackDataResponse[0] );
	});

	it( "should throw an error with an invalid 'start_time' parameter", function() {
		server.getHistoricalCountByArea( createOptions('gin', 1, 'mead', 'porter', 'lager'), callback );
		test.bool( getCountByAreaCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'blocks' parameter", function() {
		server.getHistoricalCountByArea( createOptions(1, 'whiskey', 'mead', 'porter', 'lager'), callback );
		test.bool( getCountByAreaCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'polygon_layer' parameter", function() {
		server.getHistoricalCountByArea( createOptions(1, 1, null, 'porter', 'lager'), callback );
		test.bool( getCountByAreaCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'point_layer_uc' parameter", function() {
		server.getHistoricalCountByArea( createOptions(1, 1, 'mead', null, 'lager'), callback );
		test.bool( getCountByAreaCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	it( "should throw an error with an invalid 'point_layer' parameter", function() {
		server.getHistoricalCountByArea( createOptions(1, 1, 'mead', 'porter', null), callback );
		test.bool( getCountByAreaCalled ).isFalse();
		test.object( callbackErr ).isInstanceOf( Error );
		test.undefined( callbackData );
	});

	after( function(){
		server.getCountByArea = oldGetCountByArea;
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

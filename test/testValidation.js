'use strict';

/* jshint -W079 */ // Ignore this error for this import only, as we get a redefinition problem
var test = require('unit.js');
/* jshint +W079 */
var Validation = require('../Validation.js');
var moment = require('moment');

describe( "validateNumberParameter", function() {
	it( 'passes with a number', function() {
		test.bool( Validation.validateNumberParameter( 7 ) ).isTrue();
	});
	it( 'fails if type is not number', function() {
		test.bool( Validation.validateNumberParameter( "7" ) ).isFalse();
	});
	it( 'fails if number is NaN', function() {
		test.bool( Validation.validateNumberParameter( NaN ) ).isFalse();
	});
	it( 'fails if number is less than min', function() {
		test.bool( Validation.validateNumberParameter( 7, 8, 9 ) ).isFalse();
	});
	it( 'fails if number is more than max', function() {
		test.bool( Validation.validateNumberParameter( 7, 5, 6 ) ).isFalse();
	});
	
	it( 'passes on a moment date parse and unix time of a valid ISO8601 string', function() {
		var time = moment( "1984-01-02T03:04:05Z", moment.ISO_8601 ).unix();
		test.bool( Validation.validateNumberParameter(time) ).isTrue();
	});
	it( 'fails on a moment date parse and unix time of an invalid ISO8601 string', function() {
		var time = moment( "03:04:05PM Jan 2nd 1984 UST", moment.ISO_8601 ).unix();
		test.bool( Validation.validateNumberParameter(time) ).isFalse();
	});
});

//Test template
//describe( "suite", function() {
//	before( function() {	
//	});
//	
//	beforeEach( function() {
//	});
//	
//	it( 'case', function() {
//	});
//
//	after( function(){
//	});
//});
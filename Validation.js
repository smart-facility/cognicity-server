'use strict';

/**
 * Validation routines used by our Express server to validate user input
 * @constructor
 * @this {Validation}
 */
var Validation = function(){};

Validation.prototype = {
	
	/**
	 * Validate a parameter which should be a number, optionally with min and max values.
	 * @param {Object} param Parameter to validate - should be of type 'number'
	 * @param {number} min Optional, if supplied minimum value parameter can have and be valid
	 * @param {number} max Optional, if supplied maximum value parameter can have and be valid
	 */
	validateNumberParameter: function(param, min, max) {
		var valid = true;
		if ( typeof param !== 'number' ) valid = false;
		if ( isNaN(param) ) valid = false;
		if ( min && param < min ) valid = false;
		if ( max && param > max ) valid = false;
		return valid;
	}
		
};

module.exports = Validation;
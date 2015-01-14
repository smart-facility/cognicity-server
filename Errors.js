'use strict';

/**
 * Error construction convenience methods
 * @constructor
 * @this {Errors}
 */
var Errors = function(){};

Errors.prototype = {
	
	/**
	 * Construct a JavaScript Error object with the additional 'status' property
	 * @param {String} message The error message
	 * @param {number} status The HTTP status code for the error
	 */
	createErrorWithStatus: function(message, status) {
		var err = new Error(message);
		err.status = status;
		return err;
	}
		
};

module.exports = new Errors();
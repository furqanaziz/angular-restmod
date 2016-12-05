/**
 * API Bound Models for AngularJS
 * @version v1.1.11 - 2016-12-06
 * @link https://github.com/angular-platanus/restmod
 * @author Ignacio Baixas <ignacio@platan.us>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */

(function(angular, undefined) {
'use strict';
angular.module('restmod').factory('JsonApi', ['restmod', 'inflector', function(restmod, inflector) {

	var defaultType = function(){
		return this.$type.identity(this.$type.getProperty('usePluralType', true));
	}
	return restmod.mixin('JsonApiPacker', { // include JsonApi packer extension
		type: { init: defaultType },
		$config: {
			style: 'JsonApi',
			primaryKey: 'id',
			primaryType: 'type',
			usePluralType: true,
			getMethod: 'GET',
			putMethod: 'PATCH',
			postMethod: 'POST',
			patchMethod: 'PATCH',
			deleteMethod: 'DELETE',
			jsonRoot: 'data',
			jsonMembers: ['links', 'meta', 'jsonapi'],
			jsonIncluded: 'included',
			jsonAttributes: {
				send: 'attributes',
				fetch: 'attributes',
				skip: ['id', 'type']
			},
			jsonRelationships: {
				send: 'relationships',
				fetch: 'relationships',
				skip: []
			}
		},

		$extend: {
			// special snakecase to camelcase renaming
			Model: {
				decodeName: inflector.camelize,
				encodeName: inflector.parameterize,
				encodeUrlName: inflector.parameterize
			}
		},

		$hooks: {
			// Adding vendor json api Header media types in request
            'before-request': function(_req) {
            	_req.headers = _req.headers || [];
                _req.headers = angular.extend(_req.headers, { 'Accept': 'application/vnd.api+json' });
                _req.headers = angular.extend(_req.headers, { 'Content-Type': 'application/vnd.api+json' });
            }
        }
	});

}]);})(angular);
'use strict';

/// JsonApiPacker is part of its style because it is not required for everyone.
RMModule.factory('JsonApiPacker', ['restmod', '$injector', 'inflector', '$log', 'RMUtils', 'RMPackerCache', function(restmod, $injector, inflector, $log, Utils, packerCache) {

  /* ------------------------------------------------- */
  /* Looping through the json objecct for fetching 
  /* desired elements for included and meta processing
  /* ------------------------------------------------- */
  var include = function(_source, _list, _do) {
    for(var i = 0, l = _list.length; i < l; i++) {
      _do(_list[i], _source[_list[i]]);
    }
  }

  var exclude = function(_source, _skip, _do) {
    for(var key in _source) {
      if(_source.hasOwnProperty(key) && _skip.indexOf(key) === -1) {
        _do(key, _source[key]);
      }
    }
  }

  var processFeature = function(_raw, _feature, _other, _do) {
    if(_feature === '.' || _feature === true) {
      var skip = [];
      if(_other) skip.push.apply(skip, angular.isArray(_other) ? _other : [_other]);
      exclude(_raw, skip, _do);
    } else if(typeof _feature === 'string') {
      exclude(_raw[_feature], [], _do);
    } else { // links is an array
      include(_raw, _feature, _do);
    }
  }

  /* ------------------------------------------------- */
  /* json envelop name for any specific thing
  /* ------------------------------------------------- */
  var envelop = function(_resource, _root, _for, _default){
    var name = null;
    if(_root === false || typeof _root === 'string') {
      name = _root;
    } else {
      if(_resource.$isCollection) name = _root[_for + "Many"];
      if(!name && name !== false) name = _root[_for];
      if(!name && name !== false) name = _default; //;
    }
    return name;
  }

  var rootEnvelop = function(_resource, _for){
    return envelop.call(
      this,
      _resource,
      this.getProperty('jsonRoot', {}),
      _for || 'fetch',
      this.identity(_resource.$isCollection)
    );
  }

  var attrEnvelop = function(_resource, _for){
    return envelop.call(
      this, 
      _resource, 
      this.getProperty('jsonAttributes', {}), 
      _for || 'fetch', 
      false //disabling by default
    );
  }

  var relsEnvelop = function(_resource, _for){
    return envelop.call(
      this, 
      _resource, 
      this.getProperty('jsonRelationships', {}),
      _for || 'fetch', 
      false //disabling by default
    );
  }

  /* ------------------------------------------------- */
  /* Disclosing and enclosing attributes and relations
  /* these functions are being used in decode/encode
  /* ------------------------------------------------- */
  var disclose = function(_attr, _raw){
    if(_attr && _raw.hasOwnProperty(_attr)){
      angular.forEach(_raw[_attr], function(_value, _key){
        _raw[_key] = _value;
      });
      delete _raw[_attr];
    }
    return _raw;
  };

  var enclose = function(_attr, _raw, _filter){
    if(_attr && !_raw.hasOwnProperty(_attr)){
      var self = this;
      angular.forEach(_raw, function(_value, _key){
        _raw[_attr] = _raw[_attr] || {};
        if(!_filter || _filter.call(self, _key)){
          _raw[_attr][_key] = _value;
          delete _raw[_key];
        }else{}
      });
    }

    return _raw;
  }

  /* ------------------------------------------------- */
  /* wraps a hook callback to give access to $owner
  /* ------------------------------------------------- */
  function wrapHook(_fun, _owner) {
    return function() {
      var oldOwner = this.$owner;
      this.$owner = _owner;
      try {
        return _fun.apply(this, arguments);
      } finally {
        this.$owner = oldOwner;
      }
    };
  }

  // wraps a bunch of hooks
  function applyHooks(_target, _hooks, _owner) {
    for(var key in _hooks) {
      if(_hooks.hasOwnProperty(key)) {
        _target.$on(key, wrapHook(_hooks[key], _owner));
      }
    }
  }

  var EXT = {
    /* ------------------------------------------------- */
    /* Decoding and encoding singule resource object 
    /* this is done for before/after pack/unpack
    /* ------------------------------------------------- */
    decode: function(_resource, _raw, _mask){
      var attributes = attrEnvelop.call(this, _resource, 'fetch'),
          relationships = relsEnvelop.call(this, _resource, 'fetch');

      // mark as IdObject and try to resolve from cache
      if(_resource.$idObject !== true &&
        attributes && !_raw.hasOwnProperty(attributes) && 
        relationships && !_raw.hasOwnProperty(relationships))
      {
        _resource.$idObject = true;
        _resource.$pk = _resource.$type.inferKey(_raw);
        _resource = packerCache.resolve(_resource);
      }

      // Skip if already decoded from cache
      if(!_resource.$resolved){
        _raw = disclose.call(this, attributes, _raw);
        _raw = disclose.call(this, relationships, _raw);
        this.$super(_resource, _raw, _mask);
      }
    },

    encode: function(_resource, _mask){
      var raw = {},
          key = this.getProperty('primaryKey', 'id'),
          type = this.getProperty('primaryType', 'type'),
          attributes = attrEnvelop.call(this, _resource, 'send'),
          relationships = relsEnvelop.call(this, _resource, 'send');

      function isSkipable(_attr, _skip){
        return [key, type, attributes, relationships]
              .concat(_skip)
              .indexOf(_attr) === -1
      }
      function hasRelationMeta(_attr){
        var meta = this.$$getDescription(_attr),
            hasMeta = meta && meta.hasOwnProperty('relation');
        if(!hasMeta && this.$type.encodeName){
          meta = this.$$getDescription(this.$type.decodeName(_attr));
        }
        return meta && meta.hasOwnProperty('relation');
      }
      function isRleation(_attr){
        var options = this.getProperty('jsonRelationships', {}),
            skip = options.skip || [];
        return isSkipable(_attr, skip) && hasRelationMeta.call(this, _attr);
      }
      function isAttribute(_attr){
        var options = this.getProperty('jsonAttributes', {}),
            skip = options.skip || [];
        return isSkipable(_attr, skip) && !hasRelationMeta.call(this, _attr);
      }

      if(_resource.$idObject){
        if(!_resource[key]) return null;
        raw[key] = _resource[key];
        raw[type] = _resource[type] || _resource.$type.identity(true);
      }else{
        raw = this.$super(_resource, _mask);
        raw = enclose.call(this, relationships, raw, isRleation);
        raw = enclose.call(this, attributes, raw, isAttribute);
      }
      return raw;
    },

    /* ------------------------------------------------- */
    /* packing and unpacking server request and response  
    /* ------------------------------------------------- */
    unpack: function(_resource, _raw) {
      var nodes = [],
          root = rootEnvelop.call(this, _resource, 'fetch'),
          key = this.getProperty('primaryKey', 'id'),
          type = this.getProperty('primaryType', 'type'),
          links = this.getProperty('jsonLinks', 'included'),
          members = this.getProperty('jsonMembers', ['.']),
          included = this.getProperty('jsonIncluded', links);

      nodes = Utils.pushFlatten(nodes, root);
      nodes = Utils.pushFlatten(nodes, members);
      nodes = Utils.pushFlatten(nodes, included);

      /// Processing all extra members
      members = (members === true) ? ['.'] : members;
      members = (typeof members === 'string') ? [members] : members;
      if(members && angular.isArray(members)){
        angular.forEach(members, function(_feature){
          processFeature(_raw, _feature, nodes, function(_key, _value) {
            if(_feature === '.'){
              var feature = "$" + _key;
              _resource[feature] = _value;
            }else{
              var feature = "$" + _feature;
              _resource[feature] = _resource[feature] || {};
              _resource[feature][_key] = _value;
            }
          });
        });
      }

      /// Processing Cache
      if(included) {
        processFeature(_raw, included, nodes, function(_key, _value) {
          packerCache.feed(_value[type] || _key , _value);
        });
      }

      return root ? _raw[root] : _raw;
    },

    pack: function(_resource, _raw) {
      var root = rootEnvelop.call(this, _resource, 'send');

      if(root) {
        var result = {};
        result[root] = _raw;
        return result;
      } else {
        return _raw;
      }
    },

    /**
     * @memberof RelationBuilderApi#
     *
     * @description Registers a model **reference** relation.
     *
     * A reference relation expects the host object to provide the primary key of the referenced object or the referenced object itself (including its key).
     *
     * For example, given the following resource structure with a foreign key:
     *
     * ```json
     * {
     *   user_id: 20
     * }
     * ```
     *
     * Or this other structure with inlined data:
     *
     * ```json
     * {
     *   user: {
     *     id: 30,
     *     name: 'Steve'
     *   }
     * }
     * ```
     *
     * You should define the following model:
     *
     * ```javascript
     * restmod.model('/bikes', {
     *   user: { belongsTo: 'User' } // works for both cases detailed above
     * })
     * ```
     *
     * The object generated by the relation is not scoped to the host object, but to it's base class instead (not like hasOne),
     * so the type should not be nested.
     *
     * Its also posible to override the **foreign key name**.
     *
     * When a object containing a belongsTo reference is encoded for a server request, only the primary key value is sent using the
     * same **foreign key name** that was using on decoding. (`user_id` in the above example).
     *
     * @param {string}  _name Attribute name
     * @param {string|object} _model Other model, supports a model name or a direct reference.
     * @param {string} _key foreign key property name (optional, defaults to _attr + '_id').
     * @param {bool} _prefetch if set to true, $fetch will be automatically called on relation object load.
     * @return {BuilderApi} self
     */
    attrAsReference: function(_attr, _model, _key, _prefetch) {

      this.attrDefault(_attr, null)
          .attrMeta(_attr, { relation: 'belongs_to' });

      if(_key){
        this.attrMap(_attr, _key)
            .attrMeta(_key, { relation: 'belongs_to' });
      }

      if(typeof _model === 'string') {
        _model = $injector.get(_model);
      }

      this.attrDecoder(_attr, function(_raw) {

          if(!this[_attr]){
            this[_attr] = _model.$new();
          }

          _raw = _model.unpack(this[_attr], _raw);
          if(_raw === undefined || _raw === null || _raw === false) return null;

          this[_attr].$decode(_raw);
          if(_prefetch) this[_attr].$fetch();
          
        })
        .attrEncoder(_attr, function() {
          var raw = null;
          if(this[_attr] !== undefined && this[_attr] !== null && this[_attr] !== false){
            raw = this[_attr].$encode();
          }
          raw = _model.pack(this, raw);
          return raw;
        });

      return this;
    },

    /**
     * @memberof RelationBuilderApi#
     *
     * @description Registers a model **reference** relation.
     *
     * A reference relation expects the host object to provide the primary key of the referenced objects or the referenced objects themselves (including its key).
     *
     * For example, given the following resource structure with a foreign key array:
     *
     * ```json
     * {
     *   users_ids: [20, 30]
     * }
     * ```
     *
     * Or this other structure with inlined data:
     *
     * ```json
     * {
     *   users: [{
     *     id: 20,
     *     name: 'Steve'
     *   },{
     *     id: 30,
     *     name: 'Pili'
     *   }]
     * }
     * ```
     *
     * You should define the following model:
     *
     * ```javascript
     * restmod.model('/bikes', {
     *   users: { belongsToMany: 'User' } // works for both cases detailed above
     * })
     * ```
     *
     * The object generated by the relation is not scoped to the host object, but to it's base class instead (unlike hasMany),
     * so the referenced type should not be nested.
     *
     * When a object containing a belongsToMany reference is encoded for a server request, only the primary key value is sent for each object.
     *
     * @param {string}  _name Attribute name
     * @param {string|object} _model Other model, supports a model name or a direct reference.
     * @param {string} _keys Server name for the property that holds the referenced keys in response and request.
     * @return {BuilderApi} self
     */
    attrAsReferenceToMany: function(_attr, _model, _key) {

      this.attrDefault(_attr, function() { return []; })
          .attrMeta(_attr, { relation: 'belongs_to_many' });

      if(_key){
        this.attrMap(_attr, _key)
            .attrMeta(_key, { relation: 'belongs_to_many' });
      }

      if(typeof _model === 'string') {
        _model = $injector.get(_model);
      }

      this.attrDecoder(_attr, function(_raw) {
            this[_attr].length = 0;
            _raw = _model.unpack(_model.$collection(), _raw);
            for(var i = 0, l = _raw.length; i < l; i++) {
              var inst = _model.$new();
              inst.$decode(_raw[i]);
              this[_attr].push(inst);
            }
          })
          .attrEncoder(_attr, function() {
            var result = [], others = this[_attr];
            for(var i = 0, l = others.length; i < l; i++) {
              result.push(others[i].$encode());
            }
            return _model.pack(this, result);
          });

      return this;
    }
  }
  /* ------------------------------------------------- */
  /* Only referenced relations are used in jsonapi.org
  /* relationships object is only containing references
  /* ------------------------------------------------- */
  /**
   * @memberof RelationBuilderApi#
   *
   * @description Registers a model **resource** relation
   *
   * @param {string}  _name Attribute name
   * @param {string|object} _model Other model, supports a model name or a direct reference.
   * @param {string} _url Partial url (optional)
   * @param {string} _source Inline resource alias (optional)
   * @param {string} _inverseOf Inverse property name (optional)
   * @param {object} _hooks Hooks to be applied just to the instantiated record
   * @return {BuilderApi} self
   */
  // var attrAsResource = function(_attr, _model, _url, _source, _inverseOf, _hooks) {

  //   var options, globalHooks; // global relation configuration

  //   this.attrDefault(_attr, function() {

  //     if(typeof _model === 'string') {
  //       _model = $injector.get(_model);
  //     }

  //     // retrieve global options
  //     options = _model.getProperty('hasOne', {});
  //     globalHooks = options.hooks;
    

  //     var scope = this.$buildScope(_model, _url || _model.encodeUrlName(_attr)), inst;

  //     // setup record
  //     inst = _model.$new(null, scope);
  //     if(globalHooks) applyHooks(inst, globalHooks, this);
  //     if(_hooks) applyHooks(inst, _hooks, this);
  //     inst.$dispatch('after-has-one-init');

  //     if(_inverseOf) {
  //       inst[_inverseOf] = this;
  //     }

  //     return inst;
  //   });

  //   if(_source || _url){
  //     this.attrMap(_attr, _source || _url)
  //         .attrMeta(_source || _url, { relation: 'has_one' });
  //   }

  //   this.attrMeta(_attr, { relation: 'has_one' })
  //       .attrDecoder(_attr, function(_raw) {
  //         _raw = this[_attr].$type.unpack(this[_attr], _raw);
  //         this[_attr].$decode(_raw);
  //       })
  //       .attrEncoder(_attr, function() {
  //         var raw = this[_attr].$encode();
  //         raw = this[_attr].$type.pack(this, raw);
  //         return raw;
  //       });

  //   return this;
  // };

  // var attrAsCollection = function(_attr, _model, _url, _source, _inverseOf, _params, _hooks) {
  //   var options, globalHooks; // global relation configuration

  //   this.attrDefault(_attr, function() {

  //     if(typeof _model === 'string') {
  //       _model = $injector.get(_model);
  //     }

  //     // retrieve global options
  //     options = _model.getProperty('hasMany', {});
  //     globalHooks = options.hooks;      

  //     var scope = this.$buildScope(_model, _url || _model.encodeUrlName(_attr)), col;

  //     // setup collection
  //     col = _model.$collection(_params || null, scope);
  //     if(globalHooks) applyHooks(col, globalHooks, this);
  //     if(_hooks) applyHooks(col, _hooks, this);
  //     col.$dispatch('after-has-many-init');

  //     // set inverse property if required.
  //     if(_inverseOf) {
  //       var self = this;
  //       col.$on('after-add', function(_obj) {
  //         _obj[_inverseOf] = self;
  //       });
  //     }

  //     return col;
  //   });

  //   if(_source || _url){
  //     this.attrMap(_attr, _source || _url)
  //         .attrMeta(_source || _url, { relation: 'has_many' });
  //   }

  //   this.attrMeta(_attr, { relation: 'has_many' })
  //       .attrDecoder(_attr, function(_raw) {
  //         this[_attr].$reset();
  //         _raw = this[_attr].$type.unpack(this[_attr], _raw);
  //         this[_attr].$decode(_raw);
  //       })
  //       .attrEncoder(_attr, function() {
  //         var raw = this[_attr].$encode();
  //         raw = this[_attr].$type.pack(this, raw);
  //         return raw;
  //       });

  //   return this;
  // };

  /**
   * @class JsonApiPacker
   *
   * @description
   *
   * Simple `$unpack`, `$pack`, `$decode`, and `$encode` implementation that attempts to cover the standard proposed by
   * [jsonapi.org](http://jsonapi.org/format/).
   *
   * This used to match the wrapping structure recommented by the jsonapi.org standard. The current
   * standard is much more complex and we intend to support it via a special style.
   *
   * This mixin gives support for json root, side loaded associated resources (via supporting relations)
   * and response metadata.
   *
   * To activate add the mixin to model chain
   *
   * ```javascript
   * restmodProvide.rebase('JsonApiPacker');
   * ```
   *
   * ### Json root
   *
   * By default the mixin will use the singular model name as json root for single resource requests
   * and pluralized name for collection requests. Make sure the model name is correctly set.
   *
   * To change or disable the response/request json root use the *jsonRoot** configuration variable:
   *
   * ```javascript
   * {
   *   $config: {
   *     jsonRoot: "data" // set json root to "data" for both requests and responses.
   *     // OR
   *     jsonRoot: {
   *       send: false, // disable json root for requests
   *       fetch: "data" // expect response to use "data" as json root.
   *     }
   *   }
   * }
   * ```
   *
   * ### Side loaded resources
   *
   * By default the mixin will look for links to other resources in the 'included' root property, you
   * can change this by setting the jsonLinks variable. To use the root element as link source
   * use `jsonLinks: '.'`. You can also explicitly select which properties to consider links using an
   * array of property names. To skip links processing altogether, set it to false.
   *
   * Links are expected to use the pluralized version of the name for the referenced model. For example,
   * given the following response:
   *
   * ```json
   * {
   *   bikes: [...],
   *   links {
   *     parts: [...]
   *   }
   * }
   * ```
   *
   * Restmod will expect that the Part model plural name is correctly set parts. Only properties declared
   * as reference relations (belongsTo and belongsToMany) will be correctly resolved.
   *
   * ### Metadata
   *
   * By default metadata is only captured if it comes in the 'meta' root property. Metadata is then
   * stored in the $meta property of the resource being unwrapped.
   *
   * Just like links, to change the metadata source property set the jsonMeta property to the desired name, set
   * it to '.' to capture the entire raw response or set it to false to skip metadata and set it to an array of properties
   * to be extract selected properties.
   *
   * ### Request root object
   *
   * By default the packer will use the same naming criteria for responses and requests.
   *
   * You can disable request wrapping by setting the `jsonRoot`
   *
   */
  return restmod.mixin(function() {
    this
      .define('Model.unpack', EXT.unpack)
      .define('Model.decode', EXT.decode)
      .define('Model.encode', EXT.encode)
      .define('Model.pack', EXT.pack)
      .extend('attrAsReference', EXT.attrAsReference, ['belongsTo', 'key', 'prefetch'])
      .extend('attrAsReferenceToMany', EXT.attrAsReferenceToMany, ['belongsToMany', 'key']);
  });

}]);
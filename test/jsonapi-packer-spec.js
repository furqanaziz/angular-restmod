'use strict';

describe('JsonApiPacker', function() {

  var restmod, packerCache, User, Part;

  beforeEach(module('restmod'));

  beforeEach(module(function($provide) {

    $provide.factory('Part', function(restmod) {
      return restmod.model('/api/parts').mix('JsonApiPacker', {
        $config: {
          jsonRoot: 'data',
          jsonAttributes: 'attributes',
          jsonRelationships: 'relationships'
        }
      });
    });

  }));

  beforeEach(inject(function($injector) {
    restmod = $injector.get('restmod');
    packerCache = $injector.get('RMPackerCache');
    User = restmod.model('/api/users');
    Part = restmod.model('/api/parts');
  }));

  describe('root unwrapping', function() {

    it('should extract single resource using singular name by default', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker');

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slash' } });
      expect(record.model).toEqual('Slash');
    });

    it('should extract collection using plural name by default', function() {
      var model = restmod.model().mix({
        $config: { name: 'bike' }
      }).mix('JsonApiPacker');

      var many = model.$collection();
      many.$unwrap({ bikes: [{ model: 'Slash' }] });
      expect(many[0].model).toEqual('Slash');
    });

    it('should let the single and plural keys to be overriden separately', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: {
          jsonRoot: {
            fetch: 'one_bike',
            fetchMany: 'many_bikes'
          }
        }
      });

      var record = model.$new(1);
      record.$unwrap({ one_bike: { model: 'Slash' } });
      expect(record.model).toEqual('Slash');

      var many = model.$collection();
      many.$unwrap({ many_bikes: [{ model: 'Slash' }] });
      expect(many[0].model).toEqual('Slash');
    });

    it('should let the single and plural keys to be overriden using jsonRoot', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonRoot: 'the_root' }
      });

      var record = model.$new(1);
      record.$unwrap({ the_root: { model: 'Slash' } });
      expect(record.model).toEqual('Slash');

      var many = model.$collection();
      many.$unwrap({ the_root: [{ model: 'Slash' }] });
      expect(many[0].model).toEqual('Slash');
    });

    it('should allow disabling response wrapping by setting `fetch` config to false', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: {
          jsonRoot: {
            fetch: false
          }
        }
      });

      var record = model.$new(1);
      record.$unwrap({ model: 'Slash' });
      expect(record.model).toEqual('Slash');
    });

  });

  describe('root wrapping', function() {

    it('should wrap single resource using singular name by default', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker');

      var data = model.$buildRaw({ id: 1, name: 'Process' }).$wrap();
      expect(data).toEqual({ bike: { id: 1, name: 'Process' } });
    });

    it('should allow overriding default wrapper property name', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonRoot: 'the_root' }
      });

      var data = model.$buildRaw({ id: 1, name: 'Process' }).$wrap();
      expect(data).toEqual({ the_root: { id: 1, name: 'Process' } });
    });

    it('should allow disabling request wrapping by setting `send` config to false', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: {
          jsonRoot: {
            send: false
          }
        }
      });

      var data = model.$buildRaw({ id: 1, name: 'Process' }).$wrap();
      expect(data).toEqual({ id: 1, name: 'Process' });
    });

  });

  describe('attributes and relationships disclosing', function() {

    var Bike;
    beforeEach(function() {
      Bike = restmod.model('/api/bikes');
    });

    it('should not extract attributes or relationships by default', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker');

      var record = model.$buildRaw({  
        id: '1',
        attributes: {model: 'Slash', title: "My new bike"},
        relationships: { parts:[{id:'1'}] }
      });

      expect(record.attributes).toEqual({model: 'Slash', title: "My new bike"});
      expect(record.relationships).toEqual({ parts:[{id:'1'}] });
    });

    it('should extract attributes and relationships from given enevelops of single object', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        parts: { belongsToMany: 'Part'},
        items: { belongsToMany: 'Part', key: 'items_data'},
        tyres: { belongsToMany: 'Part'},
        handle: { belongsTo: 'Part'},
        pedle: { belongsTo: 'Part'},
        $config: {
          jsonRoot: 'data',
          jsonAttributes: 'attributes',
          jsonRelationships: 'relationships'
        }
      });

      var record = model.$new().$unwrap({
        data: {  
          id: '48',
          attributes: {model: 'Slash', title: "My new bike"},
          relationships: { 
            parts: {
              data: [
                {id:'51', type:'parts'},
                {id:'52', type:'parts'}
              ]
            },
            items_data: {
              data: [
                {id:'53', type:'items'},
                {id:'54', type:'items'}
              ]
            },
            handle: {
              data: {id:'98', type:'handles'}
            },
            pedle: {
              data: null
            },
            tyres: { 
              data:[]
            },
          }
        },
        included: [{
          type: "parts",
          id: '51',
          attributes: {
            "first-name": "Dan",
            "last-name": "Gebhardt",
            "twitter": "dgeb"
          },
          links: {
            "self": "http://example.com/parts/51"
          }
        },{
          type: "parts",
          id: '52',
          attributes: {
            "first-name": "Shaw",
            "last-name": "Baranad",
            "twitter": "dgeb"
          },
          links: {
            "self": "http://example.com/parts/51"
          }
        },{
          type: "parts",
          id: '98',
          attributes: {
            "first-name": "Furqan",
            "last-name": "Aziz",
            "twitter": "dgebadf"
          },
          links: {
            "self": "http://example.com/handle/98"
          }
        }]

      });

      expect(record.attributes).toBeUndefined();
      expect(record.relationships).toBeUndefined();
      expect(record.title).toEqual("My new bike");
      expect(record.parts.length).toEqual(2);
      expect(record.parts[0].id).toEqual('51');
      expect(record.parts[0].type).toEqual('parts');
      expect(record.parts[0]["first-name"]).toEqual('Dan');
      expect(record.parts[0]["last-name"]).toEqual('Gebhardt');
      expect(record.items.length).toEqual(2);
      expect(record.items[0].id).toEqual('53');
      expect(record.items[0].type).toEqual('items');
      expect(record.handle.id).toEqual('98');
      expect(record.handle.type).toEqual('parts');
      expect(record.handle['first-name']).toEqual('Furqan');
      expect(record.handle['last-name']).toEqual('Aziz');
      expect(record.handle['last-name']).toEqual('Aziz');
      expect(record.pedle).toEqual(null);
      expect(record.tyres.length).toEqual(0);
    });

    it('should extract attributes and relationships from given enevelops of array', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        parts: { belongsToMany: 'Part'},
        items: { belongsToMany: 'Part', key: 'items_data'},
        tyres: { belongsToMany: 'Part'},
        handle: { belongsTo: 'Part'},
        pedle: { belongsTo: 'Part'},
        $config: {
          jsonRoot: 'data',
          jsonAttributes: 'attributes',
          jsonRelationships: 'relationships'
        }
      });

      var array = model.$collection().$unwrap({
        data: [{  
          id: '48',
          attributes: {model: 'Slash', title: "My new bike"},
          relationships: { 
            parts: {
              data: [
                {id:'51', type:'parts'},
                {id:'52', type:'parts'}
              ]
            },
            items_data: {
              data: [
                {id:'53', type:'items'},
                {id:'54', type:'items'}
              ]
            },
            handle: {
              data: {id:'98', type:'handle'}
            },
            pedle: {
              data: null
            },
            tyres: {
              data: []
            }
          }
        },{  
          id: '49',
          attributes: {model: 'Gama', title: "Second new bike"},
          relationships: { 
            parts: {
              data: [
                {id:'55', type:'parts'},
                {id:'56', type:'parts'}
              ]
            },
            items_data: {
              data: [
                {id:'57', type:'items'},
                {id:'58', type:'items'}
              ]
            },
            pedle: {
              data: null
            },
            tyres: {
              data: []
            }
          }
        }],
        included: [{
          type: "parts",
          id: '51',
          attributes: {
            "first-name": "Dan",
            "last-name": "Gebhardt",
            "twitter": "dgeb"
          },
          links: {
            "self": "http://example.com/parts/51"
          }
        },{
          type: "parts",
          id: '55',
          attributes: {
            "first-name": "Apple",
            "last-name": "Mango",
            "twitter": "Dates"
          },
          links: {
            "self": "http://example.com/parts/53"
          }
        }]

      });

      var record = array[0];
      expect(record.attributes).toBeUndefined();
      expect(record.relationships).toBeUndefined();
      expect(record.title).toEqual("My new bike");
      expect(record.parts.length).toEqual(2);
      expect(record.parts[0].id).toEqual('51');
      expect(record.parts[0].type).toEqual('parts');
      expect(record.parts[0]["first-name"]).toEqual('Dan');
      expect(record.parts[0]["last-name"]).toEqual('Gebhardt');
      expect(record.items.length).toEqual(2);
      expect(record.items[0].id).toEqual('53');
      expect(record.items[0].type).toEqual('items');
      expect(record.handle.id).toEqual('98');
      expect(record.handle.type).toEqual('handle');
      expect(record.pedle).toEqual(null);
      expect(record.tyres.length).toEqual(0);

      var record = array[1];
      expect(record.attributes).toBeUndefined();
      expect(record.relationships).toBeUndefined();
      expect(record.title).toEqual("Second new bike");
      expect(record.parts.length).toEqual(2);
      expect(record.parts[0].id).toEqual('55');
      expect(record.parts[0].type).toEqual('parts');
      expect(record.parts[0]["first-name"]).toEqual('Apple');
      expect(record.parts[0]["last-name"]).toEqual('Mango');
      expect(record.items.length).toEqual(2);
      expect(record.items[0].id).toEqual('57');
      expect(record.items[0].type).toEqual('items');
      expect(record.pedle).toEqual(null);
      expect(record.tyres.length).toEqual(0);
    });

    it('should allow disabling disclosing by only setting `send` config', function() {

     var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
       $config: {
          jsonAttributes: {
            send: 'attributes',
          },
          jsonRelationships: {
            send: 'relationships',
          },
        }
      });

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slash', attributes: {title: "My new bike"}, relationships: {parts:{id:'1'} } } });

      expect(record.attributes).toBeDefined();
      expect(record.relationships).toBeDefined();
      expect(record.title).toBeUndefined();
      expect(record.parts).toBeUndefined();
      expect(record.attributes.title).toEqual("My new bike");
      expect(record.relationships.parts).toEqual({id:'1'});

    });

  });

  describe('attributes and relationships enclosing', function() {

    var Bike;
    beforeEach(function() {
      Bike = restmod.model('/api/bikes');
    });

    it('should not enclose attributes or relationships by default', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker');

      var record = model.$buildRaw({  
        id: '1',
        model: 'Slash',
        title: "My new bike",
        description: "This is my test description",
        parts:[{id:'1'}]
      });

      expect(record.attributes).toBeUndefined();
      expect(record.relationships).toBeUndefined();
      expect(record.model).toEqual('Slash');
      expect(record.title).toEqual("My new bike");
      expect(record.description).toEqual("This is my test description");
      expect(record.parts).toEqual([{id:'1'}]);
    });

    it('should enclose attributes and relationships into given enevelops', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        parts: { belongsToMany: 'Part'},
        items: { belongsToMany: 'Part', key: 'items_data'},
        tyres: { belongsToMany: 'Part'},
        handle: { belongsTo: 'Part'},
        pedle: { belongsTo: 'Part'},
        $config: {
          jsonRoot: 'data',
          jsonAttributes: 'attributesCustom',
          jsonRelationships: 'relationshipsCustom'
        }
      });

      var record = model.$new().$unwrap({
        data: {  
          id: '48',
          attributesCustom: {model: 'Slash', title: "My new bike"},
          relationshipsCustom: { 
            parts: {
              data: [
                {id:'51', type:'parts'},
                {id:'52', type:'parts'}
              ]
            },
            items_data: {
              data: [
                {id:'53', type:'items'},
                {id:'54', type:'items'}
              ]
            },
            handle: {
              data: {id:'98', type:'handles'}
            },
            pedle: {
              data: null
            },
            tyres: {
              data: []
            }
          }
        },
        included: [{
          type: "parts",
          id: '51',
          attributes: {
            "first-name": "Dan",
            "last-name": "Gebhardt",
            "twitter": "dgeb"
          },
          links: {
            "self": "http://example.com/parts/51"
          }
        },{
          type: "parts",
          id: '52',
          attributes: {
            "first-name": "Shaw",
            "last-name": "Baranad",
            "twitter": "dgeb"
          },
          links: {
            "self": "http://example.com/parts/51"
          }
        },{
          type: "parts",
          id: '98',
          attributes: {
            "first-name": "Furqan",
            "last-name": "Aziz",
            "twitter": "dgebadf"
          },
          links: {
            "self": "http://example.com/handle/98"
          }
        }]

      }).$wrap()

      expect(record.data.attributesCustom).toBeDefined();
      expect(record.data.relationshipsCustom).toBeDefined();
      expect(record.data.attributesCustom.title).toEqual("My new bike");
      expect(record.data.relationshipsCustom.parts.data.length).toEqual(2);
      expect(record.data.relationshipsCustom.parts.data[0].id).toEqual('51');
      expect(record.data.relationshipsCustom.parts.data[0].type).toEqual('parts');
      expect(record.data.relationshipsCustom.parts.data[0]["first-name"]).toBeUndefined();
      expect(record.data.relationshipsCustom.parts.data[0]["last-name"]).toBeUndefined();
      expect(record.data.relationshipsCustom['items_data'].data.length).toEqual(2);
      expect(record.data.relationshipsCustom.handle.data.id).toEqual('98');
      expect(record.data.relationshipsCustom.handle.data.type).toEqual('parts');
      expect(record.data.relationshipsCustom.pedle.data).toEqual(null);
      expect(record.data.relationshipsCustom.tyres.data.length).toEqual(0);
    });

  });

  describe('processOtherMembers', function() {

    it('should skip metadata extraction if set to false', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker').mix({ $config:{ jsonMembers: false } });

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slashed' }, meta: { pages: 1 }, jsonapi:{server: "nginx", version: '1.0'} });
      expect(record.$meta).toBeUndefined();
      expect(record.$jsonapi).toBeUndefined();
    });

    it('should extract extra members from root by default', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker').mix();

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slashed' }, meta: { pages: 1 }, jsonapi:{server: "nginx", version: '1.0'} });
      expect(record.$meta).toBeDefined();
      expect(record.$meta.pages).toEqual(1);
      expect(record.$jsonapi).toBeDefined();
      expect(record.$jsonapi.server).toEqual('nginx');
      expect(record.$jsonapi.version).toEqual('1.0');
    });

    it('should extract extra members from root if set to true', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker').mix({ $config:{ jsonMembers: true } });

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slashed' }, meta: { pages: 1 }, jsonapi:{server: "nginx", version: '1.0'} });
      expect(record.$meta).toBeDefined();
      expect(record.$meta.pages).toEqual(1);
      expect(record.$jsonapi).toBeDefined();
      expect(record.$jsonapi.server).toEqual('nginx');
      expect(record.$jsonapi.version).toEqual('1.0');
    });

    it('should extract extra members from dot as string', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker').mix({ $config:{ jsonMembers: '.' } });

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slashed' }, meta: { pages: 1 }, jsonapi:{server: "nginx", version: '1.0'} });
      expect(record.$meta).toBeDefined();
      expect(record.$meta.pages).toEqual(1);
      expect(record.$jsonapi).toBeDefined();
      expect(record.$jsonapi.server).toEqual('nginx');
      expect(record.$jsonapi.version).toEqual('1.0');
    });

    it('should extract extra members from dot as array', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker').mix({ $config:{ jsonMembers: ['.'] } });

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slashed' }, meta: { pages: 1 }, jsonapi:{server: "nginx", version: '1.0'} });
      expect(record.$meta).toBeDefined();
      expect(record.$meta.pages).toEqual(1);
      expect(record.$jsonapi).toBeDefined();
      expect(record.$jsonapi.server).toEqual('nginx');
      expect(record.$jsonapi.version).toEqual('1.0');
    });

    it('should extract extra members from specified protperty names', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker').mix({ $config:{ jsonMembers: ['jsonapi'] } });

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slashed' }, meta: { pages: 1 }, jsonapi:{server: "nginx", version: '1.0'} });
      expect(record.$meta).toBeUndefined();
      expect(record.$jsonapi).toBeDefined();
      expect(record.$jsonapi.server).toEqual('nginx');
      expect(record.$jsonapi.version).toEqual('1.0');
    });


    it('should not fail if property is not found', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker').mix({ $config:{ jsonMembers: ['jsonapi'] } });

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slashed' }, meta: { pages: 1 } });
      expect(record.$meta).toBeUndefined();
      expect(record.$jsonapi).toBeUndefined();
    });

    it('should skip included and root if set to dot', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonMembers: '.' }
      });

      var record = model.$new(1);
      record.$unwrap({ bike: { model: 'Slashed' }, meta: { pages: 1 }, jsonapi:{server: "nginx", version: '1.0'}, included: { users: [] }, pages: 20  });
      expect(record.$bike).toBeUndefined();
      expect(record.$included).toBeUndefined();
      expect(record.$meta).toBeDefined();
      expect(record.$jsonapi).toBeDefined();
      
      var model2 = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonMembers: '.', jsonIncluded: ['users', 'parts'] }
      });

      record = model2.$new(1);
      record.$unwrap({ bike: { model: 'Slash' }, users: [], parts: [], pages: 20 });
      expect(record.$bike).toBeUndefined();
      expect(record.$users).toBeUndefined();
      expect(record.$parts).toBeUndefined();
    });

  });

  describe('processIncluded', function() {

    beforeEach(function() {
      packerCache.feed = jasmine.createSpy();
    });

    it('should process included under "included" by default', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker');

      var record = model.$new(1);
      record.$unwrap({ bike: {}, included: { users: [] } });
      expect(packerCache.feed).toHaveBeenCalledWith('users', []);
    });

    it('should process included under the property defined by used', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonIncluded: 'links' }
      });

      var record = model.$new(1);
      record.$unwrap({ bike: {}, links: { users: [] } });
      expect(packerCache.feed).toHaveBeenCalledWith('users', []);
    });

    it('should process included from root if set to dot', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonIncluded: '.' }
      });

      var record = model.$new(1);
      record.$unwrap({ bike: {}, users: [] });
      expect(packerCache.feed).toHaveBeenCalledWith('users', []);
      expect(packerCache.feed).not.toHaveBeenCalledWith('bike', []);
    });

    it('should not process included if set to false', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonIncluded: false }
      });

      var record = model.$new(1);
      record.$unwrap({ bike: {}, included: { users: [] } });
      expect(packerCache.feed).not.toHaveBeenCalledWith('users', []);
    });

    it('should skip metadata and name if set to dot', function() {
      var model2 = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonIncluded: '.', jsonMembers: ['pages'] }
      });

      var record = model2.$new(1);
      record.$unwrap({ bike: { model: 'Slash' }, users: [], parts: [], pages: 20 });
      expect(packerCache.feed).not.toHaveBeenCalledWith('pages', 20);
    });

    it('should extract only included specified in array if array is given', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { jsonIncluded: ['users', 'parts'] }
      });

      var record = model.$new(1);
      record.$unwrap({ bike: {}, users: [], parts: [], rides: [] });
      expect(packerCache.feed).toHaveBeenCalledWith('users', []);
      expect(packerCache.feed).toHaveBeenCalledWith('parts', []);
      expect(packerCache.feed).not.toHaveBeenCalledWith('rides', []);
    });

    it('should feed cache based on type and id with gradual feeding', function() {
      var model = restmod.model('/api/bikes').mix('JsonApiPacker', {
        $config: { 
          primaryKey: 'id',
          primaryType: 'type',
          jsonIncluded: 'included',
        }
      });

      var record = model.$new(1);
      record.$unwrap({
        bike: {},
        included: [
          {id: '1', type: 'activity'},
          {id: '2', type: 'activity'},
          {id: '1', type: 'race'}
        ],
        rides: []
      });
      expect(packerCache.feed).toHaveBeenCalledWith('activity', {id: '1', type: 'activity'});
      expect(packerCache.feed).toHaveBeenCalledWith('activity', {id: '2', type: 'activity'});
      expect(packerCache.feed).toHaveBeenCalledWith('race', {id: '1', type: 'race'});
      expect(packerCache.feed).not.toHaveBeenCalledWith('rides', []);
    });

  });

});
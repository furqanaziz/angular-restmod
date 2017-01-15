'use strict';

describe('Style: JsonApi', function() {

  var bike;

  beforeEach(module('restmod'));

  beforeEach(module(function($provide, restmodProvider) {
    restmodProvider.rebase('JsonApi');
    $provide.factory('Bike', function(restmod) {
      return restmod.model('/api/bikes', {
        user: { hasOne: restmod.model('/api/users') },
        allUsers: { hasMany: restmod.model('/api/users') }
      });
    });
  }));

  beforeEach(inject(function(Bike) {
    bike = Bike.$new();
  }));

  it('should properly rename names on decode/encode', function() {
    bike.$decode({ 
      attributes:{
        'rear_wheel': 'crossmax'
      }
    });
    var d = bike.$encode();
    expect(bike.rearWheel).toBeDefined();
    expect(bike['rear_wheel']).not.toBeDefined();
  });

  it('should use "id" as primary key', function() {
    bike.$decode({ id: 1 });
    expect(bike.$pk).toEqual(1);
  });

  it('should properly encode url names using lowercase and dashes', function() {
    expect(bike.$decode({ id: 1 }).allUsers.$url()).toEqual('/api/bikes/1/all-users');
  });

});

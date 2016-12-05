'use strict';

describe('Restmod Utils:', function() {

  beforeEach(module('restmod'));

  var Utils, SubArray, $log;

  beforeEach(inject(function($injector) {
    Utils = $injector.get('RMUtils');
    $log = $injector.get('$log');
  }));

  describe('format', function() {
    it('should work with no arguments', function() {
      expect(Utils.format('test $1')).toEqual('test $1');
    });

    it('should properly format a string', function() {
      expect(Utils.format('im $1 $2', ['a', 'teapot'])).toEqual('im a teapot');
    });
  });

  describe('assert', function() {
    it('should log error and raise excepction if condition is false', function() {
      expect(function() {
        Utils.assert(false, 'an $1', 'error');
      }).toThrow();

      expect($log.error.logs.length).toEqual(1);
    });

    it('should do nothing if condition is true', function() {
      expect(function() {
        Utils.assert(true, 'an $1', 'error');
      }).not.toThrow();
    });
  });

  describe('buildArrayType', function() {

    beforeEach(function() {
      Array.prototype.imateapot = function() { return true; };
      SubArray = Utils.buildArrayType();
    });

    it('should return true for angular.isArray', function() {
      expect(angular.isArray(new SubArray())).toBeTruthy();
    });

    it('should propertly keep length synched', function() {
      var array = new SubArray();
      expect(array.length).toEqual(0);
      array[1] = true;
      expect(array.length).toEqual(2);
      array.length = 1;
      expect(array[1]).toBeUndefined();
    });

    it('should transfer extended array prototype functions to new type', function() {
      var array = new SubArray();
      expect(array.imateapot).toBeDefined();
    });

    it('should isolate each type prototype', function() {
      var SubArray2 = Utils.buildArrayType();
      SubArray2.prototype.imonlyin2 = function() {};

      expect([].imonlyin2).toBeUndefined();
      expect(new SubArray().imonlyin2).toBeUndefined();
      expect(new SubArray2().imonlyin2).toBeDefined();
    });

  });

  describe('indexWhere', function() {

    var _comparer = function(_item){return _item == 3; };

    it('should return -1 if item is not in array', function() {
      expect(Utils.indexWhere([1,2,4], _comparer)).toEqual(-1);
    });

    it('should return correct index if item is in array', function() {
      expect(Utils.indexWhere([1,2,3], _comparer)).toEqual(2);
    });

    it('should return -1 index if item is in array but after given start point', function() {
      expect(Utils.indexWhere([1,2,3,4,5,6,7], _comparer, 3)).toEqual(-1);
    });

  });

  describe('pushIfNotExist', function() {

    var _array = [];

    it('should insert an element in empty array', function() {
      _array = Utils.pushIfNotExist(_array, "Mango");
      expect(_array).toEqual(["Mango"]);
    });

    it('should not insert an element if already exists', function() {
      _array = Utils.pushIfNotExist(_array, "Mango");
      expect(_array).toEqual(["Mango"]);
    });

    it('should insert an element if already not exists', function() {
      _array = Utils.pushIfNotExist(_array, "Apple");
      expect(_array).toEqual(["Mango", "Apple"]);
    });

    it('should work with custom comparer function', function() {
      _array = Utils.pushIfNotExist(_array, "Banana", function(_item){return _item == "Banana"; });
      expect(_array).toEqual(["Mango", "Apple", "Banana"]);
    });

  });

  describe('pushFlatten', function() {

    var _array = [], _array2 = [];

    it('should insert an element in empty array', function() {
      _array = Utils.pushFlatten(_array, "Mango");
      expect(_array).toEqual(["Mango"]);
    });

    it('should push an element in array', function() {
      _array = Utils.pushFlatten(_array, "Apple");
      expect(_array).toEqual(["Mango", "Apple"]);
    });

    it('should push an array in array', function() {
      _array = Utils.pushFlatten(_array, ["Banana"]);
      expect(_array).toEqual(["Mango", "Apple","Banana"]);
    });

    it('should push an array of array in array', function() {
      _array = Utils.pushFlatten(_array, [["Dates"],["Peach"]]);
      expect(_array).toEqual(["Mango", "Apple","Banana","Dates","Peach"]);
    });

    it('should insert an array in empty array', function() {
      _array2 = Utils.pushFlatten(_array2, ["Mango"]);
      expect(_array2).toEqual(["Mango"]);
    });

    it('should push an element in array', function() {
      _array2 = Utils.pushFlatten(_array2, "Apple");
      expect(_array2).toEqual(["Mango", "Apple"]);
    });

    it('should push an array in array', function() {
      _array2 = Utils.pushFlatten(_array2, ["Banana"]);
      expect(_array2).toEqual(["Mango", "Apple","Banana"]);
    });

    it('should push an array of array in array', function() {
      _array2 = Utils.pushFlatten(_array2, [["Dates"],["Peach"]]);
      expect(_array2).toEqual(["Mango", "Apple","Banana","Dates","Peach"]);
    });

  });

});


/// <reference path="typings/index.d.ts" />
"use strict";
var ATLHelpers = require('./../dist/lib/ATLHelpers');
var FileSystem_1 = require('./../dist/lib/FileSystem');
var Pointer = ATLHelpers.pointerLib.Pointer;
var expect = require('expect');
describe('cloneObject', function () {
    this.bail(true);
    it('native types must be untouched', function () {
        var store = {};
        var value = "asd";
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
        value = 123;
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
        value = false;
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
        value = null;
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
        value = new Date;
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
    });
    it('objects must be cloned', function () {
        var store = {};
        var value = { a: 1, b: "2", c: null, d: undefined, e: false, f: new Date };
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
        expect(ATLHelpers.cloneObjectUsingPointers(value, store) !== value).toBe(true, "Got same object reference");
    });
    it('arrays must be cloned', function () {
        var store = {};
        var value = ["asd", 123, null, false, new Date];
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
        expect(ATLHelpers.cloneObjectUsingPointers(value, store) !== value).toBe(true, "Got same object reference");
        expect(ATLHelpers.cloneObjectUsingPointers(value, store) instanceof Array).toBe(true, "Not instance of an array");
    });
    it('arrays containing objects must be cloned recursively', function () {
        var store = {};
        var value = [[], { a: 2 }, "asd", 123, null, false, new Date, { a: 1, b: "2", c: null, d: undefined, e: false, f: new Date }];
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
        expect(ATLHelpers.cloneObjectUsingPointers(value, store) !== value).toBe(true, "Got same object reference");
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)[0] !== value[0]).toBe(true, "Got same object reference internal");
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)[1] !== value[1]).toBe(true, "Got same object reference internal");
    });
    it('objects containing arrays must be cloned recursively', function () {
        var store = {};
        var value = { a: 1, b: "2", c: null, d: undefined, e: false, f: new Date, arr: ["asd", 123, null, false, new Date] };
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
        expect(ATLHelpers.cloneObjectUsingPointers(value, store) !== value).toBe(true, "Got same object reference");
        expect(ATLHelpers.cloneObjectUsingPointers(value, store).arr !== value.arr).toBe(true, "Got same object reference internal");
    });
    it('pointers must be readed inside objects', function () {
        var store = { a: 3 };
        var expected = { val: 3 };
        var value = {
            val: new Pointer("a")
        };
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(expected, typeof value);
    });
    it('a single pointer must be readed and return the value', function () {
        var store = { a: 3 };
        var expected = 3;
        var value = new Pointer("a");
        expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(expected, typeof value);
    });
    it('a single pointer must be readed, if the result is an object, it must be cloned', function () {
        var store = { a: { c: 3 } };
        var expected = { c: 3 };
        var value = new Pointer("a");
        var result = ATLHelpers.cloneObjectUsingPointers(value, store);
        expect(result).toEqual(expected, typeof value);
        expect(result !== store.a).toBe(true, "Reference not copied");
    });
    it('if the pointer is an object or array, the result must be cloned', function () {
        var store = { a: { c: 3 } };
        var expected = { val: { c: 3 } };
        var value = { val: new Pointer("a") };
        var result = ATLHelpers.cloneObjectUsingPointers(value, store);
        expect(result).toEqual(expected, typeof value);
        expect(result.val !== store.a).toBe(true, "Reference not copied");
    });
    var resolver = new FileSystem_1.FSResolver(__dirname);
    it('inner IncludedFiles (.json) must be readed and parsed', function () {
        var store = { a: new FileSystem_1.IncludedFile('valid-specs/test.json') };
        var expected = { val: { json: true } };
        var value = { val: new Pointer("a") };
        var result = ATLHelpers.cloneObjectUsingPointers(value, store, resolver);
        expect(result).toEqual(expected, typeof value);
    });
    it('IncludedFiles (.json) must be readed and parsed', function () {
        var store = new FileSystem_1.IncludedFile('valid-specs/test.json');
        var expected = { json: true };
        var result = ATLHelpers.cloneObjectUsingPointers(store, store, resolver);
        expect(result).toEqual(expected, typeof store);
    });
    it('inner IncludedFiles (.*) must be readed', function () {
        var store = { a: new FileSystem_1.IncludedFile('valid-specs/text.txt') };
        var expected = { val: "test" };
        var value = { val: new Pointer("a") };
        var result = ATLHelpers.cloneObjectUsingPointers(value, store, resolver);
        expect(result).toEqual(expected, typeof value);
    });
    it('IncludedFiles (.*) must be readed and parsed', function () {
        var store = new FileSystem_1.IncludedFile('valid-specs/text.txt');
        var expected = "test";
        var result = ATLHelpers.cloneObjectUsingPointers(store, store, resolver);
        expect(result).toEqual(expected, typeof store);
    });
    this.bail(false);
});
//# sourceMappingURL=2.cloneObject.spec.js.map
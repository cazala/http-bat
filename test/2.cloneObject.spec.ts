/// <reference path="typings/index.d.ts" />

import {ATL, IATLOptions} from './../dist/lib/ATL';
import ATLHelpers = require('./../dist/lib/ATLHelpers');
import { IncludedFile, FSResolver } from './../dist/lib/FileSystem';

const Pointer = ATLHelpers.pointerLib.Pointer;

const expect = require('expect');

declare var describe, it;

describe('cloneObject', function () {
  this.bail(true);
  it('native types must be untouched', () => {
    let store = {};

    let value: any = "asd";

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

  it('objects must be cloned', () => {
    let store = {};

    let value: any = { a: 1, b: "2", c: null, d: undefined, e: false, f: new Date };

    expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
    expect(ATLHelpers.cloneObjectUsingPointers(value, store) !== value).toBe(true, "Got same object reference");
  });

  it('arrays must be cloned', () => {
    let store = {};

    let value: any = ["asd", 123, null, false, new Date];

    expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
    expect(ATLHelpers.cloneObjectUsingPointers(value, store) !== value).toBe(true, "Got same object reference");
    expect(ATLHelpers.cloneObjectUsingPointers(value, store) instanceof Array).toBe(true, "Not instance of an array");
  });

  it('arrays containing objects must be cloned recursively', () => {
    let store = {};

    let value = [[], { a: 2 }, "asd", 123, null, false, new Date, { a: 1, b: "2", c: null, d: undefined, e: false, f: new Date }];

    expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
    expect(ATLHelpers.cloneObjectUsingPointers(value, store) !== value).toBe(true, "Got same object reference");
    expect(ATLHelpers.cloneObjectUsingPointers(value, store)[0] !== value[0]).toBe(true, "Got same object reference internal");
    expect(ATLHelpers.cloneObjectUsingPointers(value, store)[1] !== value[1]).toBe(true, "Got same object reference internal");
  });


  it('objects containing arrays must be cloned recursively', () => {
    let store = {};

    let value = { a: 1, b: "2", c: null, d: undefined, e: false, f: new Date, arr: ["asd", 123, null, false, new Date] };

    expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(value, typeof value);
    expect(ATLHelpers.cloneObjectUsingPointers(value, store) !== value).toBe(true, "Got same object reference");
    expect(ATLHelpers.cloneObjectUsingPointers(value, store).arr !== value.arr).toBe(true, "Got same object reference internal");
  });


  it('pointers must be readed inside objects', () => {
    let store = { a: 3 };
    let expected = { val: 3 };

    let value = {
      val: new Pointer("a")
    };

    expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(expected, typeof value);
  });

  it('a single pointer must be readed and return the value', () => {
    let store = { a: 3 };
    let expected = 3;

    let value = new Pointer("a");

    expect(ATLHelpers.cloneObjectUsingPointers(value, store)).toEqual(expected, typeof value);
  });

  it('a single pointer must be readed, if the result is an object, it must be cloned', () => {
    let store = { a: { c: 3 } };
    let expected = { c: 3 };

    let value = new Pointer("a");

    let result = ATLHelpers.cloneObjectUsingPointers(value, store);

    expect(result).toEqual(expected, typeof value);
    expect(result !== store.a).toBe(true, "Reference not copied");
  });

  it('if the pointer is an object or array, the result must be cloned', () => {
    let store = { a: { c: 3 } };
    let expected = { val: { c: 3 } };

    let value = { val: new Pointer("a") };

    let result = ATLHelpers.cloneObjectUsingPointers(value, store);

    expect(result).toEqual(expected, typeof value);
    expect(result.val !== store.a).toBe(true, "Reference not copied");
  });


  let resolver = new FSResolver(__dirname);


  it('inner IncludedFiles (.json) must be readed and parsed', () => {
    let store = { a: new IncludedFile('valid-specs/test.json') };
    let expected = { val: { json: true } };

    let value = { val: new Pointer("a") };

    let result = ATLHelpers.cloneObjectUsingPointers(value, store, resolver);

    expect(result).toEqual(expected, typeof value);
  });

  it('IncludedFiles (.json) must be readed and parsed', () => {
    let store = new IncludedFile('valid-specs/test.json');
    let expected = { json: true };

    let result = ATLHelpers.cloneObjectUsingPointers(store, store, resolver);

    expect(result).toEqual(expected, typeof store);
  });


  it('inner IncludedFiles (.*) must be readed', () => {
    let store = { a: new IncludedFile('valid-specs/text.txt') };
    let expected = { val: "test" };

    let value = { val: new Pointer("a") };

    let result = ATLHelpers.cloneObjectUsingPointers(value, store, resolver);

    expect(result).toEqual(expected, typeof value);
  });

  it('IncludedFiles (.*) must be readed and parsed', () => {
    let store = new IncludedFile('valid-specs/text.txt');
    let expected = "test";

    let result = ATLHelpers.cloneObjectUsingPointers(store, store, resolver);

    expect(result).toEqual(expected, typeof store);
  });


  this.bail(false);
});
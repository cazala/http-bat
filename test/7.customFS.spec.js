/// <reference path="typings/index.d.ts" />
"use strict";
const dist_1 = require('../dist');
const mocha_1 = require('../dist/adapters/mocha');
let files = {
    "/schema.json": `{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "json": {
      "type": "boolean"
    }
  },
  "required": [
    "json"
  ]
}`,
    "/test.json": '{"json": true}',
    "/api.raml": `#%RAML 0.8
---
title: Example API
version: 1.0
baseUri: http://httpbin.org

schemas:
  - abc: !include schema.json

/post:
  post:
    responses:
      200:
`,
    "/file.yml": `#%ATL 1.0
baseUri: http://httpbin.org
raml: /api.raml

variables:
  json: !include /test.json

schemas:
  bca: !include /schema.json

tests:
  "Include json on request":
    async: true
    skip: true
    POST /post:
      request:
        json: !include /test.json
      response:
        status: 200
        body:
          matches:
            - json: {
              json: true
            }
          schema: abc
  "Include json on variables":
    async: true
    skip: true
    POST /post:
      request:
        json: !!variable json
      response:
        status: 200
        body:
          matches:
            - json: {
              json: true
          }
          schema: bca
  "Include json on variables, variables on matches":
    async: true
    POST /post:
      request:
        json: !!variable json
      response:
        status: 200
        body:
          matches:
            - json: !!variable json
  "Include json on variables, matches with include":
    async: true
    POST /post:
      request:
        json: !!variable json
      response:
        status: 200
        body:
          matches:
            - json: !include /test.json
  `
};
let resolver = {
    content(path) {
        if (!files[path])
            throw new Error("Virtual file not found " + path);
        return files[path];
    },
    contentAsync(path) {
        try {
            return Promise.resolve(resolver.content(path));
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
};
describe('Test custom FSResolver', function () {
    this.bail(true);
    let instance = new dist_1.Bat({ FSResolver: resolver });
    it('options.loadAssets == true', () => {
        if (instance.options.loadAssets != true)
            throw new Error("Default loadAssets value not seted on Bat");
    });
    it('atl.options.loadAssets == true', () => {
        if (instance.atl.options.loadAssets != true)
            throw new Error("Default loadAssets value not seted on ATL");
    });
    instance.load("/file.yml");
    it('options.loadAssets == true after load', () => {
        if (instance.options.loadAssets != true)
            throw new Error("Default loadAssets value not seted on Bat");
    });
    it('atl.options.loadAssets == true after load', () => {
        if (instance.atl.options.loadAssets != true)
            throw new Error("Default loadAssets value not seted on ATL");
    });
    it('Must load without errors', () => {
        if (instance.errors.filter(x => !!x).length)
            throw instance.errors.filter(x => !!x)[0];
    });
    it('Must load RAML without errors', () => {
        if (!instance.atl.raml)
            throw new Error("No raml found");
        let errors = instance.atl.raml.errors();
        if (errors.length)
            throw errors[0];
    });
    this.bail(false);
    mocha_1.registerMochaSuites(instance);
    it('Must pass', (done) => {
        instance.run().then(() => done()).catch(x => done(x));
    });
});
//# sourceMappingURL=7.customFS.spec.js.map
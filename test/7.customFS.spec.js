/// <reference path="typings/index.d.ts" />
"use strict";
var dist_1 = require('../dist');
var mocha_1 = require('../dist/adapters/mocha');
var files = {
    "/schema.json": "{\n  \"$schema\": \"http://json-schema.org/draft-04/schema#\",\n  \"type\": \"object\",\n  \"properties\": {\n    \"json\": {\n      \"type\": \"boolean\"\n    }\n  },\n  \"required\": [\n    \"json\"\n  ]\n}",
    "/test.json": '{"json": true}',
    "/api.raml": "#%RAML 0.8\n---\ntitle: Example API\nversion: 1.0\nbaseUri: http://httpbin.org\n\nschemas:\n  - abc: !include schema.json\n\n/post:\n  post:\n    responses:\n      200:\n",
    "/file.yml": "#%ATL 1.0\nbaseUri: http://httpbin.org\nraml: /api.raml\n\nvariables:\n  json: !include /test.json\n\nschemas:\n  bca: !include /schema.json\n\ntests:\n  \"Include json on request\":\n    async: true\n    skip: true\n    POST /post:\n      request:\n        json: !include /test.json\n      response:\n        status: 200\n        body:\n          matches:\n            - json: {\n              json: true\n            }\n          schema: abc\n  \"Include json on variables\":\n    async: true\n    skip: true\n    POST /post:\n      request:\n        json: !!variable json\n      response:\n        status: 200\n        body:\n          matches:\n            - json: {\n              json: true\n          }\n          schema: bca\n  \"Include json on variables, variables on matches\":\n    async: true\n    POST /post:\n      request:\n        json: !!variable json\n      response:\n        status: 200\n        body:\n          matches:\n            - json: !!variable json\n  \"Include json on variables, matches with include\":\n    async: true\n    POST /post:\n      request:\n        json: !!variable json\n      response:\n        status: 200\n        body:\n          matches:\n            - json: !include /test.json\n  "
};
var resolver = {
    content: function (path) {
        if (!files[path])
            throw new Error("Virtual file not found " + path);
        return files[path];
    },
    contentAsync: function (path) {
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
    var instance = new dist_1.Bat({ FSResolver: resolver });
    it('options.loadAssets == true', function () {
        if (instance.options.loadAssets != true)
            throw new Error("Default loadAssets value not seted on Bat");
    });
    it('atl.options.loadAssets == true', function () {
        if (instance.atl.options.loadAssets != true)
            throw new Error("Default loadAssets value not seted on ATL");
    });
    instance.load("/file.yml");
    it('options.loadAssets == true after load', function () {
        if (instance.options.loadAssets != true)
            throw new Error("Default loadAssets value not seted on Bat");
    });
    it('atl.options.loadAssets == true after load', function () {
        if (instance.atl.options.loadAssets != true)
            throw new Error("Default loadAssets value not seted on ATL");
    });
    it('Must load without errors', function () {
        if (instance.errors.filter(function (x) { return !!x; }).length)
            throw instance.errors.filter(function (x) { return !!x; })[0];
    });
    it('Must load RAML without errors', function () {
        if (!instance.atl.raml)
            throw new Error("No raml found");
        var errors = instance.atl.raml.errors();
        if (errors.length)
            throw errors[0];
    });
    this.bail(false);
    var runner = instance.createRunner();
    mocha_1.registerMochaSuites(runner, instance);
    it('Must pass', function (done) {
        runner.run();
        runner.then(function () { return done(); }).catch(function (x) { return done(x); });
    });
});
//# sourceMappingURL=7.customFS.spec.js.map
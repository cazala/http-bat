"use strict";
// Node
var fs = require('fs');
var path = require('path');
// NPM
// import jsYaml = require('js-yaml');
var _ = require('lodash');
var request = require('supertest');
var pathMatch = require('raml-path-match');
// Locals
var ATL_1 = require('./ATL');
var ATLHelpers = require('./ATLHelpers');
var YAML = require('./YAML');
var Coverage_1 = require('./Coverage');
var Bat = (function () {
    function Bat(options) {
        if (options === void 0) { options = {}; }
        this.options = options;
        this.errors = [];
        this.atl = new ATL_1.ATL();
        var gotAST = ATLHelpers.flatPromise();
        if (options.raw) {
            this.raw(options.raw);
        }
        else if (this.options.file) {
            this.load(options.file);
        }
    }
    Bat.prototype.updateState = function () {
        if (this.options.variables) {
            _.merge(this.atl.options.variables, this.options.variables);
        }
        if (this.options.baseUri && this.options.baseUri != 'default') {
            this.atl.options.baseUri = this.options.baseUri;
        }
    };
    Bat.prototype.load = function (file) {
        this.path = path.dirname(file);
        process.chdir(this.path);
        this.file = file;
        this.raw(fs.readFileSync(this.file, 'utf8'));
    };
    Bat.prototype.raw = function (content) {
        var parsed = YAML.load(content);
        this.atl.options.path = this.path;
        this.atl.fromAST(parsed);
        this.updateState();
        YAML.walkFindingErrors(parsed, this.errors);
        // Parse the raml for coverage
        if (this.atl.raml) {
            this.RAMLCoverage = new Coverage_1.RAMLCoverage(this.atl.raml, this.atl);
        }
    };
    Bat.prototype.run = function (app) {
        var _this = this;
        var prom = ATLHelpers.flatPromise();
        if (this.errors.length) {
            var errorStr = this.errors.map(YAML.getErrorString).join('\n');
            throw new Error('Can not run with errors. Found ' + this.errors.length + '\n' + errorStr);
        }
        try {
            if (this.atl.options.selfSignedCert) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            }
            if (this.options.baseUri == 'default')
                delete this.options.baseUri;
            if (!app || app === "default" || app === '') {
                app = this.options.baseUri || this.atl.options.baseUri;
            }
            if (!app) {
                throw new Error("baseUri not specified");
            }
            if (typeof app === 'string' && app.substr(-1) === '/') {
                app = app.substr(0, app.length - 1);
            }
            this.atl.agent = request.agent(app);
            // Run tests
            var tests = this.allTests();
            var allDone_1 = [];
            tests.forEach(function (test) {
                var testResult = test.promise;
                allDone_1.push(testResult
                    .then(function (result) {
                    return Promise.resolve({
                        success: true
                    });
                })
                    .catch(function (result) {
                    return Promise.resolve({
                        success: false
                    });
                }));
                if (_this.RAMLCoverage && !test.skip) {
                    testResult.then(function () {
                        _this.RAMLCoverage.registerTestResult(test, {
                            req: test.requester.superAgentRequest,
                            res: test.requester.superAgentResponse,
                            test: test,
                            url: test.requester.url
                        });
                    });
                }
            });
            Promise.all(allDone_1).then(function () { return prom.resolver(); });
            Object.keys(this.atl.suites).forEach(function (x) { return _this.atl.suites[x].run(); });
        }
        catch (e) {
            prom.rejecter(e);
        }
        return prom.promise;
    };
    Bat.prototype.allTests = function () {
        return this.atl.allTests();
    };
    return Bat;
}());
exports.Bat = Bat;
//# sourceMappingURL=bat.js.map
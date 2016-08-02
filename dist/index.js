"use strict";
var path = require('path');
// NPM
var _ = require('lodash');
var request = require('supertest');
var pathMatch = require('raml-path-match');
// Locals
var ATL_1 = require('./lib/ATL');
exports.ATLHelpers = require('./lib/ATLHelpers');
exports.Coverage = require('./lib/Coverage');
exports.YAML = require('./lib/YAML');
var Coverage_1 = require('./lib/Coverage');
exports.FileSystem = require('./lib/FileSystem');
var ATLRunner_1 = require('./lib/Runners/ATLRunner');
var Bat = (function () {
    function Bat(options) {
        if (options === void 0) { options = { loadAssets: true }; }
        this.options = options;
        this.errors = [];
        if (!('loadAssets' in options))
            options.loadAssets = true;
        this.atl = new ATL_1.ATL({
            FSResolver: options.FSResolver,
            loadAssets: options.loadAssets
        });
        var gotAST = exports.ATLHelpers.flatPromise();
        if (options.raw) {
            this.raw(options.raw);
        }
        else if (options.file) {
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
        this.raw((this.options.FSResolver || exports.FileSystem.DefaultFileResolver).content(this.file));
    };
    Bat.prototype.raw = function (content) {
        var parsed = exports.YAML.load(content);
        if (this.file) {
            this.atl.options.file = this.file;
        }
        if (this.file || this.path) {
            this.atl.options.path = this.path || this.file && path.dirname(this.file);
        }
        this.atl.options.FSResolver.basePath = this.atl.options.path;
        this.atl.options.loadAssets = this.options.loadAssets;
        this.atl.fromAST(parsed);
        this.updateState();
        exports.YAML.walkFindingErrors(parsed, this.errors);
        // Parse the raml for coverage
        if (this.atl.raml) {
            this.RAMLCoverage = new Coverage_1.RAMLCoverage(this.atl.raml, this.atl);
        }
    };
    Bat.prototype.createRunner = function (app) {
        var _this = this;
        var prom = exports.ATLHelpers.flatPromise();
        if (this.errors.length) {
            var errorStr = this.errors.map(exports.YAML.getErrorString).join('\n');
            throw new Error('Can not run with errors. Found ' + this.errors.length + '\n' + errorStr);
        }
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
        // Run tests
        var runner = new ATLRunner_1.default(this.atl, request.agent(app));
        var tests = runner.allTestRunners();
        tests.forEach(function (test) {
            if (_this.RAMLCoverage && test.request) {
                test.request.then(function () {
                    _this.RAMLCoverage.registerTestResult({
                        req: test.request.superAgentRequest,
                        res: test.request.value,
                        test: test.suite.test,
                        url: test.request.url,
                        urlObject: test.request.urlObject
                    });
                });
            }
        });
        return runner;
    };
    Bat.prototype.run = function (app) {
        var runner = this.createRunner(app);
        runner.run();
        return runner;
    };
    Bat.prototype.allTests = function () {
        return this.atl.allTests();
    };
    return Bat;
}());
exports.Bat = Bat;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Bat;
//# sourceMappingURL=index.js.map
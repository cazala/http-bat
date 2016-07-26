"use strict";
const path = require('path');
// NPM
const _ = require('lodash');
const request = require('supertest');
const pathMatch = require('raml-path-match');
// Locals
const ATL_1 = require('./lib/ATL');
exports.ATLHelpers = require('./lib/ATLHelpers');
exports.Coverage = require('./lib/Coverage');
exports.YAML = require('./lib/YAML');
const Coverage_1 = require('./lib/Coverage');
exports.FileSystem = require('./lib/FileSystem');
class Bat {
    constructor(options = { loadAssets: true }) {
        this.options = options;
        this.errors = [];
        if (!('loadAssets' in options))
            options.loadAssets = true;
        this.atl = new ATL_1.ATL({
            FSResolver: options.FSResolver,
            loadAssets: options.loadAssets
        });
        let gotAST = exports.ATLHelpers.flatPromise();
        if (options.raw) {
            this.raw(options.raw);
        }
        else if (options.file) {
            this.load(options.file);
        }
    }
    updateState() {
        if (this.options.variables) {
            _.merge(this.atl.options.variables, this.options.variables);
        }
        if (this.options.baseUri && this.options.baseUri != 'default') {
            this.atl.options.baseUri = this.options.baseUri;
        }
    }
    load(file) {
        this.path = path.dirname(file);
        process.chdir(this.path);
        this.file = file;
        this.raw((this.options.FSResolver || exports.FileSystem.DefaultFileResolver).content(this.file));
    }
    raw(content) {
        let parsed = exports.YAML.load(content);
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
    }
    run(app) {
        let prom = exports.ATLHelpers.flatPromise();
        if (this.errors.length) {
            let errorStr = this.errors.map(exports.YAML.getErrorString).join('\n');
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
            let tests = this.allTests();
            let allDone = [];
            tests.forEach(test => {
                let testResult = test.promise;
                allDone.push(testResult
                    .then(result => {
                    return Promise.resolve({
                        success: true
                    });
                })
                    .catch(result => {
                    return Promise.resolve({
                        success: false
                    });
                }));
                if (this.RAMLCoverage && !test.skip) {
                    testResult.then(() => {
                        this.RAMLCoverage.registerTestResult(test, {
                            req: test.requester.superAgentRequest,
                            res: test.requester.superAgentResponse,
                            test: test,
                            url: test.requester.url
                        });
                    });
                }
            });
            Promise.all(allDone).then(() => prom.resolver());
            Object.keys(this.atl.suites).forEach(x => this.atl.suites[x].run());
        }
        catch (e) {
            prom.rejecter(e);
        }
        return prom.promise;
    }
    allTests() {
        return this.atl.allTests();
    }
}
exports.Bat = Bat;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Bat;
//# sourceMappingURL=index.js.map
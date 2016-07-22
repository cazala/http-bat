"use strict";
// Node
const fs = require('fs');
const path = require('path');
// NPM
// import jsYaml = require('js-yaml');
const _ = require('lodash');
const request = require('supertest');
const pathMatch = require('raml-path-match');
// Locals
const ATL_1 = require('./ATL');
const ATLHelpers = require('./ATLHelpers');
const YAML = require('./YAML');
const Coverage_1 = require('./Coverage');
class Bat {
    constructor(options = {}) {
        this.options = options;
        this.errors = [];
        this.atl = new ATL_1.ATL();
        let gotAST = ATLHelpers.flatPromise();
        if (options.raw) {
            this.raw(options.raw);
        }
        else if (this.options.file) {
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
        this.raw(fs.readFileSync(this.file, 'utf8'));
    }
    raw(content) {
        let parsed = YAML.load(content);
        this.atl.options.path = this.path;
        this.atl.fromAST(parsed);
        this.updateState();
        YAML.walkFindingErrors(parsed, this.errors);
        // Parse the raml for coverage
        if (this.atl.raml) {
            this.RAMLCoverage = new Coverage_1.RAMLCoverage(this.atl.raml, this.atl);
        }
    }
    run(app) {
        let prom = ATLHelpers.flatPromise();
        if (this.errors.length) {
            let errorStr = this.errors.map(YAML.getErrorString).join('\n');
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
//# sourceMappingURL=bat.js.map
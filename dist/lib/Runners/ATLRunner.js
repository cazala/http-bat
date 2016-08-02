"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Runnable_1 = require('../Runnable');
var SuiteRunner_1 = require('./SuiteRunner');
var ATLRunner = (function (_super) {
    __extends(ATLRunner, _super);
    function ATLRunner(atl, agent) {
        var _this = this;
        _super.call(this, function (runnable) {
            _this.allTestRunners().forEach(function (x) { return x.run(); });
            return Promise.all(_this.suiteRunners.map(function (x) { return x.innerPromise; }));
        });
        this.atl = atl;
        this.agent = agent;
        this.suiteRunners = [];
        this.name = atl.options.file;
        for (var suiteName in atl.suites) {
            var suiteRunner = new SuiteRunner_1.default(atl.suites[suiteName], this, null);
            this.suiteRunners.push(suiteRunner);
            this.addDependency(suiteRunner);
        }
        this.configureAsyncDependencies();
    }
    ATLRunner.prototype.configureAsyncDependencies = function () {
        var requiredSuites = [];
        var lastSyncSuite = null;
        this.suiteRunners.forEach(function (suiteRunner) {
            var suite = suiteRunner.suite;
            if (suite.async) {
                if (lastSyncSuite) {
                    suiteRunner.starter.addDependency(lastSyncSuite, lastSyncSuite.suite.soft ? Runnable_1.EDependencyKind.Both : Runnable_1.EDependencyKind.Pass);
                }
                requiredSuites.push(suiteRunner);
            }
            else {
                requiredSuites.forEach(function (x) {
                    return suiteRunner.starter.addDependency(x, lastSyncSuite.suite.soft ? Runnable_1.EDependencyKind.Both : Runnable_1.EDependencyKind.Pass);
                });
                if (lastSyncSuite)
                    suiteRunner.starter.addDependency(lastSyncSuite, lastSyncSuite.suite.soft ? Runnable_1.EDependencyKind.Both : Runnable_1.EDependencyKind.Pass);
                requiredSuites.length = 0;
                lastSyncSuite = suiteRunner;
            }
        });
    };
    ATLRunner.prototype.allTestRunners = function () {
        var out = [];
        if (this.suiteRunners) {
            this.suiteRunners.forEach(function (sr) {
                if (sr.request)
                    out.push(sr);
                out = out.concat(sr.allTestRunners());
            });
        }
        return out;
    };
    return ATLRunner;
}(Runnable_1.Runnable));
exports.ATLRunner = ATLRunner;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ATLRunner;
//# sourceMappingURL=ATLRunner.js.map
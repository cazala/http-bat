"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ATLRequest_1 = require('../ATLRequest');
var Pointer_1 = require('../Pointer');
var ATLHelpers_1 = require('../ATLHelpers');
var Runnable_1 = require('../Runnable');
var ATLAssertion_1 = require('../ATLAssertion');
var SuiteRunner = (function (_super) {
    __extends(SuiteRunner, _super);
    function SuiteRunner(suite, ATLRunner, parent) {
        var _this = this;
        _super.call(this, function (runnable) {
            var prom = ATLHelpers_1.flatPromise();
            var dependencies = [];
            if (_this.request) {
                dependencies.push(_this.request.innerPromise);
            }
            if (_this.assertionRunners) {
                _this.assertionRunners.forEach(function (x) {
                    dependencies.push(x.innerPromise);
                });
            }
            if (_this.suiteRunners) {
                _this.suiteRunners.forEach(function (x) {
                    dependencies.push(x.innerPromise);
                });
            }
            if (dependencies.length) {
                Promise.all(dependencies)
                    .then(function () { return prom.resolver(true); })
                    .catch(function (err) { return prom.rejecter(err); });
            }
            else {
                prom.resolver(true);
            }
            return prom.promise;
        });
        this.suite = suite;
        this.ATLRunner = ATLRunner;
        this.parent = parent;
        this.starter = new Runnable_1.Runnable(function () { return Promise.resolve(true); });
        this.assertionRunners = [];
        this.name = this.suite.name
            + (this.suite.skip ? '\n[SKIPPED]' : '')
            + (this.suite.async ? '\n[ASYNC]' : '');
        if (this.suite.test) {
            if (!this.suite.skip) {
                this.request = new ATLRequest_1.default(this.suite.test, ATLRunner);
                this.request.addDependency(this.starter, Runnable_1.EDependencyKind.Pass);
                this.generateTestAssertions();
                this.addDependency(this.request);
                this.assertionRunners.forEach(function (x) { return _this.addDependency(x); });
            }
            else {
                this.addDependency(this.starter);
            }
        }
        if (this.suite.suites) {
            this.suiteRunners = [];
            if (this.suite.skip) {
                this.addDependency(this.starter);
            }
            else {
                var previousSuiteRunner_1 = null;
                this.suite.suites.forEach(function (suite) {
                    if (suite != _this.suite) {
                        var suiteRunner = new SuiteRunner(suite, ATLRunner, _this);
                        _this.suiteRunners.push(suiteRunner);
                        if (previousSuiteRunner_1) {
                            suiteRunner.starter.addDependency(previousSuiteRunner_1, previousSuiteRunner_1.suite.soft ? Runnable_1.EDependencyKind.Pass : Runnable_1.EDependencyKind.Both);
                        }
                        previousSuiteRunner_1 = suiteRunner;
                    }
                });
                if (this.suiteRunners.length) {
                    this.suiteRunners[0].starter.addDependency(this.starter);
                }
                if (previousSuiteRunner_1) {
                    this.addDependency(previousSuiteRunner_1);
                }
            }
        }
    }
    SuiteRunner.prototype.run = function (trigger) {
        this.starter.run(trigger);
        if (this.request) {
            this.request.run();
        }
        if (this.assertionRunners) {
            this.assertionRunners.forEach(function (x) {
                x.run();
            });
        }
        _super.prototype.run.call(this, trigger);
    };
    SuiteRunner.prototype.allTestRunners = function () {
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
    SuiteRunner.prototype.generateTestAssertions = function () {
        var _this = this;
        var test = this.suite.test;
        if (test.suite.skip)
            return;
        if (test.response) {
            if (test.response.status) {
                this.assertionRunners.push(new ATLAssertion_1.CommonAssertions.StatusCodeAssertion(this.request, test.response.status));
            }
            if (test.response.body) {
                if ('is' in test.response.body) {
                    this.assertionRunners.push(new ATLAssertion_1.CommonAssertions.BodyEqualsAssertion(this.request, test.response.body.is));
                }
                if (test.response.body.schema) {
                    this.assertionRunners.push(new ATLAssertion_1.CommonAssertions.ValidateSchemaOperation(this.request, test.response.body.schema));
                }
                if (test.response.body.matches) {
                    test.response.body.matches.forEach(function (kvo) {
                        _this.assertionRunners.push(new ATLAssertion_1.CommonAssertions.BodyMatchesAssertion(_this.request, kvo.key, kvo.value));
                    });
                }
                if (test.response.headers) {
                    for (var h in test.response.headers) {
                        this.assertionRunners.push(new ATLAssertion_1.CommonAssertions.HeaderMatchesAssertion(this.request, h, test.response.headers[h]));
                    }
                }
                if (test.response.body.take) {
                    var take = test.response.body.take;
                    take.forEach(function (takenElement) {
                        _this.assertionRunners.push(new ATLAssertion_1.CommonAssertions.CopyBodyValueOperation(_this.request, takenElement.key, takenElement.value));
                    });
                }
                if (test.response.body.copyTo && test.response.body.copyTo instanceof Pointer_1.default) {
                    this.assertionRunners.push(new ATLAssertion_1.CommonAssertions.CopyBodyValueOperation(this.request, '*', test.response.body.copyTo));
                }
            }
        }
    };
    return SuiteRunner;
}(Runnable_1.Runnable));
exports.SuiteRunner = SuiteRunner;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SuiteRunner;
//# sourceMappingURL=SuiteRunner.js.map
"use strict";
// NODE
var util_1 = require('util');
// NPM
var _ = require('lodash');
// LOCAL
var ATLHelpers_1 = require('../lib/ATLHelpers');
var stringRepresentation = function (x) { return util_1.inspect(x, false, 30, true); };
function runSuite(suite) {
    var execFn = suite.suite.skip ? describe.skip : describe;
    if (suite.request) {
        var test_1 = suite.suite.test;
        execFn((test_1.description || (suite.suite.name)) + ' ' + suite.id, function () {
            this.bail(false);
            it(test_1.method.toUpperCase() + ' ' + test_1.uri + ' ' + suite.request.id, function (done) {
                this.timeout(test_1.timeout + 100);
                suite
                    .request
                    .then(function (response) {
                    done();
                })
                    .catch(function (err) {
                    done(err);
                });
            });
            suite.assertionRunners.forEach(function (x) {
                (test_1.suite.skip ? it.skip : it)(x.name + ' ' + x.id, function (done) {
                    this.timeout(test_1.timeout + 100);
                    x
                        .then(function (err) {
                        done();
                    })
                        .catch(function (err) {
                        done(err);
                    });
                });
            });
            it('Result', function (done) {
                this.timeout(test_1.timeout + 100);
                suite
                    .then(function (response) {
                    done();
                })
                    .catch(function (err) {
                    var response = _.get(test_1, "requester.superAgentResponse");
                    var body = _.get(test_1, "requester.superAgentResponse.body");
                    var url = _.get(test_1, "requester.url");
                    done(new Error("Test failed"
                        + (url ? "\nURL = " + stringRepresentation(url) : "")
                        + (response ? "\nRESPONSE = " + stringRepresentation(JSON.parse(JSON.stringify(response, null, 2))) : '')
                        + (body ? ("\nBODY = " + stringRepresentation(body)) : '')));
                });
            });
        });
        return suite
            .then(function (x) { return true; })
            .catch(function (x) { return false; });
    }
    var that = this;
    var flatProm = ATLHelpers_1.flatPromise();
    if (suite.suiteRunners && suite.suiteRunners.length) {
        execFn(suite.suite.name + ' ' + suite.id, function () {
            var results = [];
            for (var k in suite.suiteRunners) {
                results.push(runSuite(suite.suiteRunners[k]));
            }
            Promise.all(results.filter(function (x) { return !!x; }))
                .then(function (results) {
                flatProm.resolver(results.every(function (result) { return result == true; }));
            })
                .catch(function (results) {
                flatProm.resolver(false);
            });
        });
    }
    return flatProm.promise;
}
function registerMochaSuites(runner, bat) {
    describe(runner.atl.options.file, function () {
        runner.suiteRunners.map(runSuite);
        if (bat.RAMLCoverage && bat.atl.raml) {
            describe("RAML Coverage", function () {
                if (bat.atl.options.raml.coverage) {
                    bat.RAMLCoverage.coverageElements.forEach(function (x) {
                        injectMochaCoverageTests(x.resourceAssertion);
                    });
                }
                runner.thenOrCatch().then(function (r) {
                    bat.RAMLCoverage.coverageElements.forEach(function (item) { return item.run(); });
                    Promise.all(bat
                        .RAMLCoverage
                        .coverageElements
                        .map(function (x) { return x.getCoverage(); }));
                });
            });
        }
    });
}
exports.registerMochaSuites = registerMochaSuites;
var walkCoverageAssetion = function (assertion, level) {
    if (assertion.validationFn) {
        it(assertion.name, function (done) {
            assertion.promise.promise
                .then(function () { return done(); })
                .catch(done);
        });
    }
    if (assertion.innerAssertions.length) {
        describe(assertion.name, function () {
            this.bail(false);
            assertion.innerAssertions.forEach(function (x) { return walkCoverageAssetion(x, level + 1); });
        });
    }
};
function injectMochaCoverageTests(x) {
    x && walkCoverageAssetion(x, 0);
}
//# sourceMappingURL=mocha.js.map
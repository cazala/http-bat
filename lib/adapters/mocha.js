"use strict";
// LOCAL
var ATLHelpers_1 = require('../ATLHelpers');
function runSuite(suite) {
    var execFn = suite.skip ? describe.skip : describe;
    if (suite.test) {
        var test_1 = suite.test;
        execFn(test_1.description || (suite.name), function () {
            it(test_1.method.toUpperCase() + ' ' + test_1.uri, function (done) {
                this.timeout(test_1.timeout + 100);
                test_1
                    .requester
                    .promise
                    .then(function (response) {
                    done();
                })
                    .catch(function (err) {
                    done(err);
                });
            });
            test_1.assertions.forEach(function (x) {
                (x.skip ? it.skip : it)(x.name, function (done) {
                    this.timeout(test_1.timeout + 100);
                    x.promise
                        .then(function (err) {
                        if (err) {
                            done(err);
                        }
                        else
                            done();
                    })
                        .catch(function (err) {
                        done(err);
                    });
                });
            });
            it('Result', function (done) {
                this.timeout(test_1.timeout + 100);
                test_1
                    .promise
                    .then(function (response) {
                    done();
                })
                    .catch(function (err) {
                    done(new Error("Test failed"
                        + "\nREQUEST = " + JSON.stringify(test_1.requester.superAgentRequest, null, 2)
                        + "\nRESPONSE = " + JSON.stringify(test_1.requester.superAgentResponse, null, 2)));
                });
            });
        });
        return test_1.promise
            .then(function (x) { return true; })
            .catch(function (x) { return false; });
    }
    var that = this;
    var flatProm = ATLHelpers_1.flatPromise();
    if (suite.suites && Object.keys(suite.suites).length) {
        execFn(suite.name, function () {
            var results = [];
            for (var k in suite.suites) {
                results.push(runSuite(suite.suites[k]));
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
function registerMochaSuites(bat) {
    var allSuites = [];
    describe(bat.file, function () {
        for (var suiteName in bat.atl.suites) {
            allSuites.push(runSuite(bat.atl.suites[suiteName]));
        }
        if (bat.RAMLCoverage && bat.atl.raml) {
            describe("RAML Coverage", function () {
                if (bat.atl.options.raml.coverage) {
                    bat.RAMLCoverage.coverageElements.forEach(function (x) {
                        injectMochaCoverageTests(x.resourceAssertion);
                    });
                }
                Promise.all(allSuites).then(function (r) {
                    bat.RAMLCoverage.coverageElements.forEach(function (item) { return item.run(); });
                    Promise.all(bat
                        .RAMLCoverage
                        .coverageElements
                        .map(function (x) { return x.getCoverage(); })); /*.then(x => {
                      let total = x.reduce((prev, actual) => {
                        prev.errored += actual.errored;
                        prev.total += actual.total;
                        prev.notCovered += actual.notCovered;
                        return prev;
                      }, { total: 0, errored: 0, notCovered: 0 });
                      console.log('RAMLCoverage: ' + bat.file, inspect(total, false, 2, true));
                    });
                          */
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
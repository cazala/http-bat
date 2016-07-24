"use strict";
// NODE
const util_1 = require('util');
// LOCAL
const ATLHelpers_1 = require('../lib/ATLHelpers');
const stringRepresentation = (x) => util_1.inspect(x, false, 30, true);
function runSuite(suite) {
    let execFn = suite.skip ? describe.skip : describe;
    if (suite.test) {
        let test = suite.test;
        execFn(test.description || (suite.name), function () {
            it(test.method.toUpperCase() + ' ' + test.uri, function (done) {
                this.timeout(test.timeout + 100);
                test
                    .requester
                    .promise
                    .then(response => {
                    done();
                })
                    .catch(err => {
                    done(err);
                });
            });
            test.assertions.forEach(x => {
                (x.skip ? it.skip : it)(x.name, function (done) {
                    this.timeout(test.timeout + 100);
                    x.promise
                        .then(err => {
                        if (err) {
                            done(err);
                        }
                        else
                            done();
                    })
                        .catch(err => {
                        done(err);
                    });
                });
            });
            it('Result', function (done) {
                this.timeout(test.timeout + 100);
                test
                    .promise
                    .then(response => {
                    done();
                })
                    .catch(err => {
                    done(new Error("Test failed"
                        + "\nURL = " + stringRepresentation(test.requester.url)
                        + "\nRESPONSE = " + JSON.stringify(test.requester.superAgentResponse, null, 2)
                        + "\BODY = " + stringRepresentation(test.requester.superAgentResponse.body)));
                });
            });
        });
        return test.promise
            .then(x => true)
            .catch(x => false);
    }
    let that = this;
    let flatProm = ATLHelpers_1.flatPromise();
    if (suite.suites && Object.keys(suite.suites).length) {
        execFn(suite.name, function () {
            let results = [];
            for (let k in suite.suites) {
                results.push(runSuite(suite.suites[k]));
            }
            Promise.all(results.filter(x => !!x))
                .then(results => {
                flatProm.resolver(results.every(result => result == true));
            })
                .catch(results => {
                flatProm.resolver(false);
            });
        });
    }
    return flatProm.promise;
}
function registerMochaSuites(bat) {
    let allSuites = [];
    describe(bat.file, function () {
        for (let suiteName in bat.atl.suites) {
            allSuites.push(runSuite(bat.atl.suites[suiteName]));
        }
        if (bat.RAMLCoverage && bat.atl.raml) {
            describe("RAML Coverage", () => {
                if (bat.atl.options.raml.coverage) {
                    bat.RAMLCoverage.coverageElements.forEach(x => {
                        injectMochaCoverageTests(x.resourceAssertion);
                    });
                }
                Promise.all(allSuites).then(r => {
                    bat.RAMLCoverage.coverageElements.forEach(item => item.run());
                    Promise.all(bat
                        .RAMLCoverage
                        .coverageElements
                        .map(x => x.getCoverage())); /*.then(x => {
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
const walkCoverageAssetion = (assertion, level) => {
    if (assertion.validationFn) {
        it(assertion.name, function (done) {
            assertion.promise.promise
                .then(() => done())
                .catch(done);
        });
    }
    if (assertion.innerAssertions.length) {
        describe(assertion.name, function () {
            this.bail(false);
            assertion.innerAssertions.forEach(x => walkCoverageAssetion(x, level + 1));
        });
    }
};
function injectMochaCoverageTests(x) {
    x && walkCoverageAssetion(x, 0);
}
//# sourceMappingURL=mocha.js.map
/// <reference path="typings/index.d.ts" />
"use strict";
var app = require('./server');
var fs = require('fs');
var dist_1 = require('../dist');
var util = require('util');
var registerMochaSuites = require('../dist/adapters/mocha');
var _ = require('lodash');
var Runnable_1 = require('../dist/lib/Runnable');
var SuiteRunner_1 = require('../dist/lib/Runners/SuiteRunner');
var ATLAssertion_1 = require('../dist/lib/ATLAssertion');
var ATLRequest_1 = require('../dist/lib/ATLRequest');
var instance = new dist_1.Bat({
    file: __dirname + '/valid-specs/local.spec.yml'
});
describe('Sanity', function () {
    it('must load a raml', function () {
        if (!instance.atl.raml)
            throw new Error("No raml found");
    });
    it('must have a default FSResolver', function () {
        if (!instance.atl.options.FSResolver)
            throw new Error("No FSResolver found");
    });
    it('include must work', function () {
        var readed = dist_1.ATLHelpers.cloneObjectUsingPointers(_.get(instance.atl.options.variables, 'json'), instance.atl.options.variables, instance.atl.options.FSResolver);
        if (!readed || !readed.json)
            throw new Error("Readed: " + JSON.stringify(readed));
    });
    it('pointer include must work', function () {
        var pointer = new dist_1.ATLHelpers.pointerLib.Pointer('oauth.test');
        var readed = dist_1.ATLHelpers.cloneObjectUsingPointers(pointer, instance.atl.options.variables, instance.atl.options.FSResolver);
        if (!readed || !readed.json)
            throw new Error("Readed: " + JSON.stringify(readed));
    });
});
describe('HTTP CALLS', function () {
    var promiseColor = function (prom) {
        var res = util.inspect(prom);
        if (res == 'Promise { <pending> }') {
            return "\x1b[35m";
        }
        if (res.indexOf('Promise { <rejec') == 0) {
            var isCanceled = res.indexOf('CANCELED') != -1;
            return isCanceled ? "\x1b[34m" : "\x1b[31m";
        }
        return "\x1b[32m";
    };
    var colorByInstance = function (prom) {
        if (prom instanceof SuiteRunner_1.default) {
            return "\x1b[35m";
        }
        // if (prom instanceof TestRunner) {
        //   return "\x1b[31m";
        // }
        if (prom instanceof ATLAssertion_1.ATLResponseAssertion) {
            return "\x1b[34m";
        }
        return "\x1b[32m";
    };
    var printPromise = function (prom) {
        var color = promiseColor(prom);
        var res = util.inspect(prom);
        if (res == 'Promise { <pending> }') {
            return promiseColor(prom) + "PENDING \x1b[0m";
        }
        if (res.indexOf('Promise { <rejec') == 0) {
            var isCanceled = res.indexOf('CANCELED') != -1;
            return promiseColor(prom) + (isCanceled ? 'CANCELED' : 'REJECTED') + " \x1b[0m";
        }
        return promiseColor(prom) + "RESOLVED \x1b[0m";
    };
    var printPromises = function (suite, p) {
        p += promiseColor(suite.innerPromise);
        console.log(p);
        console.log(p + suite.name, printPromise(suite.innerPromise) + (suite.suite.skip ? ' [SKIPPED]' : ''));
        p += "┃\x1b[0m";
        if (suite.request) {
            var head = p + '  ' + promiseColor(suite.innerPromise) + '┃\x1b[0m';
            console.log(p + promiseColor(suite.innerPromise) + '  TEST: ' + (suite.suite.skip ? ' [SKIPPED]' : '') + ' ' + suite.id, suite.innerPromise);
            console.log(head + promiseColor(suite.request.innerPromise) + '  REQUEST:', printPromise(suite.request.innerPromise), ' ' + suite.request.id);
            var head1_1 = head + '  ' + promiseColor(suite.request.innerPromise) + '┃\x1b[0m';
            suite.assertionRunners.forEach(function (ass) {
                console.log(head1_1 + '  ' + printPromise(ass.innerPromise) + ' ' + ass.name + ' ' + ass.id);
            });
            suite.assertionRunners.length && console.log(head1_1 + '____');
            suite.assertionRunners.length && console.log(head + '____');
        }
        if (suite.suiteRunners) {
            suite.suiteRunners.forEach(function (x) {
                printPromises(x, p + '  ');
            });
        }
        console.log(p + '____');
    };
    var printedDeps = [], printedDepsDot = [];
    function printRunnableDependencies(runnable, spaces) {
        console.log(spaces + colorByInstance(runnable) + (runnable.name || '') + ' \x1b[0m' + runnable.id + (runnable.dependsOn.length ? ': ' : ''));
        if (printedDeps.indexOf(runnable.id) == -1) {
            printedDeps.push(runnable.id);
            runnable.dependsOn.forEach(function (run) {
                if (run.runnable instanceof Runnable_1.default) {
                    printRunnableDependencies(run.runnable, spaces + '  ');
                }
            });
        }
    }
    function dotId(w) {
        return w.id.replace('-', '');
    }
    var dotFile;
    function wl(str) {
        dotFile && dotFile.write(str + '\n');
    }
    var suiteHandler = function (suite) {
        describe(suite.suite.name + (" (" + suite.id + ")"), function () {
            it(suite.suite.async ? 'is ASYNC' : 'is SYNC');
            describe('depends on', function () {
                suite.dependsOn.forEach(function (dep) {
                    it(dep.runnable.name, function (done) {
                        dep.runnable.then(function () { done(); });
                        dep.runnable.catch(function (err) { done(err); });
                    });
                });
            });
            suite.suiteRunners && suite.suiteRunners.forEach(suiteHandler);
            suite.suite.skip && it('is skipped');
            if (suite.request) {
                it('is a test', function (done) {
                    suite.request.then(function () { done(); });
                    suite.request.catch(function (err) { done(err); });
                });
            }
            it('must pass', function (done) {
                suite.then(function () { done(); });
                suite.catch(function (err) { done(err); });
            });
        });
    };
    var runner = instance.createRunner(app);
    /*it('all TestRunners.request must be a dependency of the parent SuiteRunner', () => {
      runner.allTestRunners().forEach(x => {
        if (!x.suiteRunner.dependsOn.some(r => r.runnable == x.request))
          throw new Error();
      });
    });*/
    it('all TestRunners must depend on all assertions', function () {
        runner.allTestRunners().forEach(function (x) {
            x.assertionRunners.forEach(function (assertion) {
                if (!x.dependsOn.some(function (r) { return r.runnable == assertion; }))
                    throw new Error();
            });
        });
    });
    it('all TestRunners must depend on his own request', function () {
        runner.allTestRunners().forEach(function (x) {
            if (!x.dependsOn.some(function (r) { return r.runnable == x.request; }))
                throw new Error();
        });
    });
    it('all TestRunners.assertionRunners[*] must depends on the request', function () {
        runner.allTestRunners().forEach(function (x) {
            x.assertionRunners.forEach(function (assertion) {
                if (!assertion.dependsOn.some(function (r) { return r.runnable == x.request; }))
                    throw new Error();
            });
        });
    });
    it('within a Sequence, all tests starters must depend on the previous', function () {
        var sequences = runner.allTestRunners();
        sequences.map(function (x) { return x.parent; }).filter(function (x) { return !!x; }).forEach(function (seq) {
            var lastTest = null;
            seq.suiteRunners.filter(function (x) { return !!x.request; }).forEach(function (test) {
                if (lastTest == null) {
                    lastTest = test;
                    return;
                }
                if (!test.starter.dependsOn.some(function (x) { return x.runnable == lastTest; }))
                    throw new Error();
                lastTest = test;
            });
        });
    });
    printRunnableDependencies(runner, '');
    var printAll = function () {
        runner.suiteRunners.forEach(function (x) { return printPromises(x, '  '); });
    };
    // printAll();
    registerMochaSuites.registerMochaSuites(runner, instance);
    runner.suiteRunners.forEach(suiteHandler);
    /*runner.allTestRunners().forEach(sr => {
      sr.thenOrCatch().then(x => {
        printPromises(sr, x.failed ? 'X ' : '✓ ');
      });
    });*/
    function dotRepresentation(runnable, spaces) {
        if (printedDepsDot.indexOf(runnable.id) == -1) {
            printedDepsDot.push(runnable.id);
            wl(spaces + dotId(runnable) + ' [label=' + JSON.stringify(runnable.name || runnable.id) + ((runnable instanceof ATLRequest_1.default) ? ',shape=polygon,sides=4,skew=.4' : '') + '];');
            runnable.dependsOn.forEach(function (run) {
                if (run.runnable instanceof Runnable_1.default) {
                    dotRepresentation(run.runnable, spaces + '  ');
                    link(run.runnable, runnable);
                }
            });
        }
    }
    function printSequence(seq) {
        if (printedDepsDot.indexOf(seq.id) == -1) {
            wl("  subgraph cluster" + dotId(seq) + " {");
            wl('  rankdir=LR;');
            wl("  label = " + JSON.stringify(seq.name || seq.id) + ";");
            printedDepsDot.push(seq.id);
            printedDepsDot.push(seq.starter.id);
            wl("    " + dotId(seq) + " [shape=circle][label=\"END\"];");
            wl("    " + dotId(seq.starter) + " [shape=circle][label=\"START\"];");
            printedDepsDot.push(seq.starter.id);
            seq.starter.dependsOn.forEach(function (run) {
                link(run.runnable, seq.starter);
            });
            seq.suiteRunners.forEach(function (runnable) {
                if (runnable.suiteRunners) {
                    printSequence(runnable);
                }
                else {
                    wl("  subgraph cluster" + dotId(runnable) + " {");
                    wl('  rankdir=LR;');
                    wl('  color=blue;');
                    wl("  label = " + JSON.stringify(runnable.name || runnable.id) + ";");
                    wl("    " + dotId(runnable.starter) + " [shape=circle][label=\"START\"];");
                    printedDepsDot.push(runnable.starter.id);
                    runnable.starter.dependsOn.forEach(function (run) {
                        link(run.runnable, runnable.starter);
                    });
                    dotRepresentation(runnable, '');
                    wl("    " + dotId(runnable) + " [shape=circle][label=\"END\"];");
                    wl("  }");
                }
            });
            seq.dependsOn.forEach(function (run) {
                if (run.runnable instanceof Runnable_1.default) {
                    dotRepresentation(run.runnable, '');
                    link(run.runnable, seq);
                }
            });
            wl("  }");
        }
    }
    try {
        fs.unlinkSync(__dirname + '/test.dot');
    }
    catch (e) { }
    dotFile = fs.createWriteStream(__dirname + '/test.dot');
    var sequences = [];
    wl('digraph dotGraph {');
    wl('  rankdir=TD;\ncompound=true;');
    runner.allTestRunners().forEach(function (runnable) {
        if (-1 == sequences.indexOf(runnable.parent)) {
            sequences.push(runnable.parent);
        }
    });
    var links = {};
    function link(a, b) {
        if (a instanceof SuiteRunner_1.default && a.suiteRunners) {
            links[dotId(a) + ' -> ' + dotId(b) + ' [ltail=cluster' + dotId(a) + '];'] = true;
        }
        else {
            links[dotId(a) + ' -> ' + dotId(b)] = true;
        }
    }
    sequences.forEach(printSequence);
    runner.suiteRunners.filter(function (x) { return sequences.indexOf(x) == -1; }).forEach(printSequence);
    Object.keys(links).forEach(function (k) { return wl(k); });
    wl('}');
    dotFile.end();
    runner.run();
    runner
        .then(function (error) {
        console.error(error);
        printAll();
        instance.RAMLCoverage && instance.RAMLCoverage.writeCoverage(__dirname + '/../coverage/lcov.info');
    })
        .catch(function (error) {
        console.error(error);
        printAll();
        instance.RAMLCoverage && instance.RAMLCoverage.writeCoverage(__dirname + '/../coverage/lcov.info');
    });
});
//# sourceMappingURL=5.test-local.spec.js.map
/// <reference path="typings/index.d.ts" />

const app = require('./server');

import fs = require('fs');
import { Bat, ATLHelpers } from '../dist';
import util = require('util');
import registerMochaSuites = require('../dist/adapters/mocha');
import _ = require('lodash');
import ATLTest from '../dist/lib/ATLTest';
import ATLSuite from '../dist/lib/ATLSuite';

import Runnable from '../dist/lib/Runnable';

import SuiteRunner from '../dist/lib/Runners/SuiteRunner';
import { ATLResponseAssertion } from '../dist/lib/ATLAssertion';
import ATLRequest from '../dist/lib/ATLRequest';

declare var describe, it;


const instance = new Bat({
  file: __dirname + '/valid-specs/local.spec.yml'
});

describe('Sanity', function () {
  it('must load a raml', () => {
    if (!instance.atl.raml)
      throw new Error("No raml found");
  });

  it('must have a default FSResolver', () => {
    if (!instance.atl.options.FSResolver)
      throw new Error("No FSResolver found");
  });

  it('include must work', () => {
    let readed = ATLHelpers.cloneObjectUsingPointers(_.get(instance.atl.options.variables, 'json'), instance.atl.options.variables, instance.atl.options.FSResolver);

    if (!readed || !readed.json)
      throw new Error("Readed: " + JSON.stringify(readed));
  });


  it('pointer include must work', () => {
    let pointer = new ATLHelpers.pointerLib.Pointer('oauth.test');

    let readed = ATLHelpers.cloneObjectUsingPointers(pointer, instance.atl.options.variables, instance.atl.options.FSResolver);

    if (!readed || !readed.json)
      throw new Error("Readed: " + JSON.stringify(readed));
  });
});


describe('HTTP CALLS', function () {
  const promiseColor = prom => {
    let res = util.inspect(prom);

    if (res == 'Promise { <pending> }') {
      return "\x1b[35m";
    }
    if (res.indexOf('Promise { <rejec') == 0) {

      let isCanceled = res.indexOf('CANCELED') != -1;

      return isCanceled ? "\x1b[34m" : "\x1b[31m";
    }

    return "\x1b[32m";
  };


  const colorByInstance = (prom: Runnable<any>) => {
    if (prom instanceof SuiteRunner) {
      return "\x1b[35m";
    }

    // if (prom instanceof TestRunner) {
    //   return "\x1b[31m";
    // }

    if (prom instanceof ATLResponseAssertion) {
      return "\x1b[34m";
    }

    return "\x1b[32m";
  };


  const printPromise = prom => {
    let color = promiseColor(prom);
    let res = util.inspect(prom);

    if (res == 'Promise { <pending> }') {
      return promiseColor(prom) + "PENDING \x1b[0m";
    }

    if (res.indexOf('Promise { <rejec') == 0) {

      let isCanceled = res.indexOf('CANCELED') != -1;

      return promiseColor(prom) + (isCanceled ? 'CANCELED' : 'REJECTED') + " \x1b[0m";
    }

    return promiseColor(prom) + "RESOLVED \x1b[0m";
  };

  const printPromises = (suite: SuiteRunner, p: string) => {

    p += promiseColor(suite.innerPromise);

    console.log(p);
    console.log(p + suite.name, printPromise(suite.innerPromise) + (suite.suite.skip ? ' [SKIPPED]' : ''));

    p += "┃\x1b[0m";

    if (suite.request) {
      let head = p + '  ' + promiseColor(suite.innerPromise) + '┃\x1b[0m';

      console.log(p + promiseColor(suite.innerPromise) + '  TEST: ' + (suite.suite.skip ? ' [SKIPPED]' : '') + ' ' + suite.id, suite.innerPromise);
      console.log(head + promiseColor(suite.request.innerPromise) + '  REQUEST:', printPromise(suite.request.innerPromise), ' ' + suite.request.id);

      let head1 = head + '  ' + promiseColor(suite.request.innerPromise) + '┃\x1b[0m';
      suite.assertionRunners.forEach(ass => {
        console.log(head1 + '  ' + printPromise(ass.innerPromise) + ' ' + ass.name + ' ' + ass.id);
      });
      suite.assertionRunners.length && console.log(head1 + '____');
      suite.assertionRunners.length && console.log(head + '____');

    }

    if (suite.suiteRunners) {
      suite.suiteRunners.forEach(x => {
        printPromises(x, p + '  ');
      });
    }

    console.log(p + '____');
  };


  let printedDeps = [], printedDepsDot = []

  function printRunnableDependencies(runnable: Runnable<any>, spaces) {
    console.log(spaces + colorByInstance(runnable) + (runnable.name || '') + ' \x1b[0m' + runnable.id + (runnable.dependsOn.length ? ': ' : ''));

    if (printedDeps.indexOf(runnable.id) == -1) {
      printedDeps.push(runnable.id);
      runnable.dependsOn.forEach(run => {
        if (run.runnable instanceof Runnable) {
          printRunnableDependencies(run.runnable as any, spaces + '  ');
        }
      });

    }
  }

  function dotId(w: Runnable<any>) {

    return w.id.replace('-', '');
  }

  let dotFile: fs.WriteStream;

  function wl(str: string) {
    dotFile && dotFile.write(str + '\n');
  }




  const suiteHandler = (suite: SuiteRunner) => {
    describe(suite.suite.name + ` (${suite.id})`, function () {
      it(suite.suite.async ? 'is ASYNC' : 'is SYNC');

      describe('depends on', () => {
        suite.dependsOn.forEach((dep: any) => {
          it(dep.runnable.name, (done) => {
            dep.runnable.then(() => { done(); });
            dep.runnable.catch(err => { done(err); });
          });
        });
      });

      suite.suiteRunners && suite.suiteRunners.forEach(suiteHandler);

      suite.suite.skip && it('is skipped');

      if (suite.request) {
        it('is a test', function (done) {
          suite.request.then(() => { done(); });
          suite.request.catch(err => { done(err); });
        });
      }

      it('must pass', function (done) {
        suite.then(() => { done(); });
        suite.catch(err => { done(err); });
      });
    });
  };

  let runner = instance.createRunner(app);

  /*it('all TestRunners.request must be a dependency of the parent SuiteRunner', () => {
    runner.allTestRunners().forEach(x => {
      if (!x.suiteRunner.dependsOn.some(r => r.runnable == x.request))
        throw new Error();
    });
  });*/

  it('all TestRunners must depend on all assertions', () => {
    runner.allTestRunners().forEach(x => {
      x.assertionRunners.forEach(assertion => {
        if (!x.dependsOn.some(r => r.runnable == assertion))
          throw new Error();
      });
    });
  });

  it('all TestRunners must depend on his own request', () => {
    runner.allTestRunners().forEach(x => {
      if (!x.dependsOn.some(r => r.runnable == x.request))
        throw new Error();
    });
  });

  it('all TestRunners.assertionRunners[*] must depends on the request', () => {
    runner.allTestRunners().forEach(x => {
      x.assertionRunners.forEach(assertion => {
        if (!assertion.dependsOn.some(r => r.runnable == x.request))
          throw new Error();
      });
    });
  });

  it('within a Sequence, all tests starters must depend on the previous', () => {
    let sequences = runner.allTestRunners();
    sequences.map(x => x.parent).filter(x => !!x).forEach(seq => {
      let lastTest = null;
      seq.suiteRunners.filter(x => !!x.request).forEach(test => {
        if (lastTest == null) {
          lastTest = test;
          return;
        }

        if (!test.starter.dependsOn.some(x => x.runnable == lastTest))
          throw new Error();

        lastTest = test;
      });
    });
  });

  printRunnableDependencies(runner, '');

  const printAll = () => {
    runner.suiteRunners.forEach(x => printPromises(x, '  '));
  };

  // printAll();

  registerMochaSuites.registerMochaSuites(runner, instance);

  runner.suiteRunners.forEach(suiteHandler);

  /*runner.allTestRunners().forEach(sr => {
    sr.thenOrCatch().then(x => {
      printPromises(sr, x.failed ? 'X ' : '✓ ');
    });
  });*/






  function dotRepresentation(runnable: Runnable<any> | SuiteRunner, spaces?) {
    if (printedDepsDot.indexOf(runnable.id) == -1) {
      printedDepsDot.push(runnable.id);

      wl(spaces + dotId(runnable) + ' [label=' + JSON.stringify(runnable.name || runnable.id) + ((runnable instanceof ATLRequest) ? ',shape=polygon,sides=4,skew=.4' : '') + '];');


      runnable.dependsOn.forEach(run => {
        if (run.runnable instanceof Runnable) {
          dotRepresentation(run.runnable, spaces + '  ');
          link(run.runnable, runnable);
        }
      });
    }
  }

  function printSequence(seq: SuiteRunner) {
    if (printedDepsDot.indexOf(seq.id) == -1) {
      wl(`  subgraph cluster${dotId(seq)} {`);
      wl('  rankdir=LR;');
      wl(`  label = ${JSON.stringify(seq.name || seq.id)};`);

      printedDepsDot.push(seq.id);
      printedDepsDot.push(seq.starter.id);

      wl(`    ${dotId(seq)} [shape=circle][label="END"];`);
      wl(`    ${dotId(seq.starter)} [shape=circle][label="START"];`);
      printedDepsDot.push(seq.starter.id);

      seq.starter.dependsOn.forEach(run => {
        link(run.runnable, seq.starter);
      });

      seq.suiteRunners.forEach(runnable => {
        if (runnable.suiteRunners) {
          printSequence(runnable);
        } else {
          wl(`  subgraph cluster${dotId(runnable)} {`);
          wl('  rankdir=LR;');
          wl('  color=blue;');
          wl(`  label = ${JSON.stringify(runnable.name || runnable.id)};`);


          wl(`    ${dotId(runnable.starter)} [shape=circle][label="START"];`);

          printedDepsDot.push(runnable.starter.id);

          runnable.starter.dependsOn.forEach(run => {
            link(run.runnable, runnable.starter);
          });

          dotRepresentation(runnable, '');

          wl(`    ${dotId(runnable)} [shape=circle][label="END"];`);

          wl(`  }`);
        }
      });

      seq.dependsOn.forEach(run => {
        if (run.runnable instanceof Runnable) {
          dotRepresentation(run.runnable, '');
          link(run.runnable, seq);
        }
      });

      wl(`  }`);
    }
  }

  try {
    fs.unlinkSync(__dirname + '/test.dot');
  } catch (e) { }

  dotFile = fs.createWriteStream(__dirname + '/test.dot');

  let sequences: SuiteRunner[] = [];

  wl('digraph dotGraph {');
  wl('  rankdir=TD;\ncompound=true;');

  runner.allTestRunners().forEach(runnable => {
    if (-1 == sequences.indexOf(runnable.parent)) {
      sequences.push(runnable.parent);
    }
  });


  let links = {};
  function link(a: Runnable<any>, b: Runnable<any>) {
    if (a instanceof SuiteRunner && a.suiteRunners) {
      links[dotId(a) + ' -> ' + dotId(b) + ' [ltail=cluster' + dotId(a) + '];'] = true;
    } else {
      links[dotId(a) + ' -> ' + dotId(b)] = true;
    }
  }

  sequences.forEach(printSequence);
  runner.suiteRunners.filter(x => sequences.indexOf(x) == -1).forEach(printSequence)

  Object.keys(links).forEach(k => wl(k));


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
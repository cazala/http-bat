// NODE
import { inspect } from 'util';


// NPM
import _ = require('lodash');

// LOCAL
import { flatPromise } from '../lib/ATLHelpers';
import { ATL } from '../lib/ATL';
import { Bat } from '../index';
import { CoverageResource, CoverageAssertion } from '../lib/Coverage';


import ATLTest from '../lib/ATLTest';
import ATLSuite from '../lib/ATLSuite';

import SuiteRunner from '../lib/Runners/SuiteRunner';
import ATLRunner from '../lib/Runners/ATLRunner';


declare var describe, it;

const stringRepresentation = (x) => inspect(x, false, 30, true);

function runSuite(suite: SuiteRunner): Promise<boolean> {
  let execFn = suite.suite.skip ? describe.skip : describe;

  if (suite.request) {
    let test = suite.suite.test;

    execFn((test.description || (suite.suite.name)) + ' ' + suite.id, function () {
      this.bail(false);
      it(test.method.toUpperCase() + ' ' + test.uri + ' ' + suite.request.id, function (done) {
        this.timeout(test.timeout + 100);
        suite
          .request
          .then(response => {
            done();
          })
          .catch(err => {
            done(err);
          });
      });

      suite.assertionRunners.forEach(x => {
        (test.suite.skip ? it.skip : it)(x.name + ' ' + x.id, function (done) {
          this.timeout(test.timeout + 100);
          x
            .then(err => {
              done();
            })
            .catch(err => {
              done(err);
            });
        });
      });

      it('Result', function (done) {
        this.timeout(test.timeout + 100);
        suite
          .then(response => {
            done();
          })
          .catch(err => {
            let response: any = _.get(test, "requester.superAgentResponse");
            let body = _.get(test, "requester.superAgentResponse.body");
            let url = _.get(test, "requester.url");

            done(new Error("Test failed"
              + (url ? "\nURL = " + stringRepresentation(url) : "")
              + (response ? "\nRESPONSE = " + stringRepresentation(JSON.parse(JSON.stringify(response, null, 2))) : '')
              + (body ? ("\nBODY = " + stringRepresentation(body)) : '')
            ));
          });
      });
    });

    return suite
      .then(x => true)
      .catch(x => false);
  }

  let that = this;

  let flatProm = flatPromise();

  if (suite.suiteRunners && suite.suiteRunners.length) {
    execFn(suite.suite.name + ' ' + suite.id, function () {
      let results = [];

      for (let k in suite.suiteRunners) {
        results.push(runSuite(suite.suiteRunners[k]));
      }

      Promise.all(
        results.filter(x => !!x)
      )
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



export function registerMochaSuites(runner: ATLRunner, bat: Bat) {
  describe(runner.atl.options.file, function () {
    runner.suiteRunners.map(runSuite);

    if (bat.RAMLCoverage && bat.atl.raml) {
      describe("RAML Coverage", function () {
        if (bat.atl.options.raml.coverage) {
          bat.RAMLCoverage.coverageElements.forEach(x => {
            injectMochaCoverageTests(x.resourceAssertion);
          });
        }

        runner.thenOrCatch().then(r => {
          bat.RAMLCoverage.coverageElements.forEach(item => item.run());
          Promise.all(
            bat
              .RAMLCoverage
              .coverageElements
              .map(x => x.getCoverage())
          );
        });
      });
    }
  });
}

const walkCoverageAssetion = (assertion: CoverageAssertion, level: number) => {
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

function injectMochaCoverageTests(x: CoverageAssertion) {
  x && walkCoverageAssetion(x, 0);
}
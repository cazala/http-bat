import ATLRequest from '../ATLRequest';
import ATLRunner from './ATLRunner';
import ATLSuite from '../ATLSuite';
import Pointer from '../Pointer';

import { flatPromise } from '../ATLHelpers';
import { Runnable, EDependencyKind } from '../Runnable';
import { CommonAssertions } from '../ATLAssertion';


export class SuiteRunner extends Runnable<boolean> {


  starter = new Runnable(() => Promise.resolve(true));

  suiteRunners: SuiteRunner[];
  request: ATLRequest;
  assertionRunners: Runnable<any>[] = [];

  constructor(public suite: ATLSuite, public ATLRunner: ATLRunner, public parent: SuiteRunner) {
    super(runnable => {
      let prom = flatPromise();

      let dependencies = [];

      if (this.request) {
        dependencies.push(this.request.innerPromise);
      }

      if (this.assertionRunners) {
        this.assertionRunners.forEach(x => {
          dependencies.push(x.innerPromise);
        });
      }

      if (this.suiteRunners) {
        this.suiteRunners.forEach(x => {
          dependencies.push(x.innerPromise);
        });
      }

      if (dependencies.length) {
        Promise.all(dependencies)
          .then(() => prom.resolver(true))
          .catch(err => prom.rejecter(err));
      } else {
        prom.resolver(true);
      }

      return prom.promise;
    });

    this.name = this.suite.name
      + (this.suite.skip ? '\n[SKIPPED]' : '')
      + (this.suite.async ? '\n[ASYNC]' : '');

    if (this.suite.test) {
      if (!this.suite.skip) {
        this.request = new ATLRequest(this.suite.test, ATLRunner);
        this.request.addDependency(this.starter, EDependencyKind.Pass);
        this.generateTestAssertions();
        this.addDependency(this.request);
        this.assertionRunners.forEach(x => this.addDependency(x));
      } else {
        this.addDependency(this.starter);
      }
    }

    if (this.suite.suites) {
      this.suiteRunners = [];

      if (this.suite.skip) {
        this.addDependency(this.starter);
      } else {
        let previousSuiteRunner: SuiteRunner = null;

        this.suite.suites.forEach(suite => {
          if (suite != this.suite) {
            let suiteRunner = new SuiteRunner(suite, ATLRunner, this);
            this.suiteRunners.push(suiteRunner);

            if (previousSuiteRunner) {
              suiteRunner.starter.addDependency(previousSuiteRunner, previousSuiteRunner.suite.soft ? EDependencyKind.Pass : EDependencyKind.Both);
            }

            previousSuiteRunner = suiteRunner;
          }
        });

        if (this.suiteRunners.length) {
          this.suiteRunners[0].starter.addDependency(this.starter);
        }

        if (previousSuiteRunner) {
          this.addDependency(previousSuiteRunner);
        }
      }
    }
  }

  run(trigger?: boolean) {
    this.starter.run(trigger);

    if (this.request) {
      this.request.run();
    }

    if (this.assertionRunners) {
      this.assertionRunners.forEach(x => {
        x.run();
      });
    }

    super.run(trigger);
  }

  allTestRunners(): SuiteRunner[] {
    let out = [];

    if (this.suiteRunners) {
      this.suiteRunners.forEach(sr => {
        if (sr.request)
          out.push(sr);
        out = out.concat(sr.allTestRunners());
      });
    }

    return out;
  }


  generateTestAssertions() {
    let test = this.suite.test;

    if (test.suite.skip) return;

    if (test.response) {
      if (test.response.status) {
        this.assertionRunners.push(
          new CommonAssertions.StatusCodeAssertion(this.request, test.response.status)
        );
      }

      if (test.response.body) {
        if ('is' in test.response.body) {
          this.assertionRunners.push(
            new CommonAssertions.BodyEqualsAssertion(this.request, test.response.body.is)
          );
        }

        if (test.response.body.schema) {
          this.assertionRunners.push(
            new CommonAssertions.ValidateSchemaOperation(this.request, test.response.body.schema)
          );
        }

        if (test.response.body.matches) {
          test.response.body.matches.forEach(kvo => {
            this.assertionRunners.push(
              new CommonAssertions.BodyMatchesAssertion(this.request, kvo.key, kvo.value)
            );
          });
        }

        if (test.response.headers) {
          for (let h in test.response.headers) {
            this.assertionRunners.push(
              new CommonAssertions.HeaderMatchesAssertion(this.request, h, test.response.headers[h])
            );
          }
        }

        if (test.response.body.take) {
          let take = test.response.body.take;

          take.forEach(takenElement => {
            this.assertionRunners.push(
              new CommonAssertions.CopyBodyValueOperation(this.request, takenElement.key, takenElement.value)
            );
          });
        }

        if (test.response.body.copyTo && test.response.body.copyTo instanceof Pointer) {
          this.assertionRunners.push(
            new CommonAssertions.CopyBodyValueOperation(this.request, '*', test.response.body.copyTo)
          );
        }
      }
    }
  }
}

export default SuiteRunner;
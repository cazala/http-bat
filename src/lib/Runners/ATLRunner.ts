import ATL from '../ATL';
import { Runnable, EDependencyKind } from '../Runnable';
import SuiteRunner from './SuiteRunner';
import { SuperAgent, SuperAgentRequest, agent } from 'superagent';

export class ATLRunner extends Runnable<any> {

  suiteRunners: SuiteRunner[] = [];

  constructor(public atl: ATL, public agent: SuperAgent<SuperAgentRequest>) {
    super(runnable => {
      this.allTestRunners().forEach(x => x.run());

      return Promise.all(this.suiteRunners.map(x => x.innerPromise));
    });

    this.name = atl.options.file;

    for (let suiteName in atl.suites) {
      let suiteRunner = new SuiteRunner(atl.suites[suiteName], this, null);
      this.suiteRunners.push(suiteRunner);
      this.addDependency(suiteRunner);
    }

    this.configureAsyncDependencies();
  }

  configureAsyncDependencies() {
    let requiredSuites: SuiteRunner[] = [];

    let lastSyncSuite: SuiteRunner = null;

    this.suiteRunners.forEach(suiteRunner => {
      let suite = suiteRunner.suite;

      if (suite.async) {
        if (lastSyncSuite) {
          suiteRunner.starter.addDependency(lastSyncSuite, lastSyncSuite.suite.soft ? EDependencyKind.Both : EDependencyKind.Pass);
        }

        requiredSuites.push(suiteRunner);
      } else {
        requiredSuites.forEach(x =>
          suiteRunner.starter.addDependency(x, lastSyncSuite.suite.soft ? EDependencyKind.Both : EDependencyKind.Pass)
        );

        if (lastSyncSuite)
          suiteRunner.starter.addDependency(lastSyncSuite, lastSyncSuite.suite.soft ? EDependencyKind.Both : EDependencyKind.Pass);

        requiredSuites.length = 0;

        lastSyncSuite = suiteRunner;
      }
    });
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
}

export default ATLRunner;
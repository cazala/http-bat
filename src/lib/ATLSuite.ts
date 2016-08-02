import { ATL } from './ATL';
import { ATLTest } from './ATLTest';

export class ATLSuite {
  constructor(public name: string) {

  }

  suites: ATLSuite[] = null;
  async: boolean = false;
  descriptor: any = null;
  test: ATLTest = null;
  skip: boolean = false;
  atl: ATL;

  soft: boolean = false;
/*
  lastSuite: ATLSuite;
  firstSuite: ATLSuite;

  private flatPromise = flatPromise();

  promise = this.flatPromise.promise;

  run() {
    let mutex: Promise<any> = this.dependsOn.length ? Promise.all(this.dependsOn.map(x => x.promise)) : Promise.resolve();

    mutex.then(() => {

      if (this.test) {
        let innerRun = this.test.run();
        innerRun.then(() => this.flatPromise.resolver());
        innerRun.catch(err => this.reject(err));
      } else if (this.suites) {
        if (!this.suites.length) {
          this.flatPromise.resolver();
        } else {
          let innerMutex = Promise.all(this.suites.map(x => x.run()));
          innerMutex.then(() => this.flatPromise.resolver());
          innerMutex.catch(err => {
            this.reject(err);
          });
        }
      } else this.flatPromise.rejecter(new Error('Invalid suite. No tests and no sub suites found. ' + this.name));

    });

    mutex.catch(err => {
      this.reject(err);
    });

    return this.promise;
  }

  private reject(error) {
    if (this.skip && error instanceof Error) {
      this.flatPromise.resolver();
    } else {
      this.flatPromise.rejecter(error);
    }
    this.cancel(error);
  }

  cancel(err: Error) {
    this.flatPromise.rejecter(err);
    if (this.test) this.test.cancel(err);
    if (this.suites && this.suites.length) this.suites.forEach(x => x.cancel(err));
  }
  */
}

export default ATLSuite;
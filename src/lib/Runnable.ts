import { flatPromise } from './ATLHelpers';
import { EventEmitter } from 'events';
import { CanceledError } from './Exceptions';

export enum EDependencyKind {
  Pass,
  Fail,
  Both
}

export enum ERunningStatus {
  None,
  Waiting,
  Running,
  Ended,
  Canceled
}

let runnableCount = 0;

export const RunnableListener = new EventEmitter();

export const RunnableEvents = {
  RunningStatusChanged: 'running_status_changed',
  Resolved: 'resolved',
  Rejected: 'rejected',
  Canceling: 'canceling'
};

export class Runnable<T> {

  private _cancellationListeners: (() => void)[] = [];

  /**
  * Attaches callbacks for the resolution and/or rejection of the Promise.
  * @param onfulfilled The callback to execute when the Promise is resolved.
  * @returns A Promise for the completion of which ever callback is executed.
  */
  then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>): Promise<TResult>;
  then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>): Promise<TResult>;
  then() { return null; }
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch(runnable?: (reason: any) => T | PromiseLike<T>): Promise<T>;
  catch(runnable?: (reason: any) => void): Promise<T>;
  catch() { return null; }

  thenOrCatch(): Promise<{ runnable: Runnable<T>; failed: boolean; value?: T; error?: any; }> {
    let p = flatPromise();

    this.then(value => {
      p.resolver({
        runnable: this,
        failed: false,
        value
      });
    });

    this.catch(error => {
      p.resolver({
        runnable: this,
        failed: true,
        error
      });
    });

    return p.promise;
  }

  addDependency<T1>(runnable: Runnable<T1>, kind: EDependencyKind = EDependencyKind.Pass) {
    this.dependsOn.push({
      runnable,
      kind
    });
  }

  dependsOn: {
    runnable: Runnable<any>;
    kind: EDependencyKind;
  }[] = [];

  id = 'r-' + (runnableCount++).toString(16);
  name = this.id;

  protected _resolve;
  protected _reject;

  innerPromise = new Promise<T>((a, b) => {
    this._resolve = a;
    this._reject = b;
  });

  constructor(protected runner: (runnable: Runnable<T>) => Promise<T>) {
    this.catch = this.innerPromise.catch.bind(this.innerPromise);
    this.then = this.innerPromise.then.bind(this.innerPromise);

    this.then(value => {
      this.value = value;
      this.resolved = true;
      this.setRunningStatus(ERunningStatus.Ended);
      RunnableListener.emit(RunnableEvents.Resolved, this, value);
    });

    this.catch(error => {
      this.error = error;
      this.setRunningStatus(ERunningStatus.Ended);
      RunnableListener.emit(RunnableEvents.Rejected, this, error);
    });
  }

  value: T;
  error: Error;
  resolved = false;
  rejected = false;
  runningStatus: ERunningStatus = ERunningStatus.None;

  cancel() {
    RunnableListener.emit(RunnableEvents.Canceling, this);

    this._cancellationListeners.forEach(x => {
      try { x(); } catch (e) { }
    });

    try {
      this._reject(new CanceledError());
      this.rejected = true;
      this.setRunningStatus(ERunningStatus.Canceled);
    } catch (e) {

    }
  }

  onCancel(fn: () => void) {
    if (fn && typeof fn == "function")
      this._cancellationListeners.push(fn);
  }

  run(triggerExecution: boolean = true) {
    if (this.runningStatus != ERunningStatus.None) return;

    this.dependsOn = Object.seal(this.dependsOn);

    this.setRunningStatus(ERunningStatus.Waiting);

    let deps = this.dependsOn.map(x => {
      let prom = flatPromise();

      if (x.kind == EDependencyKind.Pass || x.kind == EDependencyKind.Both)
        x.runnable.then(x => prom.resolver());

      if (x.kind == EDependencyKind.Fail || x.kind == EDependencyKind.Both)
        x.runnable.catch(x => prom.resolver());

      if (x.kind == EDependencyKind.Pass)
        x.runnable.catch(e => prom.rejecter(e));

      if (x.kind == EDependencyKind.Fail)
        x.runnable.then(e => prom.rejecter(e));

      if (triggerExecution && (x.runnable instanceof Runnable))
        (x.runnable as Runnable<any>).run();

      return prom.promise;
    });

    let mutex = Promise.resolve();

    if (deps.length)
      mutex = Promise.all(deps) as any;

    mutex.then(() => {
      this.setRunningStatus(ERunningStatus.Running);

      try {
        let prom = this.runner(this);
        prom.then((value) => {
          this._resolve(value);
        });
        prom.catch(error => {
          this._reject(error);
        });
      } catch (e) {
        this._reject(e);
      }
    });

    mutex.catch(error => {
      this._reject();
    });
  }

  private setRunningStatus(status: ERunningStatus) {
    if (status > this.runningStatus) {
      this.runningStatus = status;
      RunnableListener.emit(RunnableEvents.RunningStatusChanged, this, this.runningStatus);
    }
  }
}

export default Runnable;
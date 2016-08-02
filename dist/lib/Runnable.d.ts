import { EventEmitter } from 'events';
export declare enum EDependencyKind {
    Pass = 0,
    Fail = 1,
    Both = 2,
}
export declare enum ERunningStatus {
    None = 0,
    Waiting = 1,
    Running = 2,
    Ended = 3,
    Canceled = 4,
}
export declare const RunnableListener: EventEmitter;
export declare const RunnableEvents: {
    RunningStatusChanged: string;
    Resolved: string;
    Rejected: string;
    Canceling: string;
};
export declare class Runnable<T> {
    protected runner: (runnable: Runnable<T>) => Promise<T>;
    private _cancellationListeners;
    /**
    * Attaches callbacks for the resolution and/or rejection of the Promise.
    * @param onfulfilled The callback to execute when the Promise is resolved.
    * @returns A Promise for the completion of which ever callback is executed.
    */
    then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>): Promise<TResult>;
    then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>): Promise<TResult>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(runnable?: (reason: any) => T | PromiseLike<T>): Promise<T>;
    catch(runnable?: (reason: any) => void): Promise<T>;
    thenOrCatch(): Promise<{
        runnable: Runnable<T>;
        failed: boolean;
        value?: T;
        error?: any;
    }>;
    addDependency<T1>(runnable: Runnable<T1>, kind?: EDependencyKind): void;
    dependsOn: {
        runnable: Runnable<any>;
        kind: EDependencyKind;
    }[];
    id: string;
    name: string;
    protected _resolve: any;
    protected _reject: any;
    innerPromise: Promise<T>;
    constructor(runner: (runnable: Runnable<T>) => Promise<T>);
    value: T;
    error: Error;
    resolved: boolean;
    rejected: boolean;
    runningStatus: ERunningStatus;
    cancel(): void;
    onCancel(fn: () => void): void;
    run(triggerExecution?: boolean): void;
    private setRunningStatus(status);
}
export default Runnable;

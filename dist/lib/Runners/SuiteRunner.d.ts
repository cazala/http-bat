import ATLRequest from '../ATLRequest';
import ATLRunner from './ATLRunner';
import ATLSuite from '../ATLSuite';
import { Runnable } from '../Runnable';
export declare class SuiteRunner extends Runnable<boolean> {
    suite: ATLSuite;
    ATLRunner: ATLRunner;
    parent: SuiteRunner;
    starter: Runnable<boolean>;
    suiteRunners: SuiteRunner[];
    request: ATLRequest;
    assertionRunners: Runnable<any>[];
    constructor(suite: ATLSuite, ATLRunner: ATLRunner, parent: SuiteRunner);
    run(trigger?: boolean): void;
    allTestRunners(): SuiteRunner[];
    generateTestAssertions(): void;
}
export default SuiteRunner;

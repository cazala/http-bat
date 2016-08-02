import ATL from '../ATL';
import { Runnable } from '../Runnable';
import SuiteRunner from './SuiteRunner';
import { SuperAgent, SuperAgentRequest } from 'superagent';
export declare class ATLRunner extends Runnable<any> {
    atl: ATL;
    agent: SuperAgent<SuperAgentRequest>;
    suiteRunners: SuiteRunner[];
    constructor(atl: ATL, agent: SuperAgent<SuperAgentRequest>);
    configureAsyncDependencies(): void;
    allTestRunners(): SuiteRunner[];
}
export default ATLRunner;

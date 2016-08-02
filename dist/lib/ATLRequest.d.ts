import url = require('url');
import { Response, SuperAgentRequest } from 'superagent';
import ATLTest from './ATLTest';
import Runnable from './Runnable';
import ATLRunner from './Runners/ATLRunner';
export declare class ATLRequest extends Runnable<Response> {
    test: ATLTest;
    ATLRunner: ATLRunner;
    urlObject: url.Url;
    url: string;
    superAgentRequest: SuperAgentRequest;
    constructor(test: ATLTest, ATLRunner: ATLRunner);
}
export default ATLRequest;

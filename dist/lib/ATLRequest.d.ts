import url = require('url');
import { Response, SuperAgentRequest } from 'superagent';
import { ATLTest } from './ATLHelpers';
export declare class ATLRequest {
    test: ATLTest;
    urlObject: url.Url;
    url: string;
    superAgentRequest: SuperAgentRequest;
    superAgentResponse: Response;
    private flatPromise;
    promise: Promise<Response>;
    constructor(test: ATLTest);
    run(): Promise<Response>;
    private _run();
    cancel(): void;
}

import { Response } from 'superagent';
import { Pointer } from './Pointer';
import { Runnable } from './Runnable';
import ATLRequest from './ATLRequest';
export declare class ATLError extends Error {
    expected: any;
    actual: any;
    assertion: ATLResponseAssertion;
    text: string;
    constructor(message: string);
    toString(): string;
    inspect(): string;
}
export declare abstract class ATLResponseAssertion extends Runnable<boolean> {
    request: ATLRequest;
    name: string;
    skip: boolean;
    constructor(request: ATLRequest);
    emitError(data: {
        actual?: any;
        expected?: any;
        message: string;
    }): void;
    abstract validate(response: Response): Promise<boolean> | void;
    protected getObjectValue(object: any): any;
}
export declare namespace CommonAssertions {
    class PromiseAssertion extends ATLResponseAssertion {
        evaluator: (res: Response) => Promise<boolean>;
        constructor(parent: ATLRequest, name: string, evaluator: (res: Response) => Promise<boolean>);
        validate(response: Response): Promise<any>;
    }
    class StatusCodeAssertion extends ATLResponseAssertion {
        statusCode: number;
        constructor(parent: ATLRequest, statusCode: number);
        validate(response: Response): void;
    }
    class BodyEqualsAssertion extends ATLResponseAssertion {
        bodyIs: any;
        constructor(parent: ATLRequest, bodyIs: any);
        validate(response: Response): void;
    }
    class BodyMatchesAssertion extends ATLResponseAssertion {
        key: string;
        value: any;
        constructor(parent: ATLRequest, key: string, value: any);
        validate(response: Response): void;
    }
    class CopyBodyValueOperation extends ATLResponseAssertion {
        key: string;
        keyValue: Pointer;
        constructor(parent: ATLRequest, key: string, keyValue: Pointer);
        validate(response: Response): void;
    }
    class ValidateSchemaOperation extends ATLResponseAssertion {
        schema: string;
        constructor(parent: ATLRequest, schema: string);
        validate(response: Response): void;
    }
    class HeaderMatchesAssertion extends ATLResponseAssertion {
        header: string;
        value: any;
        constructor(parent: ATLRequest, header: string, value: any);
        validate(response: Response): void;
    }
}

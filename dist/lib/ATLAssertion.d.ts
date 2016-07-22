import { ATLTest } from './ATLHelpers';
import { Response } from 'superagent';
import { Pointer } from './Pointer';
export declare class ATLError extends Error {
    expected: any;
    actual: any;
    assertion: ATLAssertion;
    text: string;
    constructor(message: string);
    toString(): string;
    inspect(): string;
}
export declare abstract class ATLAssertion {
    parent: ATLTest;
    promise: Promise<ATLError>;
    name: string;
    skip: boolean;
    constructor(parent: ATLTest);
    error(data: {
        actual?: any;
        expected?: any;
        message: string;
    }): void;
    protected getObjectValue(object: any): any;
}
export declare abstract class ATLResponseAssertion extends ATLAssertion {
    private prom;
    constructor(test: ATLTest);
    cancel(): void;
    abstract validate(response: Response): Promise<ATLError> | void;
}
export declare namespace CommonAssertions {
    class PromiseAssertion extends ATLResponseAssertion {
        evaluator: (res: Response) => Promise<Error | ATLError | void>;
        constructor(parent: ATLTest, name: string, evaluator: (res: Response) => Promise<Error | ATLError | void>);
        validate(response: Response): Promise<any>;
    }
    class StatusCodeAssertion extends ATLResponseAssertion {
        statusCode: number;
        constructor(parent: ATLTest, statusCode: number);
        validate(response: Response): void;
    }
    class BodyEqualsAssertion extends ATLResponseAssertion {
        bodyIs: any;
        constructor(parent: ATLTest, bodyIs: any);
        validate(response: Response): void;
    }
    class BodyMatchesAssertion extends ATLResponseAssertion {
        key: string;
        value: any;
        constructor(parent: ATLTest, key: string, value: any);
        validate(response: Response): void;
    }
    class CopyBodyValueOperation extends ATLResponseAssertion {
        key: string;
        value: Pointer;
        constructor(parent: ATLTest, key: string, value: Pointer);
        validate(response: Response): void;
    }
    class ValidateSchemaOperation extends ATLResponseAssertion {
        schema: string;
        constructor(parent: ATLTest, schema: string);
        validate(response: Response): void;
    }
    class HeaderMatchesAssertion extends ATLResponseAssertion {
        header: string;
        value: any;
        constructor(parent: ATLTest, header: string, value: any);
        validate(response: Response): void;
    }
}

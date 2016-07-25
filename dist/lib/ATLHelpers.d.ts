import { ATL } from './ATL';
export import pointerLib = require('./Pointer');
import { ATLResponseAssertion } from './ATLAssertion';
import { ATLRequest } from './ATLRequest';
import { YAMLNode } from 'yaml-ast-parser';
import { ASTParser, KeyValueObject } from './YAML';
export interface IDictionary<T> {
    [key: string]: T;
}
export declare class CanceledError extends Error {
    inspect(): string;
    constructor();
}
export declare class ATLSuite {
    name: string;
    constructor(name: string);
    dependsOn: ATLSuite[];
    suites: ATLSuite[];
    async: boolean;
    descriptor: any;
    test: ATLTest;
    skip: boolean;
    atl: ATL;
    lastSuite: ATLSuite;
    firstSuite: ATLSuite;
    private flatPromise;
    promise: Promise<any>;
    run(): Promise<any>;
    private reject(error);
    cancel(err: Error): void;
}
export interface IATLTestRes {
    status?: number;
    body?: {
        lowLevelNode?: ASTParser.YAMLNode;
        is?: any;
        matches?: KeyValueObject<any>[];
        take?: KeyValueObject<pointerLib.Pointer>[];
        copyTo?: pointerLib.Pointer;
        schema?: any;
        print?: boolean;
    };
    headers?: IDictionary<string>;
    print?: boolean;
    lowLevelNode?: ASTParser.YAMLNode;
}
export interface IATLTestReq {
    attach?: KeyValueObject<string>[];
    form?: KeyValueObject<any>[];
    json?: any;
    urlencoded?: KeyValueObject<any>[];
    queryParameters?: IDictionary<any>;
    headers?: IDictionary<any>;
    lowLevelNode?: ASTParser.YAMLNode;
}
export declare class ATLTest {
    suite: ATLSuite;
    description: string;
    testId: string;
    method: string;
    uri: string;
    uriParameters: IDictionary<any>;
    skip: boolean;
    timeout: number;
    response: IATLTestRes;
    request: IATLTestReq;
    result: any;
    lowLevelNode: ASTParser.YAMLNode;
    private flatPromise;
    promise: Promise<any>;
    requester: ATLRequest;
    assertions: ATLResponseAssertion[];
    constructor();
    run(): Promise<void>;
    cancel(err: Error): void;
}
export declare function parseSuites(sequenceName: string, node: YAMLNode, instance: ATL): ATLSuite;
export declare function parseTest(node: YAMLNode, suite: ATLSuite): ATLTest;
export declare function ensureInstanceOf(name: string, value: any, ...types: Function[]): void;
export declare function parseMethodHeader(name: any): {
    method: string;
    url: string;
};
export declare function cloneObjectUsingPointers<T>(baseObject: T, store: any): any;
export declare function flatPromise(): {
    resolver: (a?: any) => any;
    rejecter: (a: any) => any;
    promise: Promise<any>;
};
export declare function errorDiff(msg: any, expected: any, actual: any, ctx: any): any;
export declare function error(msg: any, ctx: any): any;

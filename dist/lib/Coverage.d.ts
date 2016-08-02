import url = require('url');
import request = require('supertest');
import RAML = require('raml-1-parser');
import superAgent = require('superagent');
import { ATL } from './ATL';
import ATLHelpers = require('./ATLHelpers');
import ATLTest from './ATLTest';
export interface ITestResult {
    test: ATLTest;
    response: request.Response;
    urlObject: url.Url;
}
export interface ICovData {
    [x: number]: number | void;
    source: string[];
}
export declare class CoverageData {
    data: ATLHelpers.IDictionary<ICovData>;
}
export declare const GlobalCoverageDataCollector: CoverageData;
export declare class CoverageAssertion {
    name: string;
    validationFn: (res: ITestResult[]) => Promise<any> | void;
    private lowLevelAST;
    error: Error;
    valid: boolean;
    innerAssertions: CoverageAssertion[];
    promise: {
        resolver: (a?: any) => any;
        rejecter: (a: any) => any;
        promise: Promise<any>;
    };
    src_file: string;
    src_line: number;
    src_line_end: number;
    src_start: number;
    src_end: number;
    constructor(name: string, validationFn?: (res: ITestResult[]) => Promise<any> | void, lowLevelAST?: RAML.ll.ILowLevelASTNode);
    getCoverage(): {
        file: string;
        line: number;
        lineEnd: number;
        start: number;
        end: number;
        covered: boolean;
    };
    validate(res: ITestResult[]): Promise<any>;
}
export declare class CoverageResource {
    resource: RAML.api08.Resource;
    ramlCoverage: RAMLCoverage;
    relativeUrl: string;
    matches: (str: string) => boolean | any;
    results: ITestResult[];
    coverageTree: ATLHelpers.IDictionary<any>;
    resourceJSON: any;
    uriParameters: any[];
    constructor(resource: RAML.api08.Resource, ramlCoverage: RAMLCoverage);
    resourceAssertion: CoverageAssertion;
    private generateAssertions();
    resolve(test: ATLTest, response: request.Response, urlObject: url.Url): void;
    registerCoverageLineOnData(lineData: {
        file: string;
        line: number;
        lineEnd: number;
        start: number;
        end: number;
        covered: boolean;
    }, cov: CoverageData): void;
    registerCoverageLine(lineData: {
        file: string;
        line: number;
        lineEnd: number;
        start: number;
        end: number;
        covered: boolean;
    }): void;
    getCoverage(): Promise<{
        total: number;
        errored: number;
        notCovered: number;
    }>;
    run(): Promise<any>;
}
export declare class RAMLCoverage {
    raml: RAML.api08.Api | RAML.api10.Api;
    atl: ATL;
    coverageElements: CoverageResource[];
    coverageData: CoverageData;
    constructor(raml: RAML.api08.Api | RAML.api10.Api, atl: ATL);
    private peekResource(resource, parent?);
    registerTestResult(ctx: {
        req: superAgent.SuperAgentRequest;
        res: superAgent.Response;
        test: ATLTest;
        url: string;
        urlObject: url.Url;
    }): void;
    writeCoverage(coverFile: string): void;
}

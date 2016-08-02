import { YAMLNode } from 'yaml-ast-parser';
import { ATL } from './ATL';
export import pointerLib = require('./Pointer');
import { IFSResolver } from './FileSystem';
import ATLTest from './ATLTest';
import ATLSuite from './ATLSuite';
export interface IDictionary<T> {
    [key: string]: T;
}
export declare function parseSuites(sequenceName: string, node: YAMLNode, instance: ATL): ATLSuite;
export declare function parseTest(node: YAMLNode, suite: ATLSuite, wrapperSuite: ATLSuite): ATLTest;
export declare function ensureInstanceOf(name: string, value: any, ...types: Function[]): void;
export declare function parseMethodHeader(name: any): {
    method: string;
    url: string;
};
export declare function cloneObjectUsingPointers<T>(baseObject: T, store: any, fsResolver?: IFSResolver): any;
export declare function flatPromise(): {
    resolver: (a?: any) => any;
    rejecter: (a: any) => any;
    promise: Promise<any>;
};
export declare function errorDiff(msg: any, expected: any, actual: any, ctx: any): any;
export declare function error(msg: any, ctx: any): any;

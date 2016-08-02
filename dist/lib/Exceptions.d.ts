import { YAMLNode } from 'yaml-ast-parser';
export declare class CanceledError extends Error {
    inspect(): string;
    constructor();
}
export declare class NodeError extends Error {
    node: YAMLNode;
    start: number;
    end: number;
    constructor(message: string, node: YAMLNode);
    toString(): string;
}
export declare class CoverageError extends Error {
}
export declare class NotImplementedError extends CoverageError {
    constructor(message: string);
}
export declare class OptionalError extends CoverageError {
    constructor(message: string);
}
export declare class NoMatchingResults extends NotImplementedError {
    constructor();
}

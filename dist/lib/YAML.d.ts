export import PointerType = require('./Pointer');
export import Parser = require('yaml-ast-parser');
export import ASTParser = require('yaml-ast-parser');
import { IDictionary } from './ATLHelpers';
import { IncludedFile } from './FileSystem';
export declare class KeyValueObject<T> {
    key: string;
    value: T;
    constructor(key: string, value: T);
}
export declare function walkFindingErrors(node: any, errors: ASTParser.Error[]): void;
export declare function getErrorString(error: NodeError): string;
export declare function printError(error: NodeError): void;
export declare function load(content: string): ASTParser.YAMLDocument;
export declare namespace YAMLAstHelpers {
    function PrintNode(node: ASTParser.YAMLNode): void;
    function isScalar(node: ASTParser.YAMLNode): boolean;
    function readScalar(node: any): any;
    function isMap(node: ASTParser.YAMLNode): boolean;
    function isSeq(node: ASTParser.YAMLNode): boolean;
    function isPointer(node: ASTParser.YAMLNode): boolean;
    function isInclude(node: ASTParser.YAMLNode): boolean;
    function readInclude(node: any): IncludedFile;
    function getSeqElems(node: ASTParser.YAMLSequence): Parser.YAMLNode[];
    function readKVOElems<T>(node: ASTParser.YAMLSequence): KeyValueObject<T>[];
    function toObject(node: ASTParser.YAMLNode): any;
    function getMap(node: ASTParser.YAMLNode): IDictionary<ASTParser.YAMLNode>;
    function iterpretMap(node: ASTParser.YAMLNode, interprete: any, failOnUnknown?: boolean, ...args: any[]): void;
    function ensureInstanceOf(node: ASTParser.YAMLNode, ...types: Function[]): boolean;
}
export declare class NodeError extends Error {
    node: ASTParser.YAMLNode;
    start: number;
    end: number;
    constructor(message: string, node: ASTParser.YAMLNode);
    toString(): string;
}

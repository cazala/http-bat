"use strict";
exports.PointerType = require('./Pointer');
exports.Parser = require('yaml-ast-parser');
exports.ASTParser = require('yaml-ast-parser');
const util_1 = require('util');
const SAFE_SCHEMA = require('yaml-ast-parser/dist/schema/default_safe');
const Schema = require('yaml-ast-parser/dist/schema');
const FileSystem_1 = require('./FileSystem');
/// ---
class KeyValueObject {
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
}
exports.KeyValueObject = KeyValueObject;
/// ---
let schema = new Schema({
    include: [
        SAFE_SCHEMA
    ],
    explicit: [
        require('yaml-ast-parser/dist/type/js/regexp'),
        exports.PointerType.type
    ]
});
function walkFindingErrors(node, errors) {
    if (node && node.errors && node.errors.length) {
        node.errors.forEach(err => {
            if (err && typeof err == "object") {
                err.node = err.node || node;
            }
            if (errors.indexOf(err) == -1)
                errors.push(err);
        });
    }
    if (typeof node == "object") {
        if (node.value) {
            walkFindingErrors(node.value, errors);
        }
        if (node.mappings && node.mappings instanceof Array) {
            node.mappings.forEach(x => walkFindingErrors(x, errors));
        }
        if (node.items && node.items instanceof Array) {
            node.items.forEach(x => walkFindingErrors(x, errors));
        }
    }
}
exports.walkFindingErrors = walkFindingErrors;
function getErrorString(error) {
    let path = [];
    let currentNode = error.node;
    if (currentNode) {
        while (path.length < 20 && currentNode.parent) {
            if (currentNode.key)
                path.push(YAMLAstHelpers.readScalar(currentNode.key));
            currentNode = currentNode.parent;
        }
        path.push('#%ATL 1.0');
        path = path.reverse();
        path = path.map((elem, i) => new Array(i + 1).join('  ') + elem);
    }
    let head = path.join(':\n') + (path.length ? '\n' : '') + new Array(path.length).join('  ') + "\x1b[31m";
    return head + error + "\x1b[0m";
}
exports.getErrorString = getErrorString;
function printError(error) {
    console.log(getErrorString(error));
    if (!(error instanceof NodeError)) {
        console.log(error.stack);
    }
}
exports.printError = printError;
function load(content) {
    let errors = [];
    let parsed = exports.Parser.load(content, {
        schema: schema
    });
    walkFindingErrors(parsed, errors);
    return parsed;
}
exports.load = load;
/// ---
var YAMLAstHelpers;
(function (YAMLAstHelpers) {
    function PrintNode(node) {
        console.log('Kind: ' + exports.ASTParser.Kind[node.kind]);
        console.log(util_1.inspect(node, false, 5, true));
    }
    YAMLAstHelpers.PrintNode = PrintNode;
    function isScalar(node) {
        return node && node.kind == exports.ASTParser.Kind.SCALAR || false;
    }
    YAMLAstHelpers.isScalar = isScalar;
    function readScalar(node) {
        if (!node)
            return node;
        if (!YAMLAstHelpers.isScalar(node))
            return undefined;
        if (!node.doubleQuoted && typeof node.value == "string") {
            if (node.value == "true")
                return true;
            if (node.value == "null")
                return null;
            if (node.value == "false")
                return false;
            if (/^-?\d+\.?\d*$/.test(node.value)) {
                try {
                    if (!isNaN(parseFloat(node.value))) {
                        return parseFloat(node.value);
                    }
                }
                catch (e) { }
            }
        }
        return node.value;
    }
    YAMLAstHelpers.readScalar = readScalar;
    function isMap(node) {
        return node && node.kind == exports.ASTParser.Kind.MAP || false;
    }
    YAMLAstHelpers.isMap = isMap;
    function isSeq(node) {
        return node && node.kind == exports.ASTParser.Kind.SEQ || false;
    }
    YAMLAstHelpers.isSeq = isSeq;
    function isPointer(node) {
        return node && node.kind == exports.ASTParser.Kind.SCALAR && node.value instanceof exports.PointerType.Pointer || node instanceof exports.PointerType.Pointer;
    }
    YAMLAstHelpers.isPointer = isPointer;
    function isInclude(node) {
        return node && node.kind == exports.ASTParser.Kind.INCLUDE_REF || false;
    }
    YAMLAstHelpers.isInclude = isInclude;
    function readInclude(node) {
        if (!node)
            return null;
        if (node instanceof FileSystem_1.IncludedFile)
            return node;
        if (isInclude(node))
            return FileSystem_1.IncludedFile.getInstance(node.value);
        return null;
    }
    YAMLAstHelpers.readInclude = readInclude;
    function getSeqElems(node) {
        if (!isSeq(node))
            return undefined;
        return node.items;
    }
    YAMLAstHelpers.getSeqElems = getSeqElems;
    function readKVOElems(node) {
        if (!isSeq(node)) {
            new NodeError("this must be a kvo-object", node);
            return [];
        }
        return node.items.map(x => {
            if (isScalar(x)) {
                // TODO unificar errores
                new NodeError('scalar values not allowed on kvo-objects', x);
                return null;
            }
            if (isMap(x)) {
                let obj = getMap(x);
                let keys = Object.keys(obj);
                if (keys.length == 0) {
                    x.errors.push(new NodeError('no values found', x));
                    return;
                }
                let retValue = null;
                for (let i = 0; i < keys.length; i++) {
                    let key = keys[i];
                    if (i == 0) {
                        retValue = new KeyValueObject(key, toObject(obj[key]));
                    }
                    else {
                        obj[key].errors.push(new NodeError('only one value is allowed on kvo-objects', obj[key]));
                    }
                }
                return retValue;
            }
        }).filter(x => !!x);
    }
    YAMLAstHelpers.readKVOElems = readKVOElems;
    function toObject(node) {
        let object;
        try {
            let typeOfNode = typeof node;
            if (typeOfNode == "string" || typeOfNode == "boolean" || typeOfNode == "undefined" || typeOfNode == "number")
                return node;
            if (typeOfNode == "object") {
                if (!node || node instanceof Date || node instanceof FileSystem_1.IncludedFile || node instanceof exports.PointerType.Pointer || node instanceof RegExp)
                    return node;
                if (node.kind == exports.ASTParser.Kind.ANCHOR_REF) {
                    node = node.value;
                }
                if (node.kind == exports.ASTParser.Kind.INCLUDE_REF) {
                    return FileSystem_1.IncludedFile.getInstance(node.value);
                }
                else if (isMap(node)) {
                    object = {};
                    let map = getMap(node);
                    Object.keys(map).forEach(key => {
                        object[key] = toObject(map[key]);
                    });
                }
                else if (isSeq(node)) {
                    object = [];
                    let seq = node;
                    seq.items.forEach(n => {
                        object.push(toObject(n));
                    });
                }
                else if (isScalar(node)) {
                    return readScalar(node);
                }
                else {
                    console.error('UNKNOWN NODE PARSING');
                    PrintNode(node);
                }
            }
        }
        catch (e) {
            node && node.errors && node.errors.push(e);
            console.error(e);
            PrintNode(node);
        }
        return object;
    }
    YAMLAstHelpers.toObject = toObject;
    function getMap(node) {
        if (!isMap(node))
            return undefined;
        let keys = {};
        // validate duplicity
        node.mappings.forEach(x => {
            if (x && x.key && isScalar(x.key)) {
                if (x.key.value in keys)
                    new NodeError('duplicated key ' + x.key.value, x);
                keys[x.key.value] = x.value;
            }
        });
        return keys;
    }
    YAMLAstHelpers.getMap = getMap;
    function iterpretMap(node, interprete, failOnUnknown = true, ...args) {
        // ensure interprete
        // ensureMap
        try {
            let map = getMap(node);
            if (map) {
                let keys = Object.keys(map);
                keys.forEach(key => {
                    try {
                        if (key in interprete) {
                            interprete[key].apply(null, args.concat(map[key]));
                        }
                        else {
                            if (failOnUnknown)
                                throw new NodeError('invalid key ' + key, map[key]);
                            else
                                interprete.UNKNOWN && interprete.UNKNOWN.apply(null, args.concat([map[key], key]));
                        }
                    }
                    catch (e) {
                        if (map && map[key] && map[key].errors) {
                            map[key].errors.push(e);
                        }
                        else {
                            if (node && node.errors) {
                                node.errors.push(e);
                            }
                            else {
                                throw e;
                            }
                        }
                    }
                });
            }
            else {
                if (node)
                    new NodeError("this must be a map got type " + exports.ASTParser.Kind[node.kind], node);
                else
                    throw new Error("this must be a map got: " + util_1.inspect(node));
            }
        }
        catch (e) {
            if (node && node.errors) {
                node.errors.push(e);
            }
            else {
                throw e;
            }
        }
    }
    YAMLAstHelpers.iterpretMap = iterpretMap;
    function ensureInstanceOf(node, ...types) {
        if (node == null)
            return false;
        for (let i = 0; i < types.length; i++) {
            if (typeof types[i] == "function") {
                if (types[i] === Object && isMap(node))
                    return true;
                if (types[i] === Array && isSeq(node))
                    return true;
                if (YAMLAstHelpers.isScalar(node)) {
                    let scalar = readScalar(node);
                    let typeofScalar = typeof scalar;
                    if (types[i] === Number && typeofScalar == "number")
                        return true;
                    if (types[i] === String && typeofScalar === 'string')
                        return true;
                    if (types[i] === Boolean && typeofScalar === 'boolean')
                        return true;
                    if (scalar instanceof types[i])
                        return true;
                }
            }
        }
        new NodeError((node.parent && node.parent.key && node.parent.key.value || node.parent.value).toString() + " must be any of [" + types.map((x) => x && x.displayName || x && x.name || x.toString()).join(" | ") + "]", node);
        return false;
    }
    YAMLAstHelpers.ensureInstanceOf = ensureInstanceOf;
})(YAMLAstHelpers = exports.YAMLAstHelpers || (exports.YAMLAstHelpers = {}));
class NodeError extends Error {
    constructor(message, node) {
        super(message);
        this.node = node;
        this.message = message;
        this.start = node.startPosition;
        this.end = node.endPosition;
        node.errors.push(this);
    }
    toString() {
        return this.message;
    }
}
exports.NodeError = NodeError;
//# sourceMappingURL=YAML.js.map
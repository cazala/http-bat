"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
exports.PointerType = require('./Pointer');
exports.Parser = require('yaml-ast-parser');
exports.ASTParser = require('yaml-ast-parser');
var util_1 = require('util');
var SAFE_SCHEMA = require('yaml-ast-parser/dist/schema/default_safe');
var Schema = require('yaml-ast-parser/dist/schema');
var FileSystem_1 = require('./FileSystem');
/// ---
var KeyValueObject = (function () {
    function KeyValueObject(key, value) {
        this.key = key;
        this.value = value;
    }
    return KeyValueObject;
}());
exports.KeyValueObject = KeyValueObject;
/// ---
var schema = new Schema({
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
        node.errors.forEach(function (err) {
            if (err) {
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
            node.mappings.forEach(function (x) { return walkFindingErrors(x, errors); });
        }
        if (node.items && node.items instanceof Array) {
            node.items.forEach(function (x) { return walkFindingErrors(x, errors); });
        }
    }
}
exports.walkFindingErrors = walkFindingErrors;
function getErrorString(error) {
    var path = [];
    var currentNode = error.node;
    if (currentNode) {
        while (path.length < 20 && currentNode.parent) {
            if (currentNode.key)
                path.push(YAMLAstHelpers.readScalar(currentNode.key));
            currentNode = currentNode.parent;
        }
        path.push('#%ATL 1.0');
        path = path.reverse();
        path = path.map(function (elem, i) { return new Array(i + 1).join('  ') + elem; });
    }
    var head = path.join(':\n') + (path.length ? '\n' : '') + new Array(path.length).join('  ') + "\x1b[31m";
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
    var errors = [];
    var parsed = exports.Parser.load(content, {
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
        return node.items.map(function (x) {
            if (isScalar(x)) {
                // TODO unificar errores
                new NodeError('scalar values not allowed on kvo-objects', x);
                return null;
            }
            if (isMap(x)) {
                var obj = getMap(x);
                var keys = Object.keys(obj);
                if (keys.length == 0) {
                    x.errors.push(new NodeError('no values found', x));
                    return;
                }
                var retValue = null;
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    if (i == 0) {
                        retValue = new KeyValueObject(key, toObject(obj[key]));
                    }
                    else {
                        obj[key].errors.push(new NodeError('only one value is allowed on kvo-objects', obj[key]));
                    }
                }
                return retValue;
            }
        }).filter(function (x) { return !!x; });
    }
    YAMLAstHelpers.readKVOElems = readKVOElems;
    function toObject(node) {
        var object;
        try {
            var typeOfNode = typeof node;
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
                    var map_1 = getMap(node);
                    Object.keys(map_1).forEach(function (key) {
                        object[key] = toObject(map_1[key]);
                    });
                }
                else if (isSeq(node)) {
                    object = [];
                    var seq = node;
                    seq.items.forEach(function (n) {
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
        var keys = {};
        // validate duplicity
        node.mappings.forEach(function (x) {
            if (x && x.key && isScalar(x.key)) {
                if (x.key.value in keys)
                    new NodeError('duplicated key ' + x.key.value, x);
                keys[x.key.value] = x.value;
            }
        });
        return keys;
    }
    YAMLAstHelpers.getMap = getMap;
    function iterpretMap(node, interprete, failOnUnknown) {
        // ensure interprete
        // ensureMap
        if (failOnUnknown === void 0) { failOnUnknown = true; }
        var args = [];
        for (var _i = 3; _i < arguments.length; _i++) {
            args[_i - 3] = arguments[_i];
        }
        try {
            var map_2 = getMap(node);
            if (map_2) {
                var keys = Object.keys(map_2);
                keys.forEach(function (key) {
                    try {
                        if (key in interprete) {
                            interprete[key].apply(null, args.concat(map_2[key]));
                        }
                        else {
                            if (failOnUnknown)
                                throw new NodeError('invalid key ' + key, map_2[key]);
                            else
                                interprete.UNKNOWN && interprete.UNKNOWN.apply(null, args.concat([map_2[key], key]));
                        }
                    }
                    catch (e) {
                        if (map_2 && map_2[key] && map_2[key].errors) {
                            map_2[key].errors.push(e);
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
    function ensureInstanceOf(node) {
        var types = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            types[_i - 1] = arguments[_i];
        }
        if (node == null)
            return false;
        for (var i = 0; i < types.length; i++) {
            if (typeof types[i] == "function") {
                if (types[i] === Object && isMap(node))
                    return true;
                if (types[i] === Array && isSeq(node))
                    return true;
                if (YAMLAstHelpers.isScalar(node)) {
                    var scalar = readScalar(node);
                    var typeofScalar = typeof scalar;
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
        new NodeError((node.parent && node.parent.key && node.parent.key.value || node.parent.value).toString() + " must be any of [" + types.map(function (x) { return x && x.displayName || x && x.name || x.toString(); }).join(" | ") + "]", node);
        return false;
    }
    YAMLAstHelpers.ensureInstanceOf = ensureInstanceOf;
})(YAMLAstHelpers = exports.YAMLAstHelpers || (exports.YAMLAstHelpers = {}));
var NodeError = (function (_super) {
    __extends(NodeError, _super);
    function NodeError(message, node) {
        _super.call(this, message);
        this.node = node;
        this.message = message;
        this.start = node.startPosition;
        this.end = node.endPosition;
        node.errors.push(this);
    }
    NodeError.prototype.toString = function () {
        return this.message;
    };
    return NodeError;
}(Error));
exports.NodeError = NodeError;
//# sourceMappingURL=YAML.js.map
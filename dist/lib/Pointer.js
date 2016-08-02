"use strict";
// NPM
var Type = require('yaml-ast-parser/dist/type');
var _ = require('lodash');
var Pointer = (function () {
    function Pointer(path) {
        this.path = path;
    }
    Pointer.prototype.set = function (object, value) {
        _.set(object, this.path, value);
    };
    Pointer.prototype.get = function (object) {
        return _.get(object, this.path);
    };
    Pointer.prototype.inspect = function () {
        return "Pointer [" + this.path + "]";
    };
    Pointer.prototype.toString = function () {
        return "Pointer [" + this.path + "]";
    };
    return Pointer;
}());
exports.Pointer = Pointer;
// ---
exports.type = new Type('tag:yaml.org,2002:variable', {
    kind: 'scalar',
    resolve: resolvePointer,
    construct: constructVariable,
    instanceOf: Pointer
});
function constructVariable(data) {
    return new Pointer(data.value);
}
function resolvePointer(data) {
    return (typeof data.value === 'string');
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Pointer;
//# sourceMappingURL=Pointer.js.map
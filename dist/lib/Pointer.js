"use strict";
// NPM
const Type = require('yaml-ast-parser/dist/type');
const _ = require('lodash');
exports.type = new Type('tag:yaml.org,2002:variable', {
    kind: 'scalar',
    resolve: resolvePointer,
    construct: constructVariable,
    instanceOf: Pointer
});
class Pointer {
    constructor(path) {
        this.path = path;
    }
    set(object, value) {
        _.set(object, this.path, value);
    }
    get(object) {
        return _.get(object, this.path);
    }
    inspect() {
        return "Pointer [" + this.path + "]";
    }
    toString() {
        return "Pointer [" + this.path + "]";
    }
}
exports.Pointer = Pointer;
// ---
function constructVariable(data) {
    return new Pointer(data.value);
}
function resolvePointer(data) {
    return (typeof data.value === 'string');
}
//# sourceMappingURL=Pointer.js.map
/// <reference path="../src/typings/index.d.ts" />
"use strict";
var YAML = require('../dist/lib/YAML');
var util = require('util');
describe('parse KVO', function () {
    it('must fail on scalar sequence', function () {
        var document = YAML.load("\na:\n  - item\n  - other item\n    ");
        var a = YAML.YAMLAstHelpers.getMap(document)['a'];
        var kvo = YAML.YAMLAstHelpers.readKVOElems(a);
        var errors = [];
        YAML.walkFindingErrors(document, errors);
        if (!errors.length)
            throw new Error(util.inspect(document, false, 10, false));
    });
    it('must fail on multiple fielded objects', function () {
        var document = YAML.load("\na:\n  - item: a\n    other: item\n    ");
        var a = YAML.YAMLAstHelpers.getMap(document)['a'];
        var kvo = YAML.YAMLAstHelpers.readKVOElems(a);
        var errors = [];
        YAML.walkFindingErrors(document, errors);
        if (!errors.length)
            throw new Error(util.inspect(document, false, 10, false));
    });
    it('must parse well formated items', function () {
        var document = YAML.load("\na:\n  - item: a\n  - other: item\n    ");
        var a = YAML.YAMLAstHelpers.getMap(document)['a'];
        var kvo = YAML.YAMLAstHelpers.readKVOElems(a);
        var errors = [];
        YAML.walkFindingErrors(document, errors);
        if (errors.length)
            throw errors[0];
    });
});
//# sourceMappingURL=yaml.kvo.spec.js.map
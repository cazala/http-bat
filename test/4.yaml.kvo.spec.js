/// <reference path="typings/index.d.ts" />
"use strict";
var dist_1 = require('../dist');
var util = require('util');
describe('parse KVO', function () {
    it('must fail on scalar sequence', function () {
        var document = dist_1.YAML.load("\na:\n  - item\n  - other item\n    ");
        var a = dist_1.YAML.YAMLAstHelpers.getMap(document)['a'];
        var kvo = dist_1.YAML.YAMLAstHelpers.readKVOElems(a);
        var errors = [];
        dist_1.YAML.walkFindingErrors(document, errors);
        if (!errors.length)
            throw new Error(util.inspect(document, false, 10, false));
    });
    it('must fail on multiple fielded objects', function () {
        var document = dist_1.YAML.load("\na:\n  - item: a\n    other: item\n    ");
        var a = dist_1.YAML.YAMLAstHelpers.getMap(document)['a'];
        var kvo = dist_1.YAML.YAMLAstHelpers.readKVOElems(a);
        var errors = [];
        dist_1.YAML.walkFindingErrors(document, errors);
        if (!errors.length)
            throw new Error(util.inspect(document, false, 10, false));
    });
    it('must parse well formated items', function () {
        var document = dist_1.YAML.load("\na:\n  - item: a\n  - other: item\n    ");
        var a = dist_1.YAML.YAMLAstHelpers.getMap(document)['a'];
        var kvo = dist_1.YAML.YAMLAstHelpers.readKVOElems(a);
        var errors = [];
        dist_1.YAML.walkFindingErrors(document, errors);
        if (errors.length)
            throw errors[0];
    });
});
//# sourceMappingURL=4.yaml.kvo.spec.js.map
/// <reference path="typings/index.d.ts" />
"use strict";
const dist_1 = require('../dist');
const util = require('util');
describe('parse KVO', () => {
    it('must fail on scalar sequence', () => {
        let document = dist_1.YAML.load(`
a:
  - item
  - other item
    `);
        let a = dist_1.YAML.YAMLAstHelpers.getMap(document)['a'];
        let kvo = dist_1.YAML.YAMLAstHelpers.readKVOElems(a);
        let errors = [];
        dist_1.YAML.walkFindingErrors(document, errors);
        if (!errors.length)
            throw new Error(util.inspect(document, false, 10, false));
    });
    it('must fail on multiple fielded objects', () => {
        let document = dist_1.YAML.load(`
a:
  - item: a
    other: item
    `);
        let a = dist_1.YAML.YAMLAstHelpers.getMap(document)['a'];
        let kvo = dist_1.YAML.YAMLAstHelpers.readKVOElems(a);
        let errors = [];
        dist_1.YAML.walkFindingErrors(document, errors);
        if (!errors.length)
            throw new Error(util.inspect(document, false, 10, false));
    });
    it('must parse well formated items', () => {
        let document = dist_1.YAML.load(`
a:
  - item: a
  - other: item
    `);
        let a = dist_1.YAML.YAMLAstHelpers.getMap(document)['a'];
        let kvo = dist_1.YAML.YAMLAstHelpers.readKVOElems(a);
        let errors = [];
        dist_1.YAML.walkFindingErrors(document, errors);
        if (errors.length)
            throw errors[0];
    });
});
//# sourceMappingURL=4.yaml.kvo.spec.js.map
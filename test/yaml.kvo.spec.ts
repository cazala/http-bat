import YAML = require('../dist/lib/YAML');
import util = require('util');

declare var describe, it;

describe('parse KVO', () => {
  it('must fail on scalar sequence', () => {
    let document = YAML.load(`
a:
  - item
  - other item
    `);


    let a = YAML.YAMLAstHelpers.getMap(document as any)['a'];

    let kvo = YAML.YAMLAstHelpers.readKVOElems(a as any);

    let errors = [];

    YAML.walkFindingErrors(document as any, errors);

    if (!errors.length)
      throw new Error(util.inspect(document, false, 10, false));
  });
  it('must fail on multiple fielded objects', () => {
    let document = YAML.load(`
a:
  - item: a
    other: item
    `);


    let a = YAML.YAMLAstHelpers.getMap(document as any)['a'];

    let kvo = YAML.YAMLAstHelpers.readKVOElems(a as any);

    let errors = [];

    YAML.walkFindingErrors(document as any, errors);

    if (!errors.length)
      throw new Error(util.inspect(document, false, 10, false));
  });

  it('must parse well formated items', () => {
    let document = YAML.load(`
a:
  - item: a
  - other: item
    `);


    let a = YAML.YAMLAstHelpers.getMap(document as any)['a'];

    let kvo = YAML.YAMLAstHelpers.readKVOElems(a as any);

    let errors = [];

    YAML.walkFindingErrors(document as any, errors);

    if (errors.length)
      throw errors[0];
  });
});
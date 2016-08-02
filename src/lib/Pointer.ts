// NPM
import Type = require('yaml-ast-parser/dist/type');
import { YAMLMapping } from 'yaml-ast-parser';
import _ = require('lodash');

export class Pointer {
  constructor(public path: string) {

  }

  set(object: any, value: any) {
    _.set(object, this.path, value);
  }

  get(object: any) {
    return _.get(object, this.path);
  }

  inspect() {
    return "Pointer [" + this.path + "]";
  }
  toString() {
    return "Pointer [" + this.path + "]";
  }
}

// ---

export const type = new Type('tag:yaml.org,2002:variable', {
  kind: 'scalar',
  resolve: resolvePointer,
  construct: constructVariable,
  instanceOf: Pointer
});

function constructVariable(data) {
  return new Pointer(data.value);
}


function resolvePointer(data: YAMLMapping) {
  return (typeof data.value === 'string');
}


export default Pointer;
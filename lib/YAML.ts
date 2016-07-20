export import PointerType = require('./Pointer');
export import Parser = require('yaml-ast-parser');

export import ASTParser = require('yaml-ast-parser');

import { inspect } from 'util';

import SAFE_SCHEMA = require('yaml-ast-parser/dist/schema/default_safe');
import Schema = require('yaml-ast-parser/dist/schema');
import { IDictionary } from './ATLHelpers';

import YAMLError = require('yaml-ast-parser/dist/exception');
import Mark = require('yaml-ast-parser/dist/mark');

import { IncludedFile } from './FileSystem';

/// ---

export class KeyValueObject<T> {
  constructor(public key: string, public value: T) {

  }
}

/// ---

let schema = new Schema({
  include: [
    SAFE_SCHEMA
  ],
  explicit: [
    require('yaml-ast-parser/dist/type/js/regexp'),
    PointerType.type
  ]
});

export function walkFindingErrors(node, errors: ASTParser.Error[]) {
  if (node && node.errors && node.errors.length) {
    node.errors.forEach(err => {
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
      node.mappings.forEach(x => walkFindingErrors(x, errors));
    }
    if (node.items && node.items instanceof Array) {
      node.items.forEach(x => walkFindingErrors(x, errors));
    }
  }
}

export function getErrorString(error: NodeError) {
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

export function printError(error: NodeError) {
  console.log(getErrorString(error));

  if (!(error instanceof NodeError)) {
    console.log(error.stack);
  }
}

export function load(content: string) {
  let errors: ASTParser.Error[] = [];

  let parsed = Parser.load(content, {
    schema: schema
  });

  walkFindingErrors(parsed as any, errors);

  return parsed;
}

/// ---

export namespace YAMLAstHelpers {
  export function PrintNode(node: ASTParser.YAMLNode) {
    console.log('Kind: ' + ASTParser.Kind[node.kind]);
    console.log(inspect(node, false, 5, true));
  }

  export function isScalar(node: ASTParser.YAMLNode) {
    return node && node.kind == ASTParser.Kind.SCALAR || false;
  }

  export function readScalar(node) {
    if (!node) return node;
    if (!YAMLAstHelpers.isScalar(node)) return undefined;

    if (!node.doubleQuoted && typeof node.value == "string") {
      if (node.value == "true") return true;
      if (node.value == "false") return false;
      if (/^-?\d+\.?\d*$/.test(node.value)) {
        try {
          if (!isNaN(parseFloat(node.value))) {
            return parseFloat(node.value);
          }
        } catch (e) { }
      }
    }

    return node.value;
  }

  export function isMap(node: ASTParser.YAMLNode) {
    return node && node.kind == ASTParser.Kind.MAP || false;
  }

  export function isSeq(node: ASTParser.YAMLNode) {
    return node && node.kind == ASTParser.Kind.SEQ || false;
  }

  export function isPointer(node: ASTParser.YAMLNode) {
    return node && node.kind == ASTParser.Kind.SCALAR && node.value instanceof PointerType.Pointer || node instanceof PointerType.Pointer;
  }

  export function isInclude(node: ASTParser.YAMLNode) {
    return node && node.kind == ASTParser.Kind.INCLUDE_REF || false;
  }

  export function readInclude(node): IncludedFile {
    if (!node) return null;
    if (node instanceof IncludedFile) return node;
    if (isInclude(node)) return IncludedFile.getInstance(node.value);

    return null;
  }

  export function getSeqElems(node: ASTParser.YAMLSequence) {
    if (!isSeq(node)) return undefined;

    return node.items;
  }

  export function readKVOElems<T>(node: ASTParser.YAMLSequence): KeyValueObject<T>[] {
    if (!isSeq(node)) {
      new NodeError("this must be a kvo-object", node as any);
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
          x.errors.push(new NodeError('no values found', x) as any);
          return;
        }

        let retValue = null;

        for (let i = 0; i < keys.length; i++) {
          let key = keys[i];
          if (i == 0) {
            retValue = new KeyValueObject(key, toObject(obj[key]));
          } else {
            obj[key].errors.push(new NodeError('only one value is allowed on kvo-objects', obj[key]) as any);
          }
        }

        return retValue;
      }


    }).filter(x => !!x);
  }

  export function toObject(node: ASTParser.YAMLNode) {
    let object: any;
    try {
      let typeOfNode = typeof node;

      if (typeOfNode == "string" || typeOfNode == "boolean" || typeOfNode == "undefined" || typeOfNode == "number")
        return node;

      if (typeOfNode == "object") {
        if (!node || node instanceof Date || node instanceof IncludedFile || node instanceof PointerType.Pointer || node instanceof RegExp)
          return node;

        if (node.kind == ASTParser.Kind.ANCHOR_REF) {
          node = node.value;
        }

        if (node.kind == ASTParser.Kind.INCLUDE_REF) {
          return IncludedFile.getInstance(node.value);
        } else if (isMap(node)) {
          object = {};
          let map = getMap(node);
          Object.keys(map).forEach(key => {
            object[key] = toObject(map[key]);
          });
        } else if (isSeq(node)) {
          object = [];
          let seq = node as ASTParser.YAMLSequence;

          seq.items.forEach(n => {
            object.push(toObject(n));
          });
        } else if (isScalar(node)) {

          return readScalar(node);
        } else {
          console.error('UNKNOWN NODE PARSING');
          PrintNode(node);
        }
      }
    } catch (e) {
      node && node.errors && node.errors.push(e);
      console.error(e);
      PrintNode(node);
    }
    return object;
  }

  export function getMap(node: ASTParser.YAMLNode): IDictionary<ASTParser.YAMLNode> {
    if (!isMap(node)) return undefined;

    let keys: IDictionary<ASTParser.YAMLNode> = {};

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

  export function iterpretMap(node: ASTParser.YAMLNode, interprete, failOnUnknown: boolean = true, ...args) {
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
            } else {
              if (failOnUnknown)
                throw new NodeError('invalid key ' + key, map[key]);
              else
                interprete.UNKNOWN && interprete.UNKNOWN.apply(null, args.concat([map[key], key]));
            }
          } catch (e) {
            if (map && map[key] && map[key].errors) {
              map[key].errors.push(e);
            } else {
              if (node && node.errors) {
                node.errors.push(e);
              } else {
                throw e;
              }
            }
          }
        });
      } else {
        if (node)
          new NodeError("this must be a map got type " + ASTParser.Kind[node.kind], node);
        else
          throw new Error("this must be a map got: " + inspect(node));
      }
    } catch (e) {
      if (node && node.errors) {
        node.errors.push(e);
      } else {
        throw e;
      }
    }
  }


  export function ensureInstanceOf(node: ASTParser.YAMLNode, ...types: Function[]): boolean {
    if (node == null) return false;

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

    new NodeError((node.parent && node.parent.key && node.parent.key.value || node.parent.value).toString() + " must be any of [" + types.map((x: any) => x && x.displayName || x && x.name || x.toString()).join(" | ") + "]", node);

    return false;
  }
}

export class NodeError extends Error {
  start: number;
  end: number;

  constructor(message: string, public node: ASTParser.YAMLNode) {
    super(message);
    this.message = message;
    this.start = node.startPosition;
    this.end = node.endPosition;
    node.errors.push(this as any);
  }

  toString() {
    return this.message;
  }
}
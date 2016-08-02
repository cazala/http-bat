import { YAMLNode } from 'yaml-ast-parser';

export class CanceledError extends Error {
  inspect() {
    return 'CANCELED';
  }
  constructor() {
    super('CANCELED');
  }
}

export class NodeError extends Error {
  start: number;
  end: number;

  constructor(message: string, public node: YAMLNode) {
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

export class CoverageError extends Error {

}

export class NotImplementedError extends CoverageError {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = "Method not implemented";
  }
}

export class OptionalError extends CoverageError {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = "Optional Error";
  }
}

export class NoMatchingResults extends NotImplementedError {
  constructor() {
    super("No matching results");
  }
}

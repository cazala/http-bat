import fs = require('fs');
import { resolve } from 'path';

export interface IFSResolver {
  content(path: string): string;
  contentAsync(path: string): Promise<string>;
}

export class FSResolver implements IFSResolver {

  constructor(public basePath?: string) {
    this.basePath = basePath || '';
  }

  content(path: string): string {
    if (typeof path != "string") {
      path = "" + path;
    }

    path = resolve(this.basePath, path);

    if (!fs.existsSync(path)) {
      return null;
    }

    try {
      return fs.readFileSync(path).toString();
    } catch (e) {
      return null;
    }
  }
  contentAsync(path: string): Promise<string> {
    return new Promise(function (resolve, reject) {

      fs.readFile(path, function (err, data) {
        if (err != null) {
          return reject(err);
        }
        let content = data.toString();
        resolve(content);
      });
    });
  }
}

export const DefaultFileResolver = new FSResolver;

export class IncludedFile {
  constructor(public path: string) {

  }

  content(fsResolver: IFSResolver = DefaultFileResolver): string {
    return fsResolver.content(this.path);
  }

  contentAsync(fsResolver: IFSResolver = DefaultFileResolver): Promise<string> {
    return fsResolver.contentAsync(this.path);
  }

  static getInstance(path: string): IncludedFile {
    return new IncludedFile(path);
  }
}
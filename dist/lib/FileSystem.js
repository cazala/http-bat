"use strict";
const fs = require('fs');
const path_1 = require('path');
class FSResolver {
    constructor(basePath) {
        this.basePath = basePath;
        this.basePath = basePath || '';
    }
    content(path) {
        if (typeof path != "string") {
            path = "" + path;
        }
        path = path_1.resolve(this.basePath, path);
        if (!fs.existsSync(path)) {
            console.log('file does not exists: ' + path);
            return null;
        }
        try {
            return fs.readFileSync(path).toString();
        }
        catch (e) {
            console.log(e);
            return null;
        }
    }
    contentAsync(path) {
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
exports.FSResolver = FSResolver;
exports.DefaultFileResolver = new FSResolver;
class IncludedFile {
    constructor(path) {
        this.path = path;
    }
    content(fsResolver = exports.DefaultFileResolver) {
        return fsResolver.content(this.path);
    }
    contentAsync(fsResolver = exports.DefaultFileResolver) {
        return fsResolver.contentAsync(this.path);
    }
    static getInstance(path) {
        return new IncludedFile(path);
    }
}
exports.IncludedFile = IncludedFile;
//# sourceMappingURL=FileSystem.js.map
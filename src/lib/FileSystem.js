"use strict";
var fs = require('fs');
var path_1 = require('path');
var FSResolver = (function () {
    function FSResolver(basePath) {
        this.basePath = basePath;
        this.basePath = basePath || '';
    }
    FSResolver.prototype.content = function (path) {
        if (typeof path != "string") {
            path = "" + path;
        }
        path = path_1.resolve(this.basePath, path);
        if (!fs.existsSync(path)) {
            return null;
        }
        try {
            return fs.readFileSync(path).toString();
        }
        catch (e) {
            return null;
        }
    };
    FSResolver.prototype.contentAsync = function (path) {
        return new Promise(function (resolve, reject) {
            fs.readFile(path, function (err, data) {
                if (err != null) {
                    return reject(err);
                }
                var content = data.toString();
                resolve(content);
            });
        });
    };
    return FSResolver;
}());
exports.FSResolver = FSResolver;
exports.DefaultFileResolver = new FSResolver;
var IncludedFile = (function () {
    function IncludedFile(path) {
        this.path = path;
    }
    IncludedFile.prototype.content = function (fsResolver) {
        if (fsResolver === void 0) { fsResolver = exports.DefaultFileResolver; }
        return fsResolver.content(this.path);
    };
    IncludedFile.prototype.contentAsync = function (fsResolver) {
        if (fsResolver === void 0) { fsResolver = exports.DefaultFileResolver; }
        return fsResolver.contentAsync(this.path);
    };
    IncludedFile.getInstance = function (path) {
        return new IncludedFile(path);
    };
    return IncludedFile;
}());
exports.IncludedFile = IncludedFile;
//# sourceMappingURL=FileSystem.js.map
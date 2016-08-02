"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var CanceledError = (function (_super) {
    __extends(CanceledError, _super);
    function CanceledError() {
        _super.call(this, 'CANCELED');
    }
    CanceledError.prototype.inspect = function () {
        return 'CANCELED';
    };
    return CanceledError;
}(Error));
exports.CanceledError = CanceledError;
var NodeError = (function (_super) {
    __extends(NodeError, _super);
    function NodeError(message, node) {
        _super.call(this, message);
        this.node = node;
        this.message = message;
        this.start = node.startPosition;
        this.end = node.endPosition;
        node.errors.push(this);
    }
    NodeError.prototype.toString = function () {
        return this.message;
    };
    return NodeError;
}(Error));
exports.NodeError = NodeError;
var CoverageError = (function (_super) {
    __extends(CoverageError, _super);
    function CoverageError() {
        _super.apply(this, arguments);
    }
    return CoverageError;
}(Error));
exports.CoverageError = CoverageError;
var NotImplementedError = (function (_super) {
    __extends(NotImplementedError, _super);
    function NotImplementedError(message) {
        _super.call(this, message);
        this.message = message;
        this.name = "Method not implemented";
    }
    return NotImplementedError;
}(CoverageError));
exports.NotImplementedError = NotImplementedError;
var OptionalError = (function (_super) {
    __extends(OptionalError, _super);
    function OptionalError(message) {
        _super.call(this, message);
        this.message = message;
        this.name = "Optional Error";
    }
    return OptionalError;
}(CoverageError));
exports.OptionalError = OptionalError;
var NoMatchingResults = (function (_super) {
    __extends(NoMatchingResults, _super);
    function NoMatchingResults() {
        _super.call(this, "No matching results");
    }
    return NoMatchingResults;
}(NotImplementedError));
exports.NoMatchingResults = NoMatchingResults;
//# sourceMappingURL=Exceptions.js.map
"use strict";
var ATLHelpers_1 = require('./ATLHelpers');
var events_1 = require('events');
var Exceptions_1 = require('./Exceptions');
(function (EDependencyKind) {
    EDependencyKind[EDependencyKind["Pass"] = 0] = "Pass";
    EDependencyKind[EDependencyKind["Fail"] = 1] = "Fail";
    EDependencyKind[EDependencyKind["Both"] = 2] = "Both";
})(exports.EDependencyKind || (exports.EDependencyKind = {}));
var EDependencyKind = exports.EDependencyKind;
(function (ERunningStatus) {
    ERunningStatus[ERunningStatus["None"] = 0] = "None";
    ERunningStatus[ERunningStatus["Waiting"] = 1] = "Waiting";
    ERunningStatus[ERunningStatus["Running"] = 2] = "Running";
    ERunningStatus[ERunningStatus["Ended"] = 3] = "Ended";
    ERunningStatus[ERunningStatus["Canceled"] = 4] = "Canceled";
})(exports.ERunningStatus || (exports.ERunningStatus = {}));
var ERunningStatus = exports.ERunningStatus;
var runnableCount = 0;
exports.RunnableListener = new events_1.EventEmitter();
exports.RunnableEvents = {
    RunningStatusChanged: 'running_status_changed',
    Resolved: 'resolved',
    Rejected: 'rejected',
    Canceling: 'canceling'
};
var Runnable = (function () {
    function Runnable(runner) {
        var _this = this;
        this.runner = runner;
        this._cancellationListeners = [];
        this.dependsOn = [];
        this.id = 'r-' + (runnableCount++).toString(16);
        this.name = this.id;
        this.innerPromise = new Promise(function (a, b) {
            _this._resolve = a;
            _this._reject = b;
        });
        this.resolved = false;
        this.rejected = false;
        this.runningStatus = ERunningStatus.None;
        this.catch = this.innerPromise.catch.bind(this.innerPromise);
        this.then = this.innerPromise.then.bind(this.innerPromise);
        this.then(function (value) {
            _this.value = value;
            _this.resolved = true;
            _this.setRunningStatus(ERunningStatus.Ended);
            exports.RunnableListener.emit(exports.RunnableEvents.Resolved, _this, value);
        });
        this.catch(function (error) {
            _this.error = error;
            _this.setRunningStatus(ERunningStatus.Ended);
            exports.RunnableListener.emit(exports.RunnableEvents.Rejected, _this, error);
        });
    }
    Runnable.prototype.then = function () { return null; };
    Runnable.prototype.catch = function () { return null; };
    Runnable.prototype.thenOrCatch = function () {
        var _this = this;
        var p = ATLHelpers_1.flatPromise();
        this.then(function (value) {
            p.resolver({
                runnable: _this,
                failed: false,
                value: value
            });
        });
        this.catch(function (error) {
            p.resolver({
                runnable: _this,
                failed: true,
                error: error
            });
        });
        return p.promise;
    };
    Runnable.prototype.addDependency = function (runnable, kind) {
        if (kind === void 0) { kind = EDependencyKind.Pass; }
        this.dependsOn.push({
            runnable: runnable,
            kind: kind
        });
    };
    Runnable.prototype.cancel = function () {
        exports.RunnableListener.emit(exports.RunnableEvents.Canceling, this);
        this._cancellationListeners.forEach(function (x) {
            try {
                x();
            }
            catch (e) { }
        });
        try {
            this._reject(new Exceptions_1.CanceledError());
            this.rejected = true;
            this.setRunningStatus(ERunningStatus.Canceled);
        }
        catch (e) {
        }
    };
    Runnable.prototype.onCancel = function (fn) {
        if (fn && typeof fn == "function")
            this._cancellationListeners.push(fn);
    };
    Runnable.prototype.run = function (triggerExecution) {
        var _this = this;
        if (triggerExecution === void 0) { triggerExecution = true; }
        if (this.runningStatus != ERunningStatus.None)
            return;
        this.dependsOn = Object.seal(this.dependsOn);
        this.setRunningStatus(ERunningStatus.Waiting);
        var deps = this.dependsOn.map(function (x) {
            var prom = ATLHelpers_1.flatPromise();
            if (x.kind == EDependencyKind.Pass || x.kind == EDependencyKind.Both)
                x.runnable.then(function (x) { return prom.resolver(); });
            if (x.kind == EDependencyKind.Fail || x.kind == EDependencyKind.Both)
                x.runnable.catch(function (x) { return prom.resolver(); });
            if (x.kind == EDependencyKind.Pass)
                x.runnable.catch(function (e) { return prom.rejecter(e); });
            if (x.kind == EDependencyKind.Fail)
                x.runnable.then(function (e) { return prom.rejecter(e); });
            if (triggerExecution && (x.runnable instanceof Runnable))
                x.runnable.run();
            return prom.promise;
        });
        var mutex = Promise.resolve();
        if (deps.length)
            mutex = Promise.all(deps);
        mutex.then(function () {
            _this.setRunningStatus(ERunningStatus.Running);
            try {
                var prom = _this.runner(_this);
                prom.then(function (value) {
                    _this._resolve(value);
                });
                prom.catch(function (error) {
                    _this._reject(error);
                });
            }
            catch (e) {
                _this._reject(e);
            }
        });
        mutex.catch(function (error) {
            _this._reject();
        });
    };
    Runnable.prototype.setRunningStatus = function (status) {
        if (status > this.runningStatus) {
            this.runningStatus = status;
            exports.RunnableListener.emit(exports.RunnableEvents.RunningStatusChanged, this, this.runningStatus);
        }
    };
    return Runnable;
}());
exports.Runnable = Runnable;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Runnable;
//# sourceMappingURL=Runnable.js.map
"use strict";
var reInterpolation = /(\\{0,1})\{([^\}\{]+)\}/g;
var _ = require("lodash");
function interpolateString(input, store) {
    return input.replace(reInterpolation, function (fulltext, startChar, match) {
        if (startChar === "\\")
            return fulltext;
        var value = _.get(store, match);
        if (typeof value === "undefined") {
            return fulltext;
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        return value.toString();
    });
}
exports.interpolateString = interpolateString;
function hasPendingInterpolations(input) {
    try {
        ensureAllInterpolations(input);
        return true;
    }
    catch (e) {
        return false;
    }
}
exports.hasPendingInterpolations = hasPendingInterpolations;
function ensureAllInterpolations(input) {
    var list = [];
    input.replace(reInterpolation, function (fulltext, scaped) {
        if (scaped == "\\")
            return;
        list.push(fulltext);
        return fulltext;
    });
    if (list.length)
        throw new Error("Could not resolve text interpolations " + JSON.stringify(list) + " on " + JSON.stringify(input));
}
exports.ensureAllInterpolations = ensureAllInterpolations;
//# sourceMappingURL=Interpolation.js.map
"use strict";
var LineMapper = (function () {
    function LineMapper(content, absPath) {
        this.content = content;
        this.absPath = absPath;
    }
    LineMapper.prototype.position = function (_pos) {
        var pos = _pos;
        this.initMapping();
        for (var i = 0; i < this.mapping.length; i++) {
            var lineLength = this.mapping[i];
            if (pos < lineLength) {
                return {
                    line: i,
                    column: pos,
                    position: _pos
                };
            }
            pos -= lineLength;
        }
        if (pos == 0) {
            return {
                line: this.mapping.length - 1,
                column: this.mapping[this.mapping.length - 1],
                position: this.content.length
            };
        }
        if (pos == 1) {
            // sometimes YAML library reports an error at a position of document length + 1, no idea what they want
            // to tell us that way
            return {
                line: this.mapping.length - 1,
                column: this.mapping[this.mapping.length - 1] - 1,
                position: _pos - 1
            };
        }
        throw new Error("Character position exceeds text length: " + _pos + " > + " + this.content.length + ". Unit path: " + this.absPath);
    };
    LineMapper.prototype.initMapping = function () {
        if (this.mapping != null) {
            return;
        }
        if (this.content == null) {
            throw new Error("Line Mapper has been given null content" + (this.absPath != null ? ('. Path: ' + this.absPath) : ' and null path.'));
        }
        this.mapping = [];
        var ind = 0;
        var l = this.content.length;
        for (var i = 0; i < l; i++) {
            if (this.content.charAt(i) == '\r') {
                if (i < l - 1 && this.content.charAt(i + 1) == '\n') {
                    this.mapping.push(i - ind + 2);
                    ind = i + 2;
                    i++;
                }
                else {
                    this.mapping.push(i - ind + 1);
                    ind = i + 1;
                }
            }
            else if (this.content.charAt(i) == '\n') {
                this.mapping.push(i - ind + 1);
                ind = i + 1;
            }
        }
        this.mapping.push(l - ind);
    };
    return LineMapper;
}());
exports.LineMapper = LineMapper;
//# sourceMappingURL=LineMapper.js.map
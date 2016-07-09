var Class = require("../class.js");

module.exports = Class({
  initialize: function(size) {
    this.currentPos = 0;
    this.size = (!!size && size > 0) ? size : 100;
    this.logs = [];
  },
  getLogs: function() {
    var list = [];
    for (var i = this.currentPos; i < this.size && i < this.logs.length; i++) {
      list.push(this.logs[i]);
    }
    for (var i = 0; i < this.currentPos && i < this.logs.length; i++) {
      list.push(this.logs[i]);
    }
    return list;
  },
  log: function(data) {
    this.logs[this.currentPos] = new Date().toISOString() + ' ' + data;
    this.currentPos = (this.currentPos + 1) % this.size;
  }
});

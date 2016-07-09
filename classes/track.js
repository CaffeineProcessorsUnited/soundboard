var Class = require("../class.js");

module.exports = Class({
  initialize: function(service, path, options) {
    this.service = service;
    this.path = path;
    this.time = (!!options && !!options["time"]) ? options["time"] : new Date().getTime();
    this.id = (!!options && !!options["id"]) ? options["id"] : crypto.createHash('sha1').update(this.service + '-' + this.time + '-' + this.path + ((!!options && !!options["idx"]) ? '-' + options["idx"] : ''), 'utf8').digest('hex');
    this.duration = -1;
    this.playback_time = -1;
  },
  getService: function() {
    return this.service;
  },
  getPath: function() {
    return this.path;
  },
  getTime: function() {
    return this.time;
  },
  getId: function() {
    return this.id;
  },
  setDuration: function(duration) {
    this.duration = duration;
  },
  getDuration: function() {
    return this.duration;
  },
  setPlaybackTime: function(time) {
    this.playback_time = time;
  },
  getPlaybackTime: function() {
    return this.playback_time;
  },
  validService: function(availableServices) {
    return this.getService() in availableServices;
  }
});

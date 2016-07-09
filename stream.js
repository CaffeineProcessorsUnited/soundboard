"use strict";
// Stream.js

var throttle = require('advanced-throttle');
var transcoder = require('stream-transcoder');
var ytdl = require('ytdl-core');

var Stream = function (cpu, config) {
    var _config;
    var _streams = {};
    var _latestStream;
    var _clients = {};
    var _loaders = {};
    var _cpu;

    var streamThroughFFmpeg = function(input) {
      if (input === undefined) {
        console.error("Empty stream");
        return;
      }
      if (_streams[_latestStream] && _streams[_latestStream] !== undefined) {
        _streams[_latestStream]["throttle"].end();
        _streams[_latestStream]["input"].end();
      }
      _latestStream = new Date().getTime();
      var me = 0 + _latestStream;
      var bitrate = _config["bitDepth"] * _config["sampleRate"] * _config["channels"];
      var t = new throttle({ bps: bitrate / 8 });
      _streams[me] = { throttle: t, input: input };

      var trans = new transcoder(input)
      .format('s' + _config["bitDepth"] + 'le')
      .sampleRate(_config["sampleRate"])
      .channels(_config["channels"])
      .audioBitrate(bitrate)
      .on('error', function() {
        console.error("Error while transcoding!");
        this._cpu.module("events").trigger("stream.end");
      });
      var a = trans._compileArguments();
      a.push('pipe:1');
      var ffmpegstream = trans._exec(a);
      ffmpegstream.stdout
      .pipe(t)
      .on('data', function(chunk) {
        if (_latestStream != me) {
      		return;
      	}
      	for (var k in _clients) {
      		if (_clients.hasOwnProperty(k) && _clients[k] !== undefined) {
      			_clients[k].write(chunk);
      		}
      	}
      })
      .on('end', function() {
        if (me == _latestStream) {
          this._cpu.module("events").trigger("stream.end");
        }
      }.bind(this));
    }

    // Constructor
    function Stream(cpu, config) {
        if (!(this instanceof Stream)) {
            return new Stream(cpu, config);
        }
        var defaults = {
          bitDepth: 16,
          sampleRate: 41100,
          channels: 2
        };
        _cpu = cpu;
        _config = _cpu.extend(defaults, config || {});
    }

    Stream.prototype.addLoader = function(service, loader) {
      _loaders[service] = loader;
    };

    Stream.prototype.delLoader = function(service) {
      delete _loaders[service];
    };

    Stream.prototype.addClient = function(id, stream) {
      _clients[id] = stream;
    };

    Stream.prototype.delClient = function(id) {
      delete _clients[id];
    };

    Stream.prototype.load = function(service, path) {
      this.stop();
      if (typeof service === "string" && _loaders[service] !== undefined) {
        _loaders[service].call(this, path);
      } else {
        this.play(service);
      }
    };

    Stream.prototype.play = function(input) {
      if (input !== undefined) {
        streamThroughFFmpeg.call(this, input);
      } else {
        _streams[_latestStream]["throttle"].resumeStream();
      }
    };

    Stream.prototype.pause = function() {
      _streams[_latestStream]["throttle"].pauseStream();
    };

    Stream.prototype.stop = function() {
      for (var k in _streams) {
    		if (_streams.hasOwnProperty(k) && _streams[k] != undefined) {
    			_streams[k]["throttle"].end();
    			delete _streams[k];
    		}
    	}
    };

    Stream.prototype.next = function(service, path) {
      this.stop();
      this.load(service, path);
    };

    return new Stream(cpu, config);
};
var exports = module.exports = Stream;

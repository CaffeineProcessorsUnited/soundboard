/**
  CPU - services
  Dependency: core, config, util, player
**/
(function() {
	var modulename = "services";
  var module = (function(modulename) {
    function module(options) {
      this.name = modulename;
      if (!options["cpu"]) {
        console.log("Can't load module \"" + this.name + "\"! You need to pass the cpu object.");
        return;
      }
      this.cpu = options["cpu"];
      this.request = require("request");
      this.ytdl = require("ytdl-core");
      this.fs = require("fs");
    }
    module.prototype.playService = function(track) {
      switch (track.getService()) {
        case "youtube":
          return this._playYoutubeDataSteam(track);
          break;
        case "soundcloud":
          return this._playSoundCloudDataStream(track);
          break;
        case "url":
          return this._playUrlDataStream(track);
          break;
        case "filesystem":
          return this._playFilesystemDataStream(track);
          break;
        default:
          cpu.module("util").log("Unknow Service");
      }
    };
    module.prototype._playYoutubeDataSteam = function(track) {
      var video = this.ytdl('http://youtube.com/watch?v=' + track.getPath(), {
				filter: function(format) {
					return format.container === 'mp4';
				},
				quality: 'lowest'
			});
      this._play(video);
    };
    module.prototype._playSoundCloudDataStream = function(track) {
			scapikey = cpu.module("config").get("services", "soundcloud", "apikey");
			url = 'http://api.soundcloud.com/resolve?format=json&consumer_key=' + scapikey + '&url=' + encodeURIComponent(track.getPath());
			var stream;
			this._genRequest(url, function(res) {
				res.setEncoding('utf8');
				res.on('data', function(data) {
					if (data) {
						json = JSON.parse(data);
						if (!!json["stream_url"] && !!json["streamable"]) {
                src = json["stream_url"] + (/\?/.test(json["stream_url"]) ? '&' : '?') + 'consumer_key=' + scapikey;
								this._play(src);
              } else {
                //next();
              }
					} else {
						//next();
					}
				});
    	});
			return stream;
		};
    module.prototype._playUrlDataStream = function(track) {
      this._genRequest(track.getPath(), function(res) {
        this._play(res);
      });
    };
    module.prototype._playFilesystemDataStream = function(track) {
			probe(path, function(err, data) {
				//var bps = data.format.bit_rate / 8; // bitrate / 8 => byterate
				this._play(fs.createReadStream(path));
			});
    };
    module.prototype._genRequest = function(url, onresponse, onerror) {
	    onerror = onerror || function(err) {
		    cpu.module("util").log(new Date().getTime() + ': Error', err);
	    };
	    onresponse = onresponse || function(res) {
		    cpu.module("util").log("You didn't handle the response! What are you tring to do?");
	    };
	    var r = request({
		    url: url,
		    forever: true
	    });
	    r.on('error', onerror);
	    r.on('response', onresponse);
	    r.end();
	    var t = setTimeout(function() {
		    if (!r['response']) {
			    cpu.module("util").log("No headers set... abort the request");
			    r.abort();
		    } else {
			    cpu.module("util").log("Header sent, we're streaming!");
		    }
	    }, 2000);
	    return { request: r, timeout: t };
    };

		module.prototype._play = function(resource) {
			cpu.module("player").play(resource);
		};
    return module;
  })(modulename);

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = module;
  } else {
    if (!window.cpumodules) {
      window.cpumodules = {};
    }
    window.cpumodules[modulename] = module;
  }
})();

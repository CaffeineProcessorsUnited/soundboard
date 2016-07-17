var ytdl = require('ytdl-core');
var fs = require('fs');
var request = require('request');

function createRequest(url, onresponse, onerror) {
	onerror = onerror || function(err) {
		console.log(new Date().getTime() + ': ÄRÖHR', err);
	};
	onresponse = onresponse || function(res) {
		console.log("You didn't handle the response! What are you tring to do?");
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
			console.log("No headers set... abort the request");
			r.abort();
		} else {
			console.log("Header sent, we're streaming!");
		}
	}, 2000);
	return { request: r, timeout: t };
}


module.exports = {
	"youtube": function(stream, path) {
		var video = ytdl('http://youtube.com/watch?v=' + path, {
			filter: function(format) {
				return format.container === 'mp4';
			},
			quality: 'lowest'
		});
		console.log(path);
    stream.play(video);
	},
	"soundcloud": function(stream, path) {
		scapikey = stream._cpu.module("config").get("services", "soundcloud", "apikey");
		url = 'http://api.soundcloud.com/resolve?format=json&consumer_key=' + scapikey + '&url=' + encodeURIComponent(path);
		createRequest(url, function(res) {
			res.setEncoding('utf8');
			res.on('data', function(data) {
				if (data) {
					json = JSON.parse(data);
					if (!!json["stream_url"] && !!json["streamable"]) {
            src = json["stream_url"] + (/\?/.test(json["stream_url"]) ? '&' : '?') + 'consumer_key=' + scapikey;
						stream.play(src);
          } else {
            //next();
          }
				} else {
					//next();
				}
			});
    });
	},
	"url": function (stream, path){
		createRequest(path, function(res) {
      stream.play(res);
    });
	},
	"filesystem": function (stream, path) {
		probe(path, function(err, data) {
			//var bps = data.format.bit_rate / 8; // bitrate / 8 => byterate
			stream.play(fs.createReadStream(path));
		});
	}
}

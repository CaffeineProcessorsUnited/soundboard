var ytdl = require('ytdl-core');
var fs = require('fs');
var request = require('request');
var spotify = require('spotify-web');

function createRequest(url, onresponse, onerror) {
	onerror = onerror || function(err) {
		console.log(new Date().getTime() + ': ÄRÖHR', err);
	};
	onresponse = onresponse || function(res) {
		console.log("You didn't handle the response! What are you tring to do?");
	};
	var r = request({
		url: encodeURI(url),
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
	"youtube": function(stream, track) {
		var video = ytdl('http://youtube.com/watch?v=' + encodeURI(track.getPath()), {
			filter: function(format) {
				return format.container === 'mp4';
			},
			quality: 'lowest'
		});
    stream.play({ "stream": video, "track": track });
	},
	"soundcloud": function(stream, track) {
		scapikey = stream.cpu().module("config").get("services", "soundcloud", "apikey");
		url = 'http://api.soundcloud.com/resolve?format=json&consumer_key=' + scapikey + '&url=' + encodeURI(track.getPath());
		createRequest(url, function(res) {
			res.setEncoding('utf8');
			res.on('data', function(data) {
				if (data) {
					json = JSON.parse(data);
					if (!!json["stream_url"] && !!json["streamable"]) {
            src = json["stream_url"] + (/\?/.test(json["stream_url"]) ? '&' : '?') + 'consumer_key=' + scapikey;
						stream.play({ "stream": src, "track": track });
          } else {
            //next();
          }
				} else {
					//next();
				}
			});
    });
	},
	"url": function (stream, track){
		createRequest(encodeURI(track.getPath()), function(res) {
      stream.play({ "stream": res, "track": track });
    });
	},
	"filesystem": function (stream, track) {
		stream.play({ "stream": fs.createReadStream(track.getPath()), "track": track });
	},
	"spotify": function (stream, track) {
		username = stream.cpu().module("config").get("services", "spotify", "username");
		password = stream.cpu().module("config").get("services", "spotify", "password");
		spotify.login(username, password, function(err, session) {
			if (err) {
				stream.cpu().module("util").log("Error" + err);
			}
			session.get(track.getPath(), function(err, music) {
				if (err) {
					stream.cpu().module("util").log("Error" + err);
				}
				
			});
		});
	}
}

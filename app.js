const util = require('util');
const crypto = require('crypto');
const fs = require('fs');

var express = require('express');
var web = express();
var server = require('http').Server(web);
var io = require('socket.io')(server);
var ioc = require('socket.io-client');

var playlists = JSON.parse(fs.readFileSync('playlists.json', 'utf8'));

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice(parseInt(to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

Array.prototype.insert = function(item, position) {
	if (!!position) {
		this.splice(position, 0, item);
	} else {
		this.push(item);
	}
};

var Class = function(methods) {
  var klass = function() {
    this.initialize.apply(this, arguments);
  };
  for (var property in methods) {
  	klass.prototype[property] = methods[property];
  }
  if (!klass.prototype.initialize) klass.prototype.initialize = function(){};
  return klass;
};

web.use(express.static('public'));

var logger = function(msg) {
	console.log(util.inspect(new Error().stack, false, null));
}

var classes = {
	"Queue": Class({
	  initialize: function() {
			this.queue = [];
	  },
		add: function(track) {
			this.queue.insert(track);
		},
		del: function(id) {
			for (var i = 0; i < this.queue.length; i++) {
				if (this.queue[i].getId() == id) {
					this.queue.delete(i);
					break;
				}
			}
		},
		list: function() {
			return this.queue;
		}
		clear: function() {
			for (var i = 0; i < this.queue.length; i++) {
				this.queue.delete(i);
			}
		},
		loadQueueFromPlaylist: function(name){
			if(playlists[name]){
				this.clear();
				playlists[name].tracks.forEach(function(trackinfo){
					this.add(new classes.Track(trackinfo.service, trackinfo.path));
				});
			}
		},
		saveQueueAsPlaylist: function(name){
			playlists[name]={
				tracks: []
			}
			this.queue.forEach(function(track){
				var trackinfo={
					service: track.getService(),
					path:	track.getPath()
				};
				playlists[name].tracks.insert(trackinfo);
			});
			fs.writeFile('playlists.json', JSON.stringify(playlists), 'utf-8');
		}
		}
	}),
	"Track": Class({
	  initialize: function(service, path, time) {
			this.service = service;
			this.path = path;
			this.time = time || new Date().getTime();
			this.id = crypto.createHash('sha1').update(this.service + '-' + this.time + '-' + this.path, 'utf8').digest('hex');
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
		validService: function(availableServices) {
			return this.getService() in availableServices;
		}
	})
};

var runtime = {
	"started":	new Date().getTime(),
	"logger": logger,
	"queue":		new classes.Queue(),
	"playlists": playlists
};

server.listen(8080, function () {
	console.log('Web interface is running on port 8080!');
	// api is used as a connection between POST requests and socket
	var api = express();
	var bodyParser = require("body-parser");
	api.use(bodyParser.urlencoded({ extended: false }));
	api.use(bodyParser.json());
	var client;

	api.get('*', function(req, res) {
		//console.log(generate_id('file', 'Witchqueen-of-Eldorado.mp3', started));
		client.emit('test');
		res.end('This api doesn\'t work through GET. Please switch to POST!');
	});

	api.post('*', function(req, res) {
		// req.body contains the json data sent as POST data
		client.emit('test');
		res.end('Not specified');
	});

	api.listen(3000, function () {
		console.log('Api is running on port 3000!');
		client = ioc('http://localhost:8080');
	});
});

io.on('connection', function(socket) {
	console.log('Client connected');
	socket.on('test', function() {
		console.log('Someone usccessfully tested something!');
		runtime.logger("test");
	});
	socket.on('add_track', function(data) {
		if (data.track) {
			var track = data.track;
			if (track.service && track.path) {
				runtime.queue.add(new classes.Track(track.service, track.path, track.time || undefined));
			} else {
				console.log('This doesn\'t seem to be a valid track.');
			}
		} else {
			console.log('What do you want from me?');
		}
	});
	socket.on('delete_track', function(data) {
		if (data.track) {
			if (data.track.id) {
				runtime.queue.del(data.track.id);
			} else {
				console.log('This track seems to be missing a id.');
			}
		} else {
			console.log('What do you want from me?');
		}
	});
	socket.on('reorder_track', function(data) {
		console.log('Someone usccessfully tested something!');
	});
	socket.on('get_queue', function(data) {
		console.log('Someone usccessfully tested something!');
	});
	socket.on('get_playlist', function(data) {
		if(data.name){
			io.to(socket.id).emit('get_playlist', { "tracks": runtime.playlists[data.name].tracks});
		} else {
			var playlistnames = [];
			for (var key in playlists) {
				playlistnames.insert(key);
			}
			io.to(socket.id).emit('get_playlist', {"playlists": playlistnames});
		}
	});
	socket.on('clear_queue', function() {
		console.log('Someone usccessfully tested something!');
	});
});

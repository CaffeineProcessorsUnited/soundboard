// @flow
const util = require('util');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

var callerId = require('caller-id');

var express = require('express');
var web = express();
var server = require('http').Server(web);
var io = require('socket.io')(server);
var ioc = require('socket.io-client');

var debug = true;

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.delete = function(from, to) {
  var rest = this.slice(parseInt(to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

Array.prototype.insert = function(item, position) {
  if (position!=undefined) {
    if(position<0){
      position = 0;
    }
    this.splice(position, 0, item);
  } else {
    this.push(item);
  }
};

function randomInt(low, high) {
  return Math.floor(Math.random * (high - low) + low);
}

var Class = function(methods) {
  var klass = function() {
    this.initialize.apply(this, arguments);
  };
  for (var property in methods) {
    klass.prototype[property] = methods[property];
  }
  if (!klass.prototype.initialize) klass.prototype.initialize = function() {};
  return klass;
};

web.use(express.static('public'));

var classes = {
  "Queue": Class({
    initialize: function() {
      this.queue = [];
      this.currentPos = -1;
      this.isShuffle = false;
      this.isRepeat = false;
    },
    add: function(track, position) {
      this.queue.insert(track, position);
    },
    del: function(id) {
      for (var i = 0; i < this.queue.length; i++) {
        if (this.queue[i].getId() == id) {
          this.queue.delete(i);
          if (this.isEmpty()) {
            this.currentPos = -1;
          }
          return i;
        }
      }
    },
    get: function(pos){
      return this.queue[pos];
    },
    list: function() {
      return this.queue;
    },
    swap: function(a, b) {
      if (a >= 0 && a < this.queue.length && b >= 0 && b < this.queue.length) {
        var tmp = this.queue[a];
        this.queue[a] = this.queue[b];
        this.queue[b] = tmp;
      }
    },
		clear: function() {
      while (this.queue.length > 0) {
        this.queue.delete(this.queue.length - 1);
      }
      this.currentPos = -1;
		},
    getCurrentTrack: function() {
      return (this.currentPos >= 0 && this.currentPos < this.queue.length) ? this.queue[this.currentPos] : undefined;
    },
    isEmpty: function() {
      return this.queue.length == 0;
    },
    prev: function() {
      this.currentPos = (this.currentPos + this.queue.length - 1)%this.queue.length;
    },
    next: function(position) {
      if (!!position) {
        this.currentPos = position;
      } else {
        if (this.isShuffel) {
          this.currentPos = randomInt(0, this.queue.length);
        } else {
          this.currentPos = (this.currentPos + 1) % this.queue.length;
        }
      }
    },
    getShuffle: function() {
      return this.isShuffle;
    },
    setShuffle: function(shuffle) {
      this.isShuffle = shuffle;
    },
    getRepeat: function() {
      return this.isRepeat;
    },
    setRepeat: function(repeat) {
      this.isRepeat = repeat;
    },
    getCurrentPosition: function() {
      return this.currentPos;
    },
    setCurrentPosition: function(pos) {
      this.currentPos=pos;
    },
		loadQueueFromPlaylist: function(name) {
			if (runtime.playlists[name]) {
        var self = this;
				this.clear();
        this.currentPos = 0;
				runtime.playlists[name].tracks.forEach(function(trackinfo, i) {
					self.add(new classes.Track(trackinfo.service, trackinfo.path, {idx: i}));
				});
			}
		},
		saveQueueAsPlaylist: function(name) {
			runtime.playlists[name]={
				tracks: []
			}
			this.queue.forEach(function(track) {
				var trackinfo = {
  				service: track.getService(),
					path:	track.getPath()
				};
				runtime.playlists[name].tracks.insert(trackinfo);
			});
			fs.writeFile('playlists.json', JSON.stringify(runtime.playlists), 'utf-8');
		}
  }),
  "Track": Class({
    initialize: function(service, path, options) {
      this.service = service;
      this.path = path;
      this.time = (!!options && !!options["time"]) ? options["time"] : new Date().getTime();
      this.id = (!!options && !!options["id"]) ? options["id"] : crypto.createHash('sha1').update(this.service + '-' + this.time + '-' + this.path + ((!!options && !!options["idx"]) ? '-' + options["idx"] : ''), 'utf8').digest('hex');
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

var runtime = new (function(undefined) {
    this.started = new Date().getTime();
    this.queue = new classes.Queue();
    this.playback_time = 0;
    this.playing = false;
    this.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    this.playlists = JSON.parse(fs.readFileSync('playlists.json', 'utf8'));
    this.log = function(msg) {
      var caller = callerId.getData();
      if (callerId.getString() == null) {
        console.log.apply(this, arguments);
      } else {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('LOG: ' + callerId.getDetailedString() + '():');
        console.log.apply(this, args);
      }
    };
    this.info = function() {
      var caller = callerId.getData();
      if (debug) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('INFO: ' + callerId.getDetailedString() + '():');
        console.log.apply(this, args);
      } else {
        console.log.apply(this, arguments);
      }
    };
    this.socketdata = function(socket) {
      // always return object as reference to the socket
      if (!socket['data']) {
        socket['data'] = {};
      }
      return socket['data'];
    };
    this.userLoggedin = function(socket) {
      return (!!this.socketdata(socket).user && !!this.socketdata(socket).user.authenticated);
    };
    this.readdir = function(base) {
      self = this;
      base = path.resolve('./', base);
      var list = {};
      try {
        var stats = fs.lstatSync(base)
        if (!!stats) {
          if (stats.isDirectory()) {
            var dirs = fs.readdirSync(base);
            if (!!dirs) {
              dirs.forEach(function(dir) {
                var file = path.relative('./', path.resolve(base, dir));
                list[dir] = self.readdir('./' + file);
              });
            }
          } else if (stats.isFile()) {
            var file = path.relative('./public/songs/filesystem/', path.resolve(base));
            return file;
          }
        }
      } catch(e) {
        console.log("Couldn't read files" + e);
      }
      return list;
    }
    this.getFiles = function() {
      return this.readdir('./public/songs/filesystem/');
    }
})();

server.listen(8080, function() {
  runtime.log('web player is running on port 8080!');
  // api is used as a connection between POST requests and socket
  var api = express();
  var bodyParser = require("body-parser");
  api.use(bodyParser.urlencoded({ extended: false }));
  api.use(bodyParser.json());
  var client;

  api.get('*', function apiGet(req, res) {
    //console.log(generate_id('file', 'Witchqueen-of-Eldorado.mp3', started));
    client.emit('test');
    res.end('This api doesn\'t work through GET. Please switch to POST!');
  });

  api.post('*', function apiPost(req, res) {
    // req.body contains the json data sent as POST data
    client.emit('test');
    res.end('Not specified');
  });

  api.listen(3000, function() {
    runtime.log('Api is running on port 3000!');
    client = ioc('http://localhost:8080');
    client.emit("getFiles");
  });
});

io.on('connection', function ioOnConnection(socket) {
  runtime.log('Client connected');
  socket.on('disconnect', function() {
    console.log('Client disconnected');
  });
  socket.on('test', function() {
    runtime.log('Someone successfully tested something!');
  });
  socket.on('login', function(data) {
    if (data.username && data.password) {
      runtime.log('I like turtles!');
      runtime.socketdata(socket).user.name = data.username;
      runtime.socketdata(socket).user.authenticated = true;
    } else {
      runtime.log('I can\'t use that information u gave me!', data);
    }
  });
  socket.on('logout', function() {
    runtime.socketdata(socket).user.authenticated = true;
    runtime.socketdata(socket).user = undefined;
  });
  socket.on('update', function() {
    io.to(socket.id).emit("poll");
  });
  socket.on('get_config', function() {
    io.to(socket.id).emit("get_config", runtime.config);
  });
  socket.on('add_track', function socketAddTrack(data) {
    if(!runtime.userLoggedin(socket)) {
      //return;
    }
    runtime.log(data);
    if (data["service"] && data['path']) {
      var track = new classes.Track(data['service'], data['path']);
      if (track.service && track.path) {
        if (track.service == "filesystem") {
          if (!path.resolve('./public/songs', track.path).startsWith(path.resolve('./public/songs') + '/')) {
            runtime.log('Invalid file path. The file must be inside the songs directory!');
            return;
          }
          track.path = path.relative('./public/songs/filesystem/', path.resolve('./public/songs/filesystem/', track.path));
        }
        if (track.service == "url") {
          if (!track.path.startsWith('http')) {
            runtime.log('Invalid url path. The file must be a http ot https url!');
            return;
          }
        }
        if(data["next"]) {
          var pos = runtime.queue.isEmpty() ? 0 : runtime.queue.getCurrentPosition() + 1;
          runtime.queue.add(new classes.Track(track.service, track.path, {time: track.time || undefined}), pos);
          runtime.queue.next(pos);
          runtime.playing = true;
          io.sockets.emit("poll");
        } else {
          var empty = runtime.queue.isEmpty();
          runtime.queue.add(new classes.Track(track.service, track.path, {time: track.time || undefined}));
          if (empty) {
            io.sockets.emit('poll');
          }
        }
        io.to(socket.id).emit("poll");
      } else {
        runtime.log('This doesn\'t seem to be a valid track.');
      }
    } else {
      runtime.log('What do you want from me?');
    }
  });
  socket.on('delete_track', function socketDeleteTrack(data) {
    if (data.id) {
      current = runtime.queue.getCurrentPosition();
      var i = runtime.queue.del(data.id);
      if (runtime.queue.isEmpty()) {
        runtime.playing = false;
      }
      if (current == i) {
        io.sockets.emit('poll');
      }
    } else {
      runtime.log('This track seems to be missing a id.');
    }
  });
  socket.on('reorder_track', function socketReorderTrack(data) {
    if (data.a && data.b) {
      runtime.queue.swap(data.a, data.b);
    } else {
      runtime.log('What did you try to achieve?');
    }
  });
  socket.on('get_queue', function socketGetQueue(data) {
    //runtime.log({ "queue": runtime.queue.list(), "currentTrack": runtime.queue.getCurrentTrack(), "repeat": runtime.queue.getRepeat(), "shuffle": runtime.queue.getShuffle() });
    io.to(socket.id).emit('get_queue', { "queue": runtime.queue.list(), "currentTrack": runtime.queue.getCurrentTrack(), "repeat": runtime.queue.getRepeat(), "shuffle": runtime.queue.getShuffle() });
  });
	socket.on('get_playlist', function(data) {
		if(!!data["name"]) {
			io.to(socket.id).emit('get_playlist_tracks', { "playlist": data["name"], "tracks": runtime.playlists[data['name']].tracks});
		} else {
			var playlistnames = [];
			for (var key in runtime.playlists) {
				playlistnames.insert(key);
			}
			io.to(socket.id).emit('get_playlist', {"playlists": playlistnames});
		}
	});
  socket.on('clear_queue', function socketClearQueue() {
    runtime.queue.clear();
    runtime.playback_time = 0;
    runtime.playing = false;
    io.sockets.emit("poll");
  });
  socket.on('get_current_track', function socketCurrentTrack() {
    io.to(socket.id).emit('get_current_track', {'currentTrack': runtime.queue.getCurrentTrack(), 'time': runtime.playback_time, 'playing': runtime.playing});
  });
  socket.on('next',function socketNextElement() {
    runtime.queue.next();
    runtime.playback_time = 0;
    io.sockets.emit("poll");
  });
  socket.on('prev', function socketPrevElement() {
    runtime.queue.prev();
    runtime.playback_time = 0;
    io.sockets.emit('poll');
  });
  socket.on('current_Time', function onCurrentTime(data) {
    runtime.log(data["time"]);
    runtime.playback_time = data["time"];
  });
  socket.on('play', function onPlay() {
    runtime.log("Play");
    runtime.playing = true;
    if (runtime.queue.getCurrentTrack() !== undefined) {
      io.sockets.emit("poll");
    }
  });
  socket.on("pause", function onPause() {
    runtime.log("Pause");
    runtime.playing = false;
    if (runtime.queue.getCurrentTrack() !== undefined) {
      io.sockets.emit("get_current_time");
      io.sockets.emit("poll");
    }
  });
  socket.on("stop", function onStop() {
    runtime.playback_time = 0;
    runtime.playing = false;
    io.sockets.emit("poll");
  });
  socket.on('isPlaying', function onIsPlaying() {
    io.to(socket.id).emit('isPlaying', {'playing': runtime.playing});
  });
  socket.on('save_queue_to_playlist', function onSaveQueueAsPlaylist(data){
    runtime.queue.saveQueueAsPlaylist(data.playlistname);
    io.sockets.emit("poll");
  });
  socket.on('delete_playlist', function socketDeletePlaylist(data){
    if (!!runtime.playlists[data.name]) {
      delete runtime.playlists[data.name];
      fs.writeFile('playlists.json', JSON.stringify(runtime.playlists), 'utf-8');
      io.sockets.emit("poll");
    }
  });
  socket.on('getFiles', function getFiles() {
    io.to(socket.id).emit('getFiles', {'files': runtime.getFiles()});
  });
  socket.on('playPlaylist', function onPlayPlaylist(data){
    if(data.name != '' && data.playing){
        runtime.queue.loadQueueFromPlaylist(data.name);
        runtime.playback_time = 0;
        runtime.playing = data.playing;
        io.sockets.emit('poll');
    }
  });
  socket.on('playtrack', function onPlaySelectedTrack(data){
    if(data.id){
      for(var i=0;i<runtime.queue.list().length;i++){
        if(runtime.queue.get(i).getId() == data.id){
          runtime.playback_time=0;
          runtime.playing = true;
          runtime.queue.setCurrentPosition(i);
          io.sockets.emit("poll");
          break;
        }
      }
    }
  });
  socket.on('toggleShuffle', function onToggleShuffle(){
    runtime.queue.setShuffle(!runtime.queue.getShuffle());
  });
  socket.on('toggleRepeat', function onToggleRepeat(){
    runtime.queue.setRepeat(!runtime.queue.getRepeat());
  });
  socket.on('chpos_of_track', function onChangeTrackPos(data){
    runtime.log(data)
    if(data.id && data.newpos!=undefined){
      var track;
      for(var i=0;i<runtime.queue.list().length;i++){
        if(runtime.queue.get(i).getId() == data.id){
          track = runtime.queue.get(i);
          break;
        }
      }
      runtime.queue.del(data.id);
      runtime.queue.add(track, data.newpos);
    }
  });
});

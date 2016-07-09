// @flow
const util = require('util');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const utf8 = require('utf8');

require('es6-shim');

var callerId = require('caller-id');

var express = require('express');
var web = express();
var server = require('http').Server(web);
var io = require('socket.io')(server);
var ioc = require('socket.io-client');
var childProcess = require('child_process')

var debug = true;

console.log(path.resolve("./"));
process.chdir(__dirname);
console.log(path.resolve("./"));

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
  return Math.floor(Math.random() * (high - low) + low);
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
  "Queue": require("./classes/queue.js"),
  "Track": require("./classes/track.js"),
  "Logger": require("./classes/logger.js")
};

var stream = require('./stream');
var s = new stream();
s.addLoader("file", function(path) {
	var file = fs.createReadStream(path);
	this.play(file);
});

var runtime = new (function(undefined) {
    this.started = new Date().getTime();
    this.queue = new classes.Queue();
    this.playback_time = 0;
    this.playing = false;
    this.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    this.playlists = JSON.parse(fs.readFileSync('playlists.json', 'utf8'));
    this.serverlog = new classes.Logger();
    this.clients = {};
    this.log = function() {
      var caller = callerId.getData();
      var string = util.format.apply(null, arguments);
      if (!!callerId.getString()) {
        string = 'LOG: ' + callerId.getDetailedString() + '(): ' + string;
      }
      this.serverlog.log(string);
      console.log(string);
    };
    this.info = function() {
      var caller = callerId.getData();
      var string = util.format.apply(null, arguments);
      if (debug && !!callerId.getString()) {
        string = 'INFO: ' + callerId.getDetailedString() + '(): ' + string;
      }
      this.serverlog.log(string);
      console.log(string);
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
      //xss testing var list = {"<script>window.alert('xss');</script>": "\"><script>window.alert('xss');</script>"};
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
    res.end('This api doesn\'t work through GET. Please switch to POST!');
  });

  api.post('*', function apiPost(req, res) {
    // req.body contains the json data sent as POST data
		if (!!req.body) {
			json = req.body;
			if (!!json.unique && !!json.data) {
				userid = json.unique;
				command = json.data;
				// TODO Check if user is allowed to send this command
				i = command.indexOf(" ");
				action = command;
				payload = "";
				if (i > 0) {
					action = command.slice(0, i);
					payload = command.slice(i).trim();
				}
				i = payload.indexOf(" ");
				if (i > 0) {
					payload = payload.slice(0, i);
				}
				if (action.length > 1) {
					action = action.slice(1);
				}
				service = "";
				if (!!runtime.config["services"][action]) {
					service = action;
				}
				if (service != "" && payload != "") {
					client.emit("add_track", {"service": service, "path": payload,'next': false});
				} else {
					runtime.log("I didn't understand ur command!");
				}
			} else {
				runtime.log("Malformed POST data");
				runtime.log(json);
			}
		} else {
			runtime.log("request is missing the data to interpret!");
		}
    res.end('Not specified');
  });

  api.listen(3000, function() {
    runtime.log('Api is running on port 3000!');
    client = ioc('http://localhost:8080');
  });
});

io.on('connection', function ioOnConnection(socket) {
  runtime.clients[socket.id] = {
    logger: new classes.Logger()
  };
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
  socket.on('log', function(data) {
    if (!!data["log"]) {
      runtime.clients[socket.id]["logger"].log(data["log"]);
      io.sockets.emit("onlog");
    }
  });
  socket.on('get_logs', function() {
    var clients = {};
    for (var k in runtime.clients) {
      if (runtime.clients.hasOwnProperty(k)) {
        var logs = runtime.clients[k]["logger"].getLogs();
        if (logs.length > 0) {
          clients[k] = {
            name: (!!runtime.clients[k]["name"]) ? runtime.clients[k]["name"] : k,
            logs: logs
          };
        }
      }
    }
    io.to(socket.id).emit("get_logs", { 'server': runtime.serverlog.getLogs(), 'clients': clients });
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
          if (!track["path"].startsWith('http')) {
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
      io.sockets.emit('poll');
    } else {
      runtime.log('What did you try to achieve?');
    }
  });
  socket.on('get_queue', function socketGetQueue(data) {
    io.to(socket.id).emit('get_queue', {
      "queue": runtime.queue.list(),
      "currentTrack": runtime.queue.getCurrentTrack(),
      "repeat": runtime.queue.getRepeat(),
      "shuffle": runtime.queue.getShuffle()
    });
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
    io.to(socket.id).emit('get_current_track', {'currentTrack': runtime.queue.getCurrentTrack(), 'time': runtime.playback_time, 'playing': runtime.playing, 'changed': runtime.queue.getTrackChanged() });
  });
  socket.on('next',function socketNextElement(data) {
    runtime.queue.next(undefined, (!!data && !!data["force"]));
    runtime.playback_time = 0;
    io.sockets.emit("poll");
  });
  socket.on('prev', function socketPrevElement() {
    runtime.queue.prev();
    runtime.playback_time = 0;
    io.sockets.emit('poll');
  });
  socket.on('current_Time', function onCurrentTime(data) {
    if (!!data["time"]) {
      runtime.playback_time = data["time"];
    }
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
    runtime.queue.setCurrentPosition(-1);
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
  socket.on('playPlaylist', function onPlayPlaylist(data) {
    if (data.name != '' && data.playing) {
        runtime.queue.loadQueueFromPlaylist(data.name);
        runtime.playback_time = 0;
        runtime.playing = data.playing;
        io.sockets.emit('poll');
    }
  });
  socket.on('playtrack', function onPlaySelectedTrack(data) {
    if (data.id) {
      i = runtime.queue.getPos(data.id);
      if (i >= 0) {
        runtime.playback_time=0;
        runtime.playing = true;
        runtime.queue.setCurrentPosition(i);
        io.sockets.emit("poll");
      }
    }
  });
  socket.on('toggleShuffle', function onToggleShuffle() {
    runtime.queue.setShuffle(!runtime.queue.getShuffle());
  });
  socket.on('toggleRepeat', function onToggleRepeat() {
    runtime.queue.setRepeat((runtime.queue.getRepeat() + 1) % 3);
  });
  socket.on('chpos_of_track', function onChangeTrackPos(data) {
    runtime.log(data);
    if (data.id && data.newpos != undefined && data.newpos >= 0 && data.newpos < runtime.queue.size()) {
      var i = runtime.queue.getPos(data.id);
      if (i >= 0) {
        var track = runtime.queue.get(i);
        runtime.queue.del(data.id);
        runtime.queue.add(track, data.newpos);
        if (runtime.queue.getCurrentPosition() == i) {
          runtime.queue.setCurrentPosition(data.newpos);
        }
      }
    }
  });
  socket.on('seek', function onSeek(data) {
    if (data && data.position && data.position >= 0) {
      console.log(data.position);
      runtime.playback_time = data.position;
      io.sockets.emit("poll");
    }
  });
  socket.on('getDuration', function onGetDuration(data) {
    if (data && data.id) {
      var i = runtime.queue.getPos(data.id);
      if (i >= 0) {
        io.to(socket.id).emit('getDuration', {'duration': runtime.queue.get(i).getDuration() });
      }
    } else {
      io.to(socket.id).emit('getDuration', {'duration': runtime.queue.getCurrentTrack().getDuration() });
    }
  });
  socket.on('setDuration', function onSetDuration(data) {
    changed = false;
    if (data.duration && data.duration >= 0) {
      if (data.id) {
        var i = runtime.queue.getPos(data.id);
        if (i >= 0) {
          changed = (runtime.queue.get(i).getDuration() != data.duration);
          runtime.queue.get(i).setDuration(data.duration);
        }
      } else {
        changed = (runtime.queue.getCurrentTrack().getDuration() != data.duration);
        runtime.queue.getCurrentTrack().setDuration(data.duration);
      }
      if (changed) {
        io.sockets.emit("durationChanged");
      }
    }
  });
  socket.on('getPlaybackTime', function onGetPlaybackTime(data) {
    /*
    if (data.id) {
      var i = runtime.queue.getPos(data.id);
      if (i >= 0) {
        io.to(socket.id).emit('getPlaybackTime', {'time': runtime.queue.get(i) });
      }
    } else {
      io.to(socket.id).emit('getPlaybackTime', {'time': runtime.queue.getCurrentTrack() });
    }
    */
    io.to(socket.id).emit('getPlaybackTime', {'time': runtime.playback_time });
  });
  socket.on('setPlaybackTime', function onSetPlaybackTime(data) {
    /*
    if (data.id) {
      var i = runtime.queue.getPos(data.id);
      if (i >= 0) {
        runtime.queue.get(i).setPlaybackTime(data.time);
      }
    } else {
      runtime.queue.getCurrentTrack().setPlaybackTime(data.time);
    }
    */
    if (data.time) {
      runtime.playback_time = data.time;
    }
    io.sockets.emit("playbackTimeChanged");
  });
});

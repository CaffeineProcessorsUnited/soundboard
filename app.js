// @flow
const util = require('util');
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

web.use(express.static('public'));

var classes = {
  "Queue": require("./classes/queue.js"),
  "Track": require("./classes/track.js"),
  "Logger": require("./classes/logger.js")
};

/*
var stream = require('./stream');
var s = new stream();
s.addLoader("file", function(path) {
	var file = fs.createReadStream(path);
	this.play(file);
});
*/
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

var cpu = require("./public/assets/js/cpu/cpu.js");
cpu.loadModule(require("./public/assets/js/cpu/util.cpu.js"), { "utils": require('util')});
cpu.loadModule(require("./public/assets/js/cpu/events.cpu.js"));
cpu.loadModule(require("./public/assets/js/cpu/socket.cpu.js"), { "io" : io, "server": true });

io.on('connection', function ioOnConnection(socket) {
  runtime.clients[socket.id] = {
    logger: new classes.Logger()
  };
  runtime.log('Client connected');
  cpu.module("socket").on('disconnect', {
    onreceive: function(cpu) {
      console.log('Client disconnected');
    }
  }, socket);
  cpu.module("socket").on('test', {
    onreceive: function(cpu) {
      runtime.log('Someone successfully tested something!');
    }
  }, socket);
  cpu.module("socket").on('login', {
    onreceive: function(cpu, data) {
      if (data.username && data.password) {
        runtime.log('I like turtles!');
        runtime.socketdata(socket).user.name = data.username;
        runtime.socketdata(socket).user.authenticated = true;
      } else {
        runtime.log('I can\'t use that information u gave me!', data);
      }
    }
  }, socket);
  cpu.module("socket").on('logout', {
    onreceive: function(cpu) {
      runtime.socketdata(socket).user.authenticated = true;
      runtime.socketdata(socket).user = undefined;
    }
  }, socket);
  cpu.module("socket").on('update', {
    onreceive: function(cpu) {
      cpu.module("socket").emit("poll");
    }
  }, socket);
  cpu.module("socket").on('log', {
    onreceive: function(cpu, data) {
      if (!!data["log"]) {
        runtime.clients[socket.id]["logger"].log(data["log"]);
        cpu.module("socket").emit("onlog"); //TODO just to socket.id
      }
    }
  }, socket);
  cpu.module("socket").on('get_logs', {
    onreceive: function(cpu) {
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
      cpu.module("socket").emit("get_logs", { 'server': runtime.serverlog.getLogs(), 'clients': clients }, socket.id);
    }
  }, socket);
  cpu.module("socket").on('get_config', {
    onreceive: function(cpu) {
      cpu.module("socket").emit("get_config", runtime.config, socket.id);
    }
  }, socket);
  cpu.module("socket").on('add_track', {
    onreceive: function socketAddTrack(cpu, data) {
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
            cpu.module("socket").emit("poll");
          } else {
            var empty = runtime.queue.isEmpty();
            runtime.queue.add(new classes.Track(track.service, track.path, {time: track.time || undefined}));
            if (empty) {
              cpu.module("socket").emit('poll');
            }
          }
          cpu.module("socket").emit("poll", {}, socket.id);
        } else {
          runtime.log('This doesn\'t seem to be a valid track.');
        }
      } else {
        runtime.log('What do you want from me?');
      }
    }
  }, socket);
  cpu.module("socket").on('delete_track', {
    onreceive: function socketDeleteTrack(cpu, data) {
      if (data.id) {
        current = runtime.queue.getCurrentPosition();
        var i = runtime.queue.del(data.id);
        if (runtime.queue.isEmpty()) {
          runtime.playing = false;
        }
        if (current == i) {
          cpu.module("socket").emit('poll');
        }
      } else {
        runtime.log('This track seems to be missing a id.');
      }
    }
  }, socket);
  cpu.module("socket").on('reorder_track', {
    onreceive:function socketReorderTrack(cpu, data) {
      if (data.a && data.b) {
        runtime.queue.swap(data.a, data.b);
        cpu.module("socket").emit('poll');
      } else {
        runtime.log('What did you try to achieve?');
      }
    }
  }, socket);
  cpu.module("socket").on('get_queue', {
    onreceive: function socketGetQueue(cpu, data) {
      cpu.module("socket").emit('get_queue', {
        "queue": runtime.queue.list(),
        "currentTrack": runtime.queue.getCurrentTrack(),
        "repeat": runtime.queue.getRepeat(),
        "shuffle": runtime.queue.getShuffle()
      }, socket.id);
    }
  }, socket);
  cpu.module("socket").on('get_playlist', {
    onreceive: function(cpu, data) {
     if(!!data["name"]) {
       cpu.module("socket").emit('get_playlist_tracks', { "playlist": data["name"], "tracks": runtime.playlists[data['name']].tracks}, socket.id);
     } else {
		   var playlistnames = [];
		   for (var key in runtime.playlists) {
			    playlistnames.insert(key);
		   }
		   cpu.module("socket").emit('get_playlist', {"playlists": playlistnames}, socket.id);
       }
    }
  }, socket);
  cpu.module("socket").on('clear_queue', {
    onreceive: function socketClearQueue(cpu) {
      runtime.queue.clear();
      runtime.playback_time = 0;
      runtime.playing = false;
      cpu.module("socket").emit("poll");
    }
  }, socket);
  cpu.module("socket").on('get_current_track', {
    onreceive: function socketCurrentTrack(cpu) {
      //TODO with cpu.module
      cpu.module("socket").emit('get_current_track', {'currentTrack': runtime.queue.getCurrentTrack(), 'time': runtime.playback_time, 'playing': runtime.playing, 'changed': runtime.queue.getTrackChanged() });
    }
  }, socket);
  cpu.module("socket").on('next', {
    onreceive: function socketNextElement(cpu, data) {
      runtime.queue.next(undefined, (!!data && !!data["force"]));
      runtime.playback_time = 0;
      cpu.module("socket").emit("poll");
    }
  }, socket);
  cpu.module("socket").on('prev', {
    onreceive: function socketPrevElement(cpu) {
      runtime.queue.prev();
      runtime.playback_time = 0;
      cpu.module("socket").emit('poll');
    }
  }, socket);
  cpu.module("socket").on('current_Time', {
    onreceive: function onCurrentTime(cpu, data) {
      if (!!data["time"]) {
        runtime.playback_time = data["time"];
      }
    }
  }, socket);
  cpu.module("socket").on('play', {
    onreceive: function onPlay(cpu) {
      runtime.log("Play");
      runtime.playing = true;
      if (runtime.queue.getCurrentTrack() !== undefined) {
        cpu.module("socket").emit("poll");
      }
    }
  }, socket);
  cpu.module("socket").on("pause", {
    onreceive: function onPause(cpu) {
      runtime.log("Pause");
      runtime.playing = false;
      if (runtime.queue.getCurrentTrack() !== undefined) {
        cpu.module("socket").emit("get_current_time");
        cpu.module("socket").emit("poll");
      }
    }
  }, socket);
  cpu.module("socket").on("stop", {
    onreceive: function onStop(cpu) {
      runtime.queue.setCurrentPosition(-1);
      runtime.playback_time = 0;
      runtime.playing = false;
      cpu.module("socket").emit("poll");
    }
  }, socket);
  cpu.module("socket").on('isPlaying', {
    onreceive: function onIsPlaying(cpu) {
      cpu.module("socket").emit('isPlaying', {'playing': runtime.playing}, socket.id);
    }
  }, socket);
  cpu.module("socket").on('save_queue_to_playlist', {
    onreceive: function onSaveQueueAsPlaylist(cpu, data){
      runtime.queue.saveQueueAsPlaylist(data.playlistname);
      cpu.module("socket").emit("poll");
    }
  }, socket);
  cpu.module("socket").on('delete_playlist', {
    onreceive: function socketDeletePlaylist(cpu, data){
      if (!!runtime.playlists[data.name]) {
        delete runtime.playlists[data.name];
        fs.writeFile('playlists.json', JSON.stringify(runtime.playlists), 'utf-8');
        cpu.module("socket").emit("poll");
      }
    }
  }, socket);
  cpu.module("socket").on('getFiles', {
    onreceive: function getFiles(cpu) {
      cpu.module("socket").emit('getFiles', {'files': runtime.getFiles()});
    }
  }, socket);
  cpu.module("socket").on('playPlaylist', {
    onreceive: function onPlayPlaylist(cpu, data) {
      if (data.name != '' && data.playing) {
        runtime.queue.loadQueueFromPlaylist(data.name);
        runtime.playback_time = 0;
        runtime.playing = data.playing;
        cpu.module("socket").emit('poll');
      }
    }
  }, socket);
  cpu.module("socket").on('playtrack', {
    onreceive: function onPlaySelectedTrack(cpu, data) {
      if (data.id) {
        i = runtime.queue.getPos(data.id);
        if (i >= 0) {
          runtime.playback_time=0;
          runtime.playing = true;
          runtime.queue.setCurrentPosition(i);
          cpu.module("socket").emit("poll");
        }
      }
    }
  }, socket);
  cpu.module("socket").on('toggleShuffle', {
    onreceive: function onToggleShuffle(cpu) {
      runtime.queue.setShuffle(!runtime.queue.getShuffle());
    }
  }, socket);
  cpu.module("socket").on('toggleRepeat', {
    onreceive: function onToggleRepeat(cpu) {
      runtime.queue.setRepeat((runtime.queue.getRepeat() + 1) % 3);
    }
  }, socket);
  cpu.module("socket").on('chpos_of_track', {
    onreceive: function onChangeTrackPos(cpu, data) {
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
    }
  }, socket);
  cpu.module("socket").on('seek', {
    onreceive: function onSeek(cpu, data) {
      if (data && data.position && data.position >= 0) {
        console.log(data.position);
        runtime.playback_time = data.position;
        socket.module("socket").emit("poll");
      }
    }
  }, socket);
  cpu.module("socket").on('getDuration', {
    onreceive: function onGetDuration(cpu, data) {
      if (data && data.id) {
        var i = runtime.queue.getPos(data.id);
        if (i >= 0) {
          cpu.module("socket").emit('getDuration', {'duration': runtime.queue.get(i).getDuration() }, socket.id);
        }
      } else {
        cpu.module("socket").emit('getDuration', {'duration': runtime.queue.getCurrentTrack().getDuration() }, socket.id);
      }
    }
  }, socket);
  cpu.module("socket").on('setDuration', {
    onreceive: function onSetDuration(cpu, data) {
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
          cpu.module("socket").emit("durationChanged");
        }
      }
    }
  }, socket);
  cpu.module("socket").on('getPlaybackTime', {
    onreceive: function onGetPlaybackTime(cpu, data) {
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
      cpu.module("socket").emit('getPlaybackTime', {'time': runtime.playback_time }, socket.id);
    }
  }, socket);
  cpu.module("socket").on('setPlaybackTime', {
    onreceive: function onSetPlaybackTime(cpu, data) {
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
      cpu.module("socket").emit("playbackTimeChanged");
    }
  }, socket);
});

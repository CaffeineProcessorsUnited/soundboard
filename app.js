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

server.listen(8080, function() {
  cpu.module("util").log('web player is running on port 8080!');
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
				if (!!cpu.module("runtime").get("config")["services"][action]) {
					service = action;
				}
				if (service != "" && payload != "") {
					client.emit("add_track", {"service": service, "path": payload,'next': false});
				} else {
					cpu.module("util").log("I didn't understand ur command!");
				}
			} else {
				cpu.module("util").log("Malformed POST data");
				cpu.module("util").log(json);
			}
		} else {
			cpu.module("util").log("request is missing the data to interpret!");
		}
    res.end('Not specified');
  });

  api.listen(3000, function() {
    cpu.module("util").log('Api is running on port 3000!');
    client = ioc('http://localhost:8080');
  });
});

var cpu = require("./public/assets/js/cpu/cpu.js");
cpu.loadModule(require("./public/assets/js/cpu/util.cpu.js"), { "utils": require('util')});
cpu.loadModule(require("./public/assets/js/cpu/events.cpu.js"));
cpu.loadModule(require("./public/assets/js/cpu/socket.cpu.js"), { "io" : io, "server": true });
cpu.loadModule(require("./runtime.cpu.js"));

cpu.module("runtime").set("started", new Date().getTime());
cpu.module("runtime").set("queue", new classes.Queue());
cpu.module("runtime").set("playback_time", 0);
cpu.module("runtime").set("playing", false);
cpu.module("runtime").set("config", JSON.parse(fs.readFileSync('config.json', 'utf8')));
cpu.module("runtime").set("playlists", JSON.parse(fs.readFileSync('playlists.json', 'utf8')));
cpu.module("runtime").set("serverlog", new classes.Logger());
cpu.module("runtime").set("clients", {});
// TODO: rethink socketdata and userLoggedin
/*
*  cpu.module("runtime").set("socketdata", function(socket) {
*    // always return object as reference to the socket
*    if (!socket['data']) {
*      socket['data'] = {};
*    }
*    return socket['data'];
*  });
*  cpu.module("runtime").set("userLoggedin", function(socket) {
*    return (!!this.socketdata(socket).user && !!this.socketdata(socket).user.authenticated);
*  });
*/
var Speaker = require('speaker');
var speaker = new Speaker({
  channels: 2,          // 2 channels
  bitDepth: 16,         // 16-bit samples
  sampleRate: 44100     // 44,100 Hz sample rate
});
var loaders = require('./service.loaders.js')
var stream = require('./stream.js')(cpu);
stream.addClient("speaker", speaker);
for (var k in loaders) {
  if (typeof loaders[k] == 'function') {
    stream.addLoader(k, loaders[k]);
  }
}

io.on('connection', function ioOnConnection(socket) {
  cpu.module("runtime").set("clients", socket.id, "logger", new classes.Logger());
  cpu.module("util").log('Client connected');
  cpu.module("socket").registerSocket(socket);
});

cpu.module("socket").on('disconnect', {
  onreceive: function(cpu, context) {
    var socket = context["socket"]
    cpu.module("util").log('Client disconnected');
    cpu.module("runtime").delete("clients", socket.id);
  }
});
cpu.module("socket").on('test', {
  onreceive: function(cpu, context) {
    var socket = context["socket"];
    cpu.module("util").log('Someone successfully tested something!');
  }
});
cpu.module("socket").on('login', {
  //TODO change login
  onreceive: function(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (data.username && data.password) {
      cpu.module("util").log('I like turtles!');
    } else {
      cpu.module("runtime").log('I can\'t use that information u gave me!', data);
    }
  }
});
cpu.module("socket").on('logout', {
  //TODO change logout same as login
  onreceive: function(cpu, socket) {
    var socket = context["socket"];
  }
});
cpu.module("socket").on('update', {
  onreceive: function(cpu, context) {
    var socket = context["socket"];
    cpu.module("socket").emit("poll");
  }
});
cpu.module("socket").on('log', {
  onreceive: function(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (!!data["log"]) {
      cpu.module("runtime").get("clients", socket.id, "logger").log(data["log"]);
      cpu.module("socket").emit("onlog");
    }
  }
});
cpu.module("socket").on('get_logs', {
  onreceive: function(cpu, context) {
    var socket = context["socket"];
    var clients = {};
    for (var k in cpu.module("runtime").get("clients")) {
      if (cpu.module("runtime").get("clients").hasOwnProperty(k)) {
        var cli = cpu.module("runtime").get("clients")[k];
        var logs = cli["logger"].getLogs();
        if (logs.length > 0) {
          clients[k] = {
            name: (!!cli["name"]) ? cli["name"] : k,
            logs: logs
          };
        }
      }
    }
    cpu.module("socket").emit("get_logs", { 'server': cpu.module("runtime").set("serverlog").getLogs(), 'clients': clients }, socket.id);
  }
});
cpu.module("socket").on('get_config', {
  onreceive: function(cpu, context) {
    var socket = context["socket"];
    cpu.module("socket").emit("get_config", cpu.module("runtime").get("config"), socket.id);
  }
});
cpu.module("socket").on('add_track', {
  onreceive: function socketAddTrack(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    cpu.module("util").log(data);
    if (data["service"] && data['path']) {
      var track = new classes.Track(data['service'], data['path']);
      if (track.service && track.path) {
        if (track.service == "filesystem") {
          if (!path.resolve('./public/songs', track.path).startsWith(path.resolve('./public/songs') + '/')) {
            cpu.module("util").log('Invalid file path. The file must be inside the songs directory!');
            return;
          }
          track.path = path.relative('./public/songs/filesystem/', path.resolve('./public/songs/filesystem/', track.path));
        }
        if (track.service == "url") {
          if (!track["path"].startsWith('http')) {
            cpu.module("util").log('Invalid url path. The file must be a http ot https url!');
            return;
          }
        }
        if(data["next"]) {
          var pos = cpu.module("runtime").get("queue").isEmpty() ? 0 : cpu.module("runtime").get("queue").getCurrentPosition() + 1;
          cpu.module("runtime").get("queue").add(new classes.Track(track.service, track.path, {time: track.time || undefined}), pos);
          cpu.module("runtime").get("queue").next(pos);
          cpu.module("runtime").set("playing", true);
          cpu.module("socket").emit("poll");
          var track = cpu.module("runtime").get("queue").getCurrentTrack();
          stream.load(track.getService(), track.getPath());
        } else {
          var empty = cpu.module("runtime").get("queue").isEmpty();
          cpu.module("runtime").get("queue").add(new classes.Track(track.service, track.path, {time: track.time || undefined}));
          if (empty) {
            cpu.module("socket").emit('poll');
          }
        }
        cpu.module("socket").emit("poll");
      } else {
        cpu.module("util").log('This doesn\'t seem to be a valid track.');
      }
    } else {
      cpu.module("util").log('What do you want from me?');
    }
  }
});
cpu.module("socket").on('delete_track', {
  onreceive: function socketDeleteTrack(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (data.id) {
      current = cpu.module("runtime").get("queue").getCurrentPosition();
      var i = cpu.module("runtime").get("queue").del(data.id);
      if (cpu.module("runtime").get("queue").isEmpty()) {
        cpu.module("runtime").set("playing", false);
      }
      if (current == i) {
        cpu.module("socket").emit('poll');
      }
    } else {
      cpu.module("util").log('This track seems to be missing a id.');
    }
  }
});
cpu.module("socket").on('reorder_track', {
  onreceive:function socketReorderTrack(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (data.a && data.b) {
      cpu.module("runtime").get("queue").swap(data.a, data.b);
      cpu.module("socket").emit('poll');
    } else {
      cpu.module("util").log('What did you try to achieve?');
    }
  }
});
cpu.module("socket").on('get_queue', {
  onreceive: function socketGetQueue(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    cpu.module("socket").emit('get_queue', {
      "queue": cpu.module("runtime").get("queue").list(),
      "currentTrack": cpu.module("runtime").get("queue").getCurrentTrack(),
      "repeat": cpu.module("runtime").get("queue").getRepeat(),
      "shuffle": cpu.module("runtime").get("queue").getShuffle()
    }, socket.id);
  }
});
cpu.module("socket").on('get_playlist', {
  onreceive: function(cpu, context) {
   var socket = context["socket"];
   var data = context["data"];
   if(!!data["name"]) {
     cpu.module("socket").emit('get_playlist_tracks', { "playlist": data["name"], "tracks": cpu.module("runtime").get("playlists")[data['name']].tracks}, socket.id);
   } else {
	   var playlistnames = [];
	   for (var key in cpu.module("runtime").get("playlists")) {
		    playlistnames.insert(key);
	   }
	   cpu.module("socket").emit('get_playlist', {"playlists": playlistnames}, socket.id);
     }
  }
});
cpu.module("socket").on('clear_queue', {
  onreceive: function socketClearQueue(cpu, context) {
    var socket = context["socket"];
    cpu.module("runtime").get("queue").clear();
    cpu.module("runtime").set("playback_time", 0);
    cpu.module("runtime").set("playing", false);
    cpu.module("socket").emit("poll");
  }
});
cpu.module("socket").on('get_current_track', {
  onreceive: function socketCurrentTrack(cpu, context) {
    var socket = context["socket"];
    cpu.module("socket").emit('get_current_track', {'currentTrack': cpu.module("runtime").get("queue").getCurrentTrack(),
                                                      'time': cpu.module("runtime").get("playback_time"),
                                                       'playing': cpu.module("runtime").get("playing"),
                                                        'changed': cpu.module("runtime").get("queue").getTrackChanged()
                                                       }, socket.id);
  }
});
cpu.module("socket").on('next', {
  onreceive: function socketNextElement(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    cpu.module("runtime").get("queue").next(undefined, (!!data && !!data["force"]));
    cpu.module("runtime").set("playback_time", 0);
    cpu.module("socket").emit("poll");
    var track = cpu.module("runtime").get("queue").getCurrentTrack();
    stream.load(track.getService(), track.getPath());
  }
});
cpu.module("socket").on('prev', {
  onreceive: function socketPrevElement(cpu, context) {
    var socket = context["socket"];
    cpu.module("runtime").get("queue").prev();
    cpu.module("runtime").set("playback_time", 0);
    cpu.module("socket").emit('poll');
    var track = cpu.module("runtime").get("queue").getCurrentTrack();
    stream.load(track.getService(), track.getPath());
  }
});
cpu.module("socket").on('current_Time', {
  onreceive: function onCurrentTime(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (!!data["time"]) {
      cpu.module("runtime").set("playback_time", data["time"]);
    }
  }
});
cpu.module("socket").on('play', {
  onreceive: function onPlay(cpu, context) {
    var socket = context["socket"];
    cpu.module("util").log("Play");
    cpu.module("runtime").set("playing", true);
    if (cpu.module("runtime").get("queue").getCurrentTrack() !== undefined) {
      cpu.module("socket").emit("poll");
      stream.play();
    }
  }
});
cpu.module("socket").on("pause", {
  onreceive: function onPause(cpu, context) {
    var socket = context["socket"];
    cpu.module("util").log("Pause");
    cpu.module("runtime").set("playing", false);
    if (cpu.module("runtime").get("queue").getCurrentTrack() !== undefined) {
      cpu.module("socket").emit("get_current_time");
      cpu.module("socket").emit("poll");
      stream.pause();
    }
  }
});
cpu.module("socket").on("stop", {
  onreceive: function onStop(cpu, context) {
    var socket = context["socket"];
    cpu.module("runtime").get("queue").setCurrentPosition(-1);
    cpu.module("runtime").set("playback_time", 0);
    cpu.module("runtime").set("playing", false);
    cpu.module("socket").emit("poll");
    stream.stop();
  }
});
cpu.module("socket").on('isPlaying', {
  onreceive: function onIsPlaying(cpu, context) {
    var socket = context["socket"];
    cpu.module("socket").emit('isPlaying', {'playing': cpu.module("runtime").get("playing")}, socket.id);
  }
});
cpu.module("socket").on('save_queue_to_playlist', {
  onreceive: function onSaveQueueAsPlaylist(cpu, context){
    var socket = context["socket"];
    var data = context["data"];
    var currentQueue = cpu.module("runtime").get("queue");
    var playlist = []
    for ( var i=0; i<currentQueue.size(); i++) {
      var item = {};
      item["service"] = currentQueue.get(i).getService();
      item["path"] = currentQueue.get(i).getPath();
      playlist.push(item);
    }
    console.log(playlist);
    cpu.module("runtime").set("playlists", data["playlistname"], "tracks", playlist);
    fs.writeFile("playlists.json", JSON.stringify(cpu.module("runtime").get("playlists")), 'utf-8');
    cpu.module("socket").emit("poll");
  }
});
cpu.module("socket").on('delete_playlist', {
  onreceive: function socketDeletePlaylist(cpu, context){
    var socket = context["socket"];
    var data = context["data"];
    if (!!cpu.module("runtime").get("playlists", data.name)) {
      cpu.module("runtime").delete("playlists", data.name);
      fs.writeFile('playlists.json', JSON.stringify(cpu.module("runtime").get("playlists")), 'utf-8');
      cpu.module("socket").emit("poll");
    }
  }
});
cpu.module("socket").on('getFiles', {
  onreceive: function getFiles(cpu, context) {
    var socket = context["socket"];
    cpu.module("socket").emit('getFiles', {'files': cpu.module("runtime").getFiles()}, socket.id);
  }
});
cpu.module("socket").on('playPlaylist', {
  onreceive: function onPlayPlaylist(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (data.name != '' && data.playing) {
      cpu.module("runtime").get("queue").clear();
      var playlist = cpu.module("runtime").get("playlists", data.name, "tracks");
      for ( var i=0; i < playlist.length; i++ ) {
        cpu.module("runtime").get("queue").add(new classes.Track(playlist[i]["service"], playlist[i]["path"]));
      }
      cpu.module("runtime").set("playback_time", 0);
      cpu.module("runtime").set("playing", data.playing);
      cpu.module("socket").emit('poll');
    }
  }
});
cpu.module("socket").on('playtrack', {
  onreceive: function onPlaySelectedTrack(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (data.id) {
      i = cpu.module("runtime").get("queue").getPos(data.id);
      if (i >= 0) {
        cpu.module("runtime").set("playback_time", 0);
        cpu.module("runtime").set("playing", true);
        cpu.module("runtime").get("queue").setCurrentPosition(i);
        cpu.module("socket").emit("poll");
        var track = cpu.module("runtime").get("queue").getCurrentTrack();
        stream.load(track.getService(), track.getPath());
      }
    }
  }
});
cpu.module("socket").on('toggleShuffle', {
  onreceive: function onToggleShuffle(cpu, context) {
    var socket = context["socket"];
    cpu.module("runtime").get("queue").setShuffle(!cpu.module("runtime").get("queue").getShuffle());
  }
});
cpu.module("socket").on('toggleRepeat', {
  onreceive: function onToggleRepeat(cpu, context) {
    var socket = context["socket"];
    cpu.module("runtime").get("queue").setRepeat((cpu.module("runtime").get("queue").getRepeat() + 1) % 3);
  }
});
cpu.module("socket").on('chpos_of_track', {
  onreceive: function onChangeTrackPos(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    cpu.module("util").log(data);
    if (data.id && data.newpos != undefined && data.newpos >= 0 && data.newpos < cpu.module("runtime").get("queue").size()) {
      var i = cpu.module("runtime").get("queue").getPos(data.id);
      var iscurrent = false;
      if (i == cpu.module("runtime").get("queue").getCurrentPosition()){
        iscurrent = true;
      }
      if (i >= 0) {
        var track = cpu.module("runtime").get("queue").get(i);
        cpu.module("runtime").get("queue").del(data.id);
        cpu.module("runtime").get("queue").add(track, data.newpos);
        if(iscurrent) {
          cpu.module("runtime").get("queue").setCurrentPosition(data.newpos);
        }
      }
    }
  }
});
cpu.module("socket").on('seek', {
  onreceive: function onSeek(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (data && data.position && data.position >= 0) {
      cpu.module("runtime").set("playback_time", data.position);
      socket.module("socket").emit("poll");
    }
  }
});
cpu.module("socket").on('getDuration', {
  onreceive: function onGetDuration(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    if (data && data.id) {
      var i = cpu.module("runtime").get("queue").getPos(data.id);
      if (i >= 0) {
        cpu.module("socket").emit('getDuration', {'duration': cpu.module("runtime").get("queue").get(i).getDuration() }, socket.id);
      }
    } else {
      cpu.module("socket").emit('getDuration', {'duration': cpu.module("runtime").get("queue").getCurrentTrack().getDuration() }, socket.id);
    }
  }
});
cpu.module("socket").on('setDuration', {
  onreceive: function onSetDuration(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    changed = false;
    if (data.duration && data.duration >= 0) {
      if (data.id) {
        var i = cpu.module("runtime").get("queue").getPos(data.id);
        if (i >= 0) {
          changed = (cpu.module("runtime").get("queue").get(i).getDuration() != data.duration);
          cpu.module("runtime").get("queue").get(i).setDuration(data.duration);
        }
      } else {
        changed = (cpu.module("runtime").get("queue").getCurrentTrack().getDuration() != data.duration);
        cpu.module("runtime").get("queue").getCurrentTrack().setDuration(data.duration);
      }
      if (changed) {
        cpu.module("socket").emit("durationChanged");
      }
    }
  }
});
cpu.module("socket").on('getPlaybackTime', {
  onreceive: function onGetPlaybackTime(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    /*
    if (data.id) {
      var i = cpu.module("runtime").get("queue").getPos(data.id);
      if (i >= 0) {
      io.to(socket.id).emit('getPlaybackTime', {'time': cpu.module("runtime").get("queue").get(i) });
    }
    } else {
    io.to(socket.id).emit('getPlaybackTime', {'time': cpu.module("runtime").get("queue").getCurrentTrack() });
    }
    */
    cpu.module("socket").emit('getPlaybackTime', {'time': cpu.module("runtime").get("playback_time") }, socket.id);
  }
});
cpu.module("socket").on('setPlaybackTime', {
  onreceive: function onSetPlaybackTime(cpu, context) {
    var socket = context["socket"];
    var data = context["data"];
    /*
    if (data.id) {
    var i = cpu.module("runtime").get("queue").getPos(data.id);
    if (i >= 0) {
    cpu.module("runtime").get("queue").get(i).setPlaybackTime(data.time);
    }
    } else {
      cpu.module("runtime").get("queue").getCurrentTrack().setPlaybackTime(data.time);
    }
    */
    if (data.time) {
      cpu.module("runtime").set("playback_time", data.time);
    }
    cpu.module("socket").emit("playbackTimeChanged");
  }
});

cpu.module("events").addEventListener("stream.end", function() {
  cpu.module("util").log("Stream ended");
});

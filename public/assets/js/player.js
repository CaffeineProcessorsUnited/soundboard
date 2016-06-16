cpu.events.addEventListener("ready", function(cpu) {
  addEvent("socket.getConfig", function(cpu, config) {
    runtime.config = config;
    socket.emit('get_current_track');
  }, function(cpu) {
    cpu.runtime().socket.on('get_config', function (data) {
      cpu.trigger("socket.getConfig", data);
    });
  });
  addEvent("socket.playbackTimeChanged", function(cpu, data) {
    return;
    socket.emit("getPlaybackTime");
  }, function(cpu) {
    cpu.runtime().socket.on('playbackTimeChanged', function (data) {
      cpu.trigger("socket.playbackTimeChanged", data);
    });
  });
  addEvent("socket.getPlaybackTime", function(cpu, data) {
    return;
    switch (runtime.service) {
      case "youtube":
        if (runtime.player) {
          runtime.player.seekTo(data.time, true);
        }
        break;
      case "filesystem":
      case "url":
      case "soundcloud":
      case "tts":
        elems = $('#soundboard_player').find('audio');
        if (elems.length) {
          elems[0].currentTime = data.time;
        }
        break;
    }
  }, function(cpu) {
    cpu.runtime().socket.on('getPlaybackTime', function (data) {
      cpu.trigger("socket.getPlaybackTime", data);
    });
  });
  addEvent("socket.getCurrentTrack", function(cpu, trackinfo) {
    cpu.player.playTrack(trackinfo);
  }, function(cpu) {
    cpu.runtime().socket.on('get_current_track', function (data) {
      cpu.trigger("socket.getCurrentTrack", data);
    });
  });
  addEvent("socket.onPoll", function(cpu, data) {
    cpu.runtime().socket.emit("get_current_track");
  }, function(cpu) {
    cpu.runtime().socket.on('poll', function (data) {
      cpu.trigger("socket.onPoll", data);
    });
  });
  // TODO: As we have a poll every now and then we dont need to get current time on pause, or do we?
  addEvent("socket.getCurrentTime", function(cpu, data) {
    if (cpu.runtime().service == "youtube") {
      cpu.runtime().socket.emit('current_Time', {"time": player.getCurrentTime()});
    } else if (runtime.service == "filesystem" || cpu.runtime().service == "url" || cpu.runtime().service == "soundcloud") {
      cpu.runtime().socket.emit('current_Time', {"time": player.currentTime});
    } else {
      cpu.runtime().log("no track playing, no time to report");
      cpu.runtime().log(runtime);
    }
  }, function(cpu) {
    cpu.runtime().socket.on('get_current_time', function (data) {
      cpu.trigger("socket.getCurrentTime", data);
    });
  });
});

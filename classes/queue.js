var Class = require("../class.js");

module.exports = Class({
  initialize: function() {
    this.queue = [];
    this.currentPos = -1;
    this.isShuffle = false;
    /*
    0 -> no repeat
    1 -> repeat all
    2 -> repeat one
    */
    this.isRepeat = 1;
    this.trackChanged;
  },
  add: function(track, position) {
    this.queue.insert(track, position);
    if(!!position && position <= this.currentPos) {
      this.currentPos = this.currentPos + 1;
    }
  },
  del: function(id) {
    for (var i = 0; i < this.queue.length; i++) {
      if (this.queue[i].getId() == id) {
        this.queue.delete(i);
        if(i < this.getCurrentPosition()) {
          this.currentPos -= 1;
        }
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
  getPos: function(id){
    for (var i = 0; i < this.size(); i++) {
      if (this.get(i).getId() == id) {
        return i;
      }
    }
    return -1;
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
  size: function() {
    return this.queue.length;
  },
  isEmpty: function() {
    return this.queue.length == 0;
  },
  prev: function() {
    this.currentPos = (this.currentPos + this.queue.length - 1) % this.queue.length;
    this.trackChanged = new Date().getTime();
  },
  next: function(position, force) {
    if (!!position) {
      this.currentPos = position;
    } else {
      if (this.isRepeat === 0 || this.isRepeat === 1) {
        if (this.isRepeat === 0 && this.currentPos >= this.queue.length - 1) {
          if (!!force) {
            if (this.isShuffle && !this.isEmpty()) {
              this.currentPos = 0;
            } else {
              this.currentPos = -1;
            }
          }
        } else {
          if (this.isShuffle) {
            this.currentPos = this.randomInt(0, this.queue.length);
          } else {
            this.currentPos = (this.currentPos + 1) % this.queue.length;
          }
        }
      } else if (this.isRepeat === 2) {
        if (!!force) {
          if (this.isShuffle) {
            this.currentPos = randomInt(0, this.queue.length);
          } else {
            this.currentPos = (this.currentPos + 1) % this.queue.length;
          }
        }
      }
    }
  },
  randomInt: function(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
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
    this.currentPos = pos;
  },
  getTrackChanged: function() {
    return this.trackChanged;
  },
  loadList: function(list) {
    if (typeof list == "list") {
      for ( var i=0; i<list.length; i++) {
        this.add(list[i]);
      }
    }
  }
});

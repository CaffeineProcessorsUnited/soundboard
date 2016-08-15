/**
  CPU - runtime
  Dependency: core,
**/
(function() {
	var modulename = "runtime";
  var Module = (function(modulename) {
    function Module(options) {
      this.name = modulename;
      if (!options["cpu"]) {
        console.log("Can't load module \"" + this.name + "\"! You need to pass the cpu object.");
        return;
      }
      this.cpu = options["cpu"];
      this.storage = {};
			this.fs = require('fs');
			this.callerId = require('caller-id');
			this.path = require('path');
    }
    /*
     * This function is given a chain of arguments, that descripte the path to acces the object stored in storage
     */
    Module.prototype.get = function() {
      var store = this.storage;
      for (var i=0; i < arguments.length; i++) {
        if(store[arguments[i]]) {
          store = store[arguments[i]];
        } else {
          return undefined;
        }
      }
      return store;
    };
    /*
     * This function must be given at least to arguments, the first arguments containts the path to where you want to store the last the value to be stored
     */
    Module.prototype.set = function() {
      if(arguments.length < 2) {
        this.cpu.module("util").log("You need to pass at least to arguments!");
      } else {
        var value = arguments[arguments.length - 1];
        for ( var i = arguments.length - 2; i > 0; i--) {
          var passargs = [];
					for ( var j = 0; j < i; j++) {
						passargs.push(arguments[j]);
					}
          var parent = this.get.apply(this, passargs);
          if(parent === undefined) {
            var obj = {}
						obj[arguments[i]] = value;
            value = obj;
          } else {
            var child = value;
            value = parent;
            value[arguments[i]] = child;
          }
        }
        this.storage[arguments[0]] = value;
			}
    };
    Module.prototype.delete = function() {
			var passargs = [];
			for (var i=0; i < arguments.length-1; i++) {
				passargs.push(arguments[i]);
			}
			var parent = this.get.apply(this, passargs);
      delete parent[arguments[arguments.length-1]];
			passargs.push(parent);
			this.set.apply(this, passargs);
    };
		Module.prototype.info = function() {
			var caller = this.callerId.getData();
			var string = util.format.apply(null, arguments);
			if (debug && !!callerId.getString()) {
			  string = 'INFO: ' + callerId.getDetailedString() + '(): ' + string;
			}
			this.get("serverlog").log(string);
		};
		Module.prototype.readdir = function(base) {
			base = this.path.resolve('./', base);
  		//xss testing var list = {"<script>window.alert('xss');</script>": "\"><script>window.alert('xss');</script>"};
  		var list = {};
  		try {
    		var stats = this.fs.lstatSync(base)
    		if (!!stats) {
      		if (stats.isDirectory()) {
        		var dirs = this.fs.readdirSync(base);
        		if (!!dirs) {
          		dirs.forEach(function(dir) {
            		var file = this.path.relative('./', this.path.resolve(base, dir));
            		list[dir] = this.readdir('./' + file);
          		}, this);
        		}
      		} else if (stats.isFile()) {
        		var file = this.path.relative('./public/songs/filesystem/', this.path.resolve(base));
        		return file;
      		}
    		}
  		} catch(e) {
    		this.cpu.module("util").log("Couldn't read files" + e);
  		}
  		return list;
		};
		Module.prototype.getFiles = function() {
			return this.readdir('./public/songs/filesystem/');
		};
    return Module;
  })(modulename);

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Module;
  } else {
    if (!window.cpumodules) {
      window.cpumodules = {};
    }
    window.cpumodules[modulename] = Module;
  }
})();

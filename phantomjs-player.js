"use strict";
var page = require('webpage').create();

page.onConsoleMessage = function(msg) {
    console.log(msg);
};

page.open("http://localhost:8080/player.html", function(status) {
    if (status === "success") {
      console.log("Enjoy the music!");
    } else {
      console.error("Couldn't open player.html!");
      phantom.exit(1);
    }
});

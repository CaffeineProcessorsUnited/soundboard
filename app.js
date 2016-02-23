var express = require('express');
var web = express();
var server = require('http').Server(web);
var io = require('socket.io')(server);
var ioc = require('socket.io-client');

web.use(express.static('public'));

server.listen(8080, function () {
	console.log('Web interface is running on port 8080!');
	// api is used as a connection between POST requests and socket
	var api = express();
	var bodyParser = require("body-parser");
	api.use(bodyParser.urlencoded({ extended: false }));
	api.use(bodyParser.json());
	var client;
	
	api.get('*', function(req, res) {
		res.send('This api doesn\'t work through GET. Please switch to POST!');
	});

	api.post('*', function(req, res) {
		// req.body contains the json data sent as POST data
		client.emit('test');
		res.send('Not specified');
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
	});
});

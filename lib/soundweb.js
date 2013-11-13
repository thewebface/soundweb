
var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    SoundwebConsts = require('./soundweb_constants.js'),
	SoundwebMessage = require('./soundweb_message.js'),
	net = require('net');

var SoundwebClient = function(config) {
	this._config = config;
	this._decoder = new SoundwebMessage.Decoder();
	this.connect();
};

util.inherits(SoundwebClient, EventEmitter);

// Connect to Soundweb TCP port
SoundwebClient.prototype.connect = function(data) {
	var self = this;
	
	this.connected = false;
	
	// Connect net client
	this._client = net.connect({host: this._config.host, port: this._config.port});
	
	this._client.on('connect', function() {
		self.emit('connect');
		self.connected = true;
	});
	
	this._client.on('end', function() {
		self.emit('disconnect');
		self.connected = false;
	});
	
	this._client.on('error', function(e) {
		self.emit('error', e);
		self.connected = false;
	});
	
	// Hook up decoder
	this._client.on('data', function(data) {
		self._decoder.data(data);
	});
	
	this._decoder.on('MESSAGE', function(buffer) {
		self._send(new Buffer([SoundwebConsts.special.byStr.ACK]));
		
		self.emit('data', buffer);
		self._parseMsg(buffer);
	});
	
	this._decoder.on('INVALID_CHECKSUM', function() {
		self._send(new Buffer([SoundwebConsts.special.byStr.NAK]));
		console.log("checksum invalid");
	});
	
	this._decoder.on('ACK', function() {
		console.log("ACK received");
	});
	
	this._decoder.on('NAK', function() {
		console.log("NAK received");
	});
}

// Send a RAW_MSG message
SoundwebClient.prototype.RAW_MSG = function(handle, method, value) {
	var buffer = new Buffer(11);
	
	buffer.writeUInt8(SoundwebConsts.cmds.byStr.RAW_MSG, 0);
	buffer.writeUInt32BE(handle, 1);
	buffer.writeUInt32BE(method, 5);
	buffer.writeInt16BE(value, 9);
	
	this._send(SoundwebMessage.encode(buffer));
};

// Send a SET_VALUE message
SoundwebClient.prototype.SET_VALUE = function(group, id, value) {
	if (! group in SoundwebConsts.groups.byStr) {
		console.log('Invalid group');
		return;
	}

	var buffer = new Buffer(5);
	
	buffer.writeUInt8(SoundwebConsts.cmds.byStr.SET_VALUE, 0);
	buffer.writeUInt8(SoundwebConsts.groups.byStr[group], 1);
	buffer.writeUInt8(id, 2);
	buffer.writeUInt16BE(value, 3);
	
	this._send(SoundwebMessage.encode(buffer));
};

// Send a data back to Soundweb device, takes buffer object
SoundwebClient.prototype._send = function(buffer) {
	this._client.write(buffer);
};

// Parse command byte and dispatch
SoundwebClient.prototype._parseMsg = function(msg) {
	switch(msg[0]) {
		case SoundwebConsts.cmds.byStr.SET_VALUE: this._set_value(msg); break;
		case SoundwebConsts.cmds.byStr.RAW_MSG: this._raw_msg(msg); break;
		
		default: console.log("Cmd not found: " + msg[0]);
	}
};

// Parse SET_VALUE command and emit event with decoded data
SoundwebClient.prototype._set_value = function(msg) {
	if (msg.length != 5) {
		console.log("Invalid set value length");
		return;
	}
	
	if (! msg[1] in SoundwebConsts.groups.byVal) {
		console.log("Invalid set value group " + msg[1]);
		return;
	}
	
	var data = {
		group: SoundwebConsts.groups.byVal[msg[1]],
		id: msg[2],
		value: msg.readUInt16BE(3)
	};
	
	this.emit('SET_VALUE', data);
};

// Emit event with RAW_MSG data
SoundwebClient.prototype._raw_msg = function(msg) {
	this.emit('RAW_MSG', msg.slice(1));
};

// External access to class
exports.createClient = function(config) {
	return new SoundwebClient(config);
};


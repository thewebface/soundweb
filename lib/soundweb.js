
var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    SoundwebConsts = require('./soundweb_constants.js'),
	net = require('net');

var SoundwebClient = function(config) {
	this._config = config;
	this.connect();
};

util.inherits(SoundwebClient, EventEmitter);

// Connect to Soundweb TCP port
SoundwebClient.prototype.connect = function(data) {
	var self = this;
	
	this.connected = false;
	
	this._client = net.connect({host: this._config.host, port: this._config.port});
	
	this._client.on('data', this._decodeChunk.bind(this));
	
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
	
	this._firstRun = true;
	this._reset();
}

// Send a RAW_MSG message
SoundwebClient.prototype.RAW_MSG = function(handle, method, value) {
	var buffer = new Buffer(11);
	
	buffer.writeUInt8(SoundwebConsts.cmds.byStr.RAW_MSG, 0);
	buffer.writeUInt32BE(handle, 1);
	buffer.writeUInt32BE(method, 5);
	buffer.writeInt16BE(value, 9);
	
	this._send_msg(buffer);
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
	
	this._send_msg(buffer);
};

// Send a message to Soundweb device
SoundwebClient.prototype._send_msg = function(body_buffer) {
	body_buffer = this._escape_special(body_buffer);

	var buffer = new Buffer(body_buffer.length + 3);
	
	buffer.writeUInt8(SoundwebConsts.special.byStr.STX, 0);
	body_buffer.copy(buffer, 1);
	buffer.writeUInt8(this._calculate_checksum(body_buffer), buffer.length-2);
	buffer.writeUInt8(SoundwebConsts.special.byStr.ETX, buffer.length-1);
	
	this._send(buffer);
};

// Calculate the checksum of a buffer
SoundwebClient.prototype._calculate_checksum = function(buffer) {
	var checksum = 0;
	
	for (var i=0; i<buffer.length; i++) {
		checksum = checksum ^ buffer[i];
	}
	
	return checksum;
};

// Return new buffer with special bytes escaped
SoundwebClient.prototype._escape_special = function(buffer) {
	var i = 0, to_escape = 0;
	
	for (i=0; i<buffer.length; i++) {
		if (buffer[i] in SoundwebConsts.special.byVal) {
			to_escape++;
		}
	}
	
	if (! to_escape) {
		return buffer;
	}
	
	var escaped_buffer = new Buffer(buffer.length + to_escape);
	var target_pos = 0;
	
	for (i=0; i<buffer.length; i++) {
		if (buffer[i] in SoundwebConsts.special.byVal) {
			escaped_buffer.writeUInt8(SoundwebConsts.special.byStr.ESC, target_pos++);
			escaped_buffer.writeUInt8(buffer[i] + 0x80, target_pos++);
		} else {
			buffer.copy(escaped_buffer, target_pos++, i, i+1);
		}
	}
	
	return escaped_buffer;
};

// Send a data back to Soundweb device, takes buffer object
SoundwebClient.prototype._send = function(buffer) {
	this._client.write(buffer);
};

// Reset parser state
SoundwebClient.prototype._reset = function() {
	this._hasEscape = false;
	this._checksum = 0;
	this._bodyBuffer = [];
};

// Decode some received data
SoundwebClient.prototype._decodeChunk = function(chunk) {
	for (var i=0; i<chunk.length; i++) {
		switch (chunk[i]) {
			case SoundwebConsts.special.byStr.STX: this._stx(); break;
			case SoundwebConsts.special.byStr.ETX: this._etx(); break;
			case SoundwebConsts.special.byStr.ESC: this._esc(); break;
			case SoundwebConsts.special.byStr.ACK: this._ack(); break;
			case SoundwebConsts.special.byStr.NAK: this._nak(); break;
			
			default: this._body(chunk[i]);
		}
	}
};

// Handle packet start command
SoundwebClient.prototype._stx = function() {
	this._reset();
};

// Handle packet end command
SoundwebClient.prototype._etx = function() {
	// Discard first packet (probably corrupt)
	if (this._firstRun) {
		this._firstRun = false;
		return;
	}
	
	// Removed received checksum
	var receivedChecksum = this._bodyBuffer.pop();
	
	if (this._checksum == 0) {	// Will have xor'd with received checksum so should cancel out
		this._send(new Buffer([SoundwebConsts.special.byStr.ACK]));
		var msg = new Buffer(this._bodyBuffer);
		
		this.emit('data', msg);
		this._parseMsg(msg);
	} else {
		this._send(new Buffer([SoundwebConsts.special.byStr.NAK]));
		console.log("checksum invalid");
	}
};

// Mark escape character received
SoundwebClient.prototype._esc = function() {
	this._hasEscape = true;
};

// Handle received acknowledgement
SoundwebClient.prototype._ack = function() {
	console.log("ACK received");
};

// Handle resend request (not implemented)
SoundwebClient.prototype._nak = function() {
	console.log("NAK received");
};

// Add packet body bytes to receive buffer
SoundwebClient.prototype._body = function(bodybyte) {
	// Workaround bug with received data: a byte is duplicated if equal to 0xff
	if (this._ignoreNext) {
		this._ignoreNext = false;
		return;
	}
	
	if (bodybyte == 0xff) {
		this._ignoreNext = true;
	}

	// Previous character was escape
	if (this._hasEscape) {
		bodybyte -= 0x80;
		this._hasEscape = false;
	}
	
	// Add to buffer and update checksum
	this._bodyBuffer.push(bodybyte);
	this._checksum = this._checksum ^ bodybyte;
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


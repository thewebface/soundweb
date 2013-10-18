
var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    SoundwebConsts = require('./soundweb_constants.js'),
	net = require('net');

var SoundwebClient = function(config) {
	this._client = net.connect({host: config.host, port: config.port});
	
	this._reset();
	this._firstRun = true;
	
	this._client.on('data', this._decodeChunk.bind(this));
	this._client.on('end', this._disconnect.bind(this));
};

util.inherits(SoundwebClient, EventEmitter);

// Send a message back to Soundweb device, takes array of bytes
SoundwebClient.prototype._send = function(data) {
	this._client.write(new Buffer(data));
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
	// Discard dirst packet (probably corrupt)
	if (this._firstRun) {
		this._firstRun = false;
		return;
	}

	// Removed received checksum
	var receivedChecksum = this._bodyBuffer.pop();
	
	// Workaround bug with received data: checksum byte is duplicated if equal to 0xff
	if (receivedChecksum == 0xff && this._bodyBuffer[this._bodyBuffer.length-1] == 0xff) {
		this._bodyBuffer.pop();
		this._checksum = this._checksum ^ 0xff;
	}
	
	if (this._checksum == 0) {	// Will have xor'd with received checksum so should cancel out
		this._send([SoundwebConsts.special.byStr.ACK]);
		var msg = new Buffer(this._bodyBuffer);
		
		this.emit('rawmsg', msg);
		this._parseMsg(msg);
	} else {
		this._send([SoundwebConsts.special.byStr.NAK]);
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
	if (this._hasEscape) {
		bodybyte -= 128;
		this._hasEscape = false;
	}
	
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

// Error connecting
SoundwebClient.prototype._disconnect = function(data) {
	console.log("Soundweb disconnected: " + data);
};

// External access to class
exports.createClient = function(config) {
	return new SoundwebClient(config);
};



var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    SoundwebConsts = require('./soundweb_constants.js');

var SoundwebMessageDecoder = function() {
	this._firstRun = true;
	this._reset();
};

util.inherits(SoundwebMessageDecoder, EventEmitter);

// Reset parser state
SoundwebMessageDecoder.prototype._reset = function() {
	this._hasEscape = false;
	this._checksum = 0;
	this._bodyBuffer = [];
};

// Receive chunk of data from Soundweb
SoundwebMessageDecoder.prototype.data = function(chunk) {
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
SoundwebMessageDecoder.prototype._stx = function() {
	this._reset();
};

// Handle packet end command
SoundwebMessageDecoder.prototype._etx = function() {
	// Discard first packet (probably corrupt)
	if (this._firstRun) {
		this._firstRun = false;
		return;
	}
	
	// Removed received checksum
	var receivedChecksum = this._bodyBuffer.pop();
	
	if (this._checksum == 0) {	// Will have xor'd with received checksum so should cancel out
		var msg = new Buffer(this._bodyBuffer);
		
		this.emit('MESSAGE', msg);
	} else {
		this.emit('INVALID_CHECKSUM', receivedChecksum, this._checksum, this._bodyBuffer);
	}
};

// Mark escape character received
SoundwebMessageDecoder.prototype._esc = function() {
	this._hasEscape = true;
};

// Handle received acknowledgement
SoundwebMessageDecoder.prototype._ack = function() {
	this.emit('ACK');
};

// Handle resend request
SoundwebMessageDecoder.prototype._nak = function() {
	this.emit('NAK');
};

// Add packet body bytes to receive buffer
SoundwebMessageDecoder.prototype._body = function(bodybyte) {
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

// Encode a body buffer to be sent to Soundweb
exports.encode = function(body_buffer) {
	
	// Can use an array as processing is done on a per-octet level
	var data = [];
	var checksum = 0;
	
	data.push(SoundwebConsts.special.byStr.STX);
	
	// Escape special characters and calculate checksum
	for(var i=0; i<body_buffer.length; i++) {
		if (body_buffer[i] in SoundwebConsts.special.byVal) {
			data.push(SoundwebConsts.special.byStr.ESC);
			data.push(body_buffer[i] + 0x80);
		} else {
			data.push(body_buffer[i]);
			
			// 0xff duplication bug
			if (body_buffer[i] == 0xff) {
				data.push(0xff);
			}
		}
		
		checksum = checksum ^ body_buffer[i];
	}
	
	// Add checksum to array
	if (checksum in SoundwebConsts.special.byVal) {
		data.push(SoundwebConsts.special.byStr.ESC);
		data.push(checksum + 0x80);
	} else {
		data.push(checksum);
	}
	
	data.push(SoundwebConsts.special.byStr.ETX);
	
	return new Buffer(data);
};

exports.Decoder = SoundwebMessageDecoder;

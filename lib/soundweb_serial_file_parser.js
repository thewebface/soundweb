
var util = require('util'),
    fs = require('fs'),
	SoundwebConsts = require('./soundweb_constants.js');

var SoundwebSerialFileParser = function(filename) {
	this._filename = filename;
	
	this.codes = {
		button: {},
		preset: {},
		spinner: {},
		level: {},
		source: {}
	};
	
	this._parseFile();
};

// Get code based on group and info
SoundwebSerialFileParser.prototype.getCode = function(group, info) {
	var codeGroup = this._getCodeGroup(group);
	
	if (! codeGroup) {
		console.log("Group not found: " + group);
		return;
	}
	
	for (var x in codeGroup) {
		if(Object.keys(codeGroup[x]).every(function(key) {
			return info[key] && codeGroup[x][key] == info[key];
		})) {
			return x;
		}
	}
};

// Get info based on group and code
SoundwebSerialFileParser.prototype.getInfo = function(group, code) {
	var codeGroup = this._getCodeGroup(group);
	
	if (! codeGroup) {
		console.log("Group not found: " + group);
		return;
	}
	
	if (! codeGroup[code]) {
		console.log("Code not found: " + code);
		return;
	}
	
	return codeGroup[code];
};

// Get code group based on group string
SoundwebSerialFileParser.prototype._getCodeGroup = function(group) {
	switch(group) {
		case 'SW_AMX_BUTTON':
		case 'SW_AMX_TOGGLE':
		case 'SW_AMX_LED':
			return this.codes.button;
		case 'SW_AMX_PRESET':
			return this.codes.preset;
		case 'SW_AMX_SPIN':
			return this.codes.spinner;
		case 'SW_AMX_LEVEL':
			return this.codes.level;
		case 'SW_AMX_SOURCE':
			return this.codes.source;
		case 'SW_AMX_TEXT':
		default:
			console.log("Group not implemented: " + group);
	}
};

// Read in and parse file data
SoundwebSerialFileParser.prototype._parseFile = function() {
	var self = this;
	
	var data = fs.readFileSync(this._filename).toString('ascii');
	
	var lines = data.trim().replace("\r", "").split("\n");
	
	lines.forEach(function(line) {
		var match;
		
		// Buttons
		match = line.match(/\(\* '(.*)\/(.*)\/(.*)' has channel code : (\d+) \*\)/);
		if (match) {
			self.codes.button[match[4]] = {'device': match[1], 'control': match[2], 'type': match[3]};
			return;
		}
		
		// Presets
		match = line.match(/\(\* Preset '(.*)' has channel code : (\d+) \*\)/);
		if (match) {
			self.codes.preset[match[2]] = match[1];
			return;
		}
		
		// Spinners
		match = line.match(/\(\* '(.*)\/(.*)\/(.*)'\((.*)\) has channel code : (\d+) \*\)/);
		if (match) {
			self.codes.spinner[match[5]] = {'device': match[1], 'control': match[2], 'type': match[3], 'direction': match[4]};
			return;
		}
		
		// Levels
		match = line.match(/\(\* '(.*)\/(.*)\/(.*)' has level code : (\d+) \*\)/);
		if (match) {
			self.codes.level[match[4]] = {'device': match[1], 'control': match[2], 'type': match[3]};
			return;
		}
		
		// Sources
		match = line.match(/\(\* Combo '(.*)\/(.*)\/(.*)' option '(.+)' has channel code : (\d+) \*\)/);
		if (match) {
			self.codes.source[match[5]] = {'device': match[1], 'control': match[2], 'type': match[3], 'option': match[4]};
			return;
		}
		
		console.log("Unknown line format: " + line);
	});
};

exports.Parser = SoundwebSerialFileParser;


exports.special = {
	byStr: {
		'STX': 0x02,
		'ETX': 0x03,
		'ACK': 0x06,
		'NAK': 0x15,
		'ESC': 0x1b
	},
	byVal: {
		0x02: 'STX',
		0x03: 'ETX',
		0x06: 'ACK',
		0x15: 'NAK',
		0x1b: 'ESC'
	}
};

exports.cmds = {
	byStr: {
		'SET_VALUE': 0x80,
		'SET_STRING': 0x81,
		'REQUEST_VALUE': 0x82,
		'REQUEST_STRING': 0x83,
		'RAW_MSG': 0x84
	},
	byVal: {
		0x80: 'SET_VALUE',
		0x81: 'SET_STRING',
		0x82: 'REQUEST_VALUE',
		0x83: 'REQUEST_STRING',
		0x84: 'RAW_MSG'
	}
};

exports.groups = {
	byStr: {
		'SW_AMX_BUTTON': 0,
		'SW_AMX_TOGGLE': 1,
		'SW_AMX_LED': 2,
		'SW_AMX_PRESET': 3,
		'SW_AMX_SPIN': 4,
		'SW_AMX_LEVEL': 5,
		'SW_AMX_SOURCE': 6,
		'SW_AMX_TEXT': 7
	},
	byVal: {
		0: 'SW_AMX_BUTTON',
		1: 'SW_AMX_TOGGLE',
		2: 'SW_AMX_LED',
		3: 'SW_AMX_PRESET',
		4: 'SW_AMX_SPIN',
		5: 'SW_AMX_LEVEL',
		6: 'SW_AMX_SOURCE',
		7: 'SW_AMX_TEXT'
	}
};

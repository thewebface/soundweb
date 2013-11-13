soundweb
========

A Node library to interface with Soundweb devices via the RS232 serial port

It currently requires ser2net (or similar) to make the serial port data available via TCP.

The library has been tested on a BSS 3088 device, interfacing with a CentOS linux box.

ser2net setup
-------------

For the machine's first serial port, add the following line to ser2net (to listen on port 2000):

    2000:telnet:0:/dev/ttyS0:38400

Usage
-----

The controls must be copied to the 'serial' window in Soundweb Designer in order for their data to be output.

    var swclient = soundweb.createClient({host:'localhost', port:2000});
    
    swclient.on('SET_VALUE', function(data) {
      console.log(data); // {group: 'SW_AMX_LEVEL', id: 1, value: 124}
    });

	swclient.SET_VALUE('SW_AMX_SOURCE', 6, 2);

Methods
-------

#### SET_VALUE(group, id, value)
Sends SET_VALUE command. group is a string, id and value are integers.

#### RAW_MSG(handle, method, value)
Sends RAW_MSG command.

Events
------

#### SET_VALUE #
Returns decoded data

#### RAW_MSG #
Returns RAW_MSG message body in Buffer object

#### data #
Returns undecoded message in Buffer object

#### connect #
A TCP connection has been established to the remote host

#### disconnect #
The TCP connection has been closed at the remote end

#### error #
A TCP error has occurred. Error object is passed from net.Socket

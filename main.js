/**
 *
 *      ioBroker PING Adapter
 *
 *      (c) 2014 bluefox<bluefox@ccu.io>
 *
 *      MIT License
 *
 */

var adapter = require(__dirname + '/../../lib/adapter.js')('ping');
var ping =    require('ping');


var timer =   null;

adapter.on('message', function (obj) {
    if (obj) processMessage(obj);
    processMessages();
});

adapter.on('ready', function () {
    main();
});

adapter.on('unload', function () {
    if (timer) {
        clearInterval(timer);
        timer = 0;
    }
});


// is called if a subscribed state changes
//adapter.on('stateChange', function (id, state) {
//});

function processMessage(obj) {
    if (!obj || !obj.command) return;
    switch (obj.command) {
        case 'ping': {
            // Try to connect to mqtt broker
            if (obj.callback && obj.message) {
                ping.promise.probe(obj.message).then(function (res) {
                    adapter.sendTo(obj.from, obj.command, res, obj.callback);
                });
            }
        }
    }
}

function processMessages() {
    adapter.getMessage(function (err, obj) {
        if (obj) {
            processMessage(obj.command, obj.message);
            processMessages();
        }
    });
}

var host  = '';
var hosts = [];

function pingAll() {
    ping.promise.probe(obj.message).then(function (res) {
        adapter.sendTo(obj.from, obj.command, res, obj.callback);
    });
}

function createState(name, ip, room, callback) {
    var id = ip.replace(/[.\s]+/g, '_');

    if (room) {
        adapter.addStateFromEnum('room', room, '', host, id);
    }

    adapter.createState('', host, id, {
        name:   name || ip,
        def:    false,
        type:   'boolean',
        read:   'true',
        write:  'false',
        role:   'indicator.reachable',
        desc:   'Ping state of ' + ip
    }, {
        ip: ip
    }, callback);
}

function addState(name, ip, room, callback) {
    adapter.getObject(host, function (err, obj) {
        if (err || !obj) {
            // if root does not exist, channel will not be created
            adapter.createChannel('', host, [], function () {
                createState(name, ip, room, callback);
            });
        } else {
            createState(name, ip, room, callback);
        }
    });
}

function syncConfig() {
    adapter.getStatesOf('', adapter.host, function (err, _states) {
        var configToDelete = [];
        var configToAdd    = [];
        var k;
        if (adapter.config.devices) {
            for (k = 0; k < adapter.config.devices.length; k++) {
                configToAdd.push(adapter.config.devices[k].ip);
            }
        }

        for (var j = 0; j < _states.length; j++) {
            var ip = _states[j].native.ip;
            var id = replace(/[.\s]+/g, '_');
            var pos = configToAdd.indexOf(ip);
            if (pos != -1) {
                configToAdd.splice(pos, 1);
                // Check name and room
                for (var u = 0; u < adapter.config.devices.length; u++) {
                    if (adapter.config.devices[u].ip == ip) {
                        if (_states[j].common.name != (adapter.config.devices[u].name || adapter.config.devices[u].ip)) {
                            adapter.extendObject(_states[j]._id, {common: {name: (adapter.config.devices[u].name || adapter.config.devices[u].ip)}});
                        }
                        if (adapter.config.devices[u].room) {
                            adapter.addChannelToEnum('room', adapter.config.devices[u].room, 'root', id);
                        } else {
                            adapter.deleteStateFromEnum('room', '', host, id);
                        }
                    }
                }
            } else {
                configToDelete.push(ip);
            }
        }

        if (configToAdd.length) {
            for (var r = 0; r < adapter.config.devices.length; r++) {
                if (configToAdd.indexOf(adapter.config.devices[r].ip) != -1) {
                    addState(adapter.config.devices[r].name, adapter.config.devices[r].ip, adapter.config.devices[r].room);
                }
            }
        }
        if (configToDelete.length) {
            for (var e = 0; e < configToDelete.length; e++) {
                var id = configToDelete[e].ip.replace(/[.\s]+/g, '_');
                adapter.deleteStateFromEnum('room', '',  host, id);
                adapter.deleteState('', host, id);
            }
        }
    });
}

function main() {
    host = adapter.host;

    for (var i = 0; i < adapter.config.devices.length; i++) {
        hosts.push(adapter.config.devices[i].ip);
    }
    if (adapter.config.interval < adapter.config.devices.length * 5000) {
        adapter.config.interval = adapter.config.devices.length * 5000;
    }

    syncConfig();

    pingAll();
    if (adapter.common.mode != 'schedule') {
        timer = setInterval(pingAll, adapter.config.interval)
    }
}

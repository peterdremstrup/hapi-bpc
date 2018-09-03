/*jshint node: true */
'use strict';

const routes = require('./routes');
const service = require('./service');

module.exports = {
    service,
    name: 'bpc',
    version: '1.0.0',
    register(server, options) {
		server.dependency('schmervice', async (srv) => {
			server.route(routes);
            server.registerService(service);
        });
    }
};

/*jshint node: true */
'use strict';

const routes = require('./routes');
const service = require('./service');
const scheme = require('./scheme');

module.exports = {
    service,
    name: 'hapi-bpc',
    version: '1.1.0',
    register(server, options) {
        server.auth.scheme('bpc', scheme);
        server.auth.strategy('bpc', 'bpc');
        server.dependency('schmervice', async (srv) => {
            server.route(routes);
            server.registerService(service);
        });
    }
};

/*jshint node: true */
'use strict';

const packageJson = require('../package.json');
const routes = require('./routes');
const service = require('./service');
const scheme = require('./scheme');

module.exports = {
    service,
    name: packageJson.name,
    version: packageJson.version,
    register(server, options) {
        server.auth.scheme('bpc', scheme);
        server.auth.strategy('bpc', 'bpc');
        server.dependency('schmervice', async (srv) => {
            server.route(routes);
            server.registerService(service);
        });
    }
};

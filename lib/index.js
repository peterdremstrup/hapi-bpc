/*jshint node: true */
'use strict';

const packageJson = require('../package.json');
const log = require('util').log;
const Url = require('url');

const bpc_client = require('bpc_client');

bpc_client.events.on('ready', () => {
    log('Connected to BPC on', bpc_client.url, 'AS', bpc_client.app.id);
})

bpc_client.connect();

const routes = require('./routes');
const scheme = require('./scheme');


let BPC_URL;

try {
  BPC_URL = Url.parse(bpc_client.url);
} catch (ex) {
  console.error('BPC URL is missing or invalid.');
  process.exit(1);
}


const env = Object.assign({}, BPC_URL, {
  app: bpc_client.app.id,
  state_name: `${ bpc_client.app.id }_ticket`
});


const plugin = {
    name: packageJson.name,
    version: packageJson.version,
    register(server, options) {
        server.auth.scheme('bpc', scheme);
        server.auth.strategy('bpc', 'bpc');

        server.state(env.state_name, {
            // ttl: 1000 * 60 * 60 * 24 * 30, // (one month)
            ttl: 1000 * 60 * 60 * 24 * 30 * 12, // (one year)
            // ttl: null, // session time-life - cookies are deleted when the browser is closed
            isHttpOnly: false,
            isSecure: false,
            // isSameSite: false,
            path: '/',
            encoding: 'base64json'
        });

        server.decorate('toolkit', 'bpc', { request: bpc_client.request, env });

        server.route(routes);
    },
    bpc: bpc_client
};

module.exports = plugin;

/*jshint node: true */
'use strict';

const packageJson = require('../package.json');
const Boom = require('boom');
const Hawk = require('hawk');
const http = require('http');
const log = require('util').log;
const https = require('https');
const Url = require('url');
const routes = require('./routes');
const scheme = require('./scheme');


const ticketBuffer = 10000;
const errorTimeout = 1000 * 60 * 5; // Five minutes
let appTicket = {};
let ticketRefresh = null;

var BPC_URL;

try {
  BPC_URL = Url.parse(process.env.BPC_URL);
} catch (ex) {
  console.error('Env var BPC_URL missing or invalid.');
  process.exit(1);
}

const BPC_APP_ID = process.env.BPC_APP_ID;
const BPC_APP_SECRET = process.env.BPC_APP_SECRET;


log('Connecting to BPC on', BPC_URL.host, 'AS', BPC_APP_ID);


const env = Object.assign({}, BPC_URL, {
  app: BPC_APP_ID,
  state_name: `${BPC_APP_ID}_ticket`
});


const app = {
    id: BPC_APP_ID,
    key: BPC_APP_SECRET,
    algorithm: 'sha256'
};


async function parseResponse(res) {
    return new Promise ((resolve, reject) => {
        var data = '';

        res.on('data', (d) => {
            data = data + d;
        });

        res.on('end', () => {
            try {
                if (data.length > 0){
                    data = JSON.parse(data);
                }
            } catch (ex) {
                console.error('JSON parse error on: ', data);
                return reject(ex);
            }

            if (data.statusCode > 300) {

                if (data.statusCode === 401 && data.message === 'Expired ticket'){
                    getAppTicket();
                }

                var err = new Boom(data.message, data);
                return resolve(err);
            } else {
                return resolve(data);
            }
        });
    });
};


async function request (options, credentials) {
    return new Promise((resolve, reject) => {
        Object.assign(options, {
            protocol: env.protocol,
            hostname: env.hostname,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (env.port){
            options.port = env.port;
        }

        // If the request should use the app ticket
        if (credentials === 'appTicket'){
            credentials = appTicket;
        }

        if (credentials !== undefined && credentials !== null && Object.keys(credentials).length > 1){
            var requestHref = Url.resolve(env.href, options.path);
            var hawkHeader = Hawk.client.header(requestHref, options.method || 'GET', {credentials: credentials, app: app.id});
            if (hawkHeader.err) {
                return reject(new Error('Hawk header: ' + hawkHeader.err));
            }

            options.headers['Authorization'] = hawkHeader.header;
        }

        var reqHandler = https;
        if (options.protocol === 'http:') {
            reqHandler = http;
        }

        var req = reqHandler.request(options);

        if (options.payload !== undefined && options.payload !== null){
            if (typeof options.payload === 'object'){
                req.write(JSON.stringify(options.payload));
            } else {
                req.write(options.payload);
            }
        }

        req.end();

        req.on('response', async (res) => {
            const data = await parseResponse(res);
            if(data.isBoom) {
                return reject(data);
            }
            resolve(data);
        });

        req.on('error', async (err) => {
            reject(err);
        });
    });
};



async function getAppTicket() {
    try {
        const result = await request(
            {
                path: '/ticket/app',
                method: 'POST',
                payload: {}
            },
            app
        );

        log('Got the appTicket');
        appTicket = result;
        ticketRefresh = setTimeout(() => { refreshAppTicket() }, result.exp - Date.now() - ticketBuffer);
    } catch(err) {
        console.error('getAppTicket:', err);
        setTimeout(() => { getAppTicket() }, errorTimeout);
    }
};


async function refreshAppTicket() {
    try {
        const result = await request(
            {
                path: '/ticket/reissue',
                method: 'POST'
            },
            appTicket
        );

        appTicket = result;
        ticketRefresh = setTimeout(() => { refreshAppTicket() }, result.exp - Date.now() - ticketBuffer);
    } catch(err) {
        console.error('refreshAppTicket:', err);
        setTimeout(() => { getAppTicket() }, errorTimeout);
    }
};
    



getAppTicket();



const plugin = {
    name: packageJson.name,
    version: packageJson.version,
    // dependencies: { SOON
    //     'bpc-client': '1.1.0'
    // },
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

        server.decorate('toolkit', 'bpc', { request, env });

        server.route(routes);
    }
};

module.exports = plugin;

const Boom = require('boom');
const Hawk = require('hawk');
const http = require('http');
const log = require('util').log;
const https = require('https');
const Url = require('url');
const { Service } = require('schmervice');

module.exports = class bpc extends Service {
	constructor(server, options) {

		super(server, options);
		this.appTicket = {};
		this.ticketBuffer = 10000;
		this.errorTimeout = 1000 * 60 * 5; // Five minutes

		var BPC_URL;

		try {
		  BPC_URL = Url.parse(process.env.BPC_URL);
		} catch (ex) {
		  console.error('Env var BPC_URL missing or invalid.');
		  process.exit(1);
		}

		const BPC_APP_ID = process.env.BPC_APP_ID;
        const BPC_APP_SECRET = process.env.BPC_APP_SECRET;
        const BPC_COOKIE_NAME = `${BPC_APP_ID}_ticket`;

		server.state(BPC_COOKIE_NAME, {
			// ttl: 1000 * 60 * 60 * 24 * 30, // (one month)
			ttl: 1000 * 60 * 60 * 24 * 30 * 12, // (one year)
			// ttl: null, // session time-life - cookies are deleted when the browser is closed
			isHttpOnly: false,
			isSecure: false,
			// isSameSite: false,
			path: '/',
			encoding: 'base64json'
		});

		log('Connecting to BPC on', BPC_URL.host, 'AS', BPC_APP_ID);

		this.env = Object.assign({}, BPC_URL, {
          app: BPC_APP_ID,
          state_name: BPC_COOKIE_NAME
		});

		this.app = {
			id: BPC_APP_ID,
			key: BPC_APP_SECRET,
			algorithm: 'sha256'
		};

        this.getAppTicket();
	}

	async getAppTicket() {
        try {
            const result = await this.request(
                {
                    path: '/ticket/app',
                    method: 'POST',
                    payload: {}
                },
                this.app
            );
            
            log('Got the appTicket');
            this.appTicket = result;
            setTimeout(() => { this.refreshAppTicket() }, result.exp - Date.now() - this.ticketBuffer);
        } catch(err) {
            console.error('getAppTicket:', err);
            setTimeout(() => { this.getAppTicket() }, this.errorTimeout);
        }
	};

	async refreshAppTicket() {
        try {
            const result = await this.request(
                {
                    path: '/ticket/reissue',
                    method: 'POST'
                },
                this.appTicket
            );
    
            this.appTicket = result;
            setTimeout(() => { this.refreshAppTicket() }, result.exp - Date.now() - this.ticketBuffer);
        } catch(err) {
            console.error('refreshAppTicket:', err);
            setTimeout(() => { this.getAppTicket() }, this.errorTimeout);
        }        
	};


	async request(options, credentials) {
        return new Promise((resolve, reject) => {
            Object.assign(options, {
                protocol: this.env.protocol,
                hostname: this.env.hostname,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (this.env.port){
                options.port = this.env.port;
            }

            // If the request should use the app ticket
            if (credentials === 'appTicket'){
                credentials = this.appTicket;
            }

            if (credentials !== undefined && credentials !== null && Object.keys(credentials).length > 1){
                var requestHref = Url.resolve(this.env.href, options.path);
                var hawkHeader = Hawk.client.header(requestHref, options.method || 'GET', {credentials: credentials, app: this.env.app});
                if (hawkHeader.err) {
                    console.error(hawkHeader.err);
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
                const data = await this.parseResponse(res);
                if(data.isBoom) {
                    return reject(data);
                }
                resolve(data);
            });
            
            req.on('error', async (err) => {
                console.error(err);
                reject(err);
            });
        });
	}


	async parseResponse (res) {
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
                        this.getAppTicket();
                    }

                    var err = new Boom(data.message, data);
                    return resolve(err);
                } else {
                    return resolve(data);
                }
            });
		});
    };
};
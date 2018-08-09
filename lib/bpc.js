/*jshint node: true */
'use strict';

const Boom = require('boom');
const Hawk = require('hawk');
const http = require('http');
const https = require('https');
const Url = require('url');
const { Service } = require('schmervice');

const routes = require('./routes');

class bpc extends Service {
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

		console.log('Connecting to BPC on', BPC_URL.host, 'AS', BPC_APP_ID);

		this.env = Object.assign({}, BPC_URL, {
		  app: BPC_APP_ID,
		});

		this.app = {
			id: BPC_APP_ID,
			key: BPC_APP_SECRET,
			algorithm: 'sha256'
		};

		this.getAppTicket();

	}

	getAppTicket() {

		this.request({
				path: '/ticket/app',
				method: 'POST',
				payload: {}
			},
			this.app,
			(err, result) => {
				if (err){
					console.error(err);
					setTimeout(() => { this.getAppTicket() }, this.errorTimeout);
				} else {
					console.log('Got the appTicket');
					this.appTicket = result;

					// Refresh ticket before expiration
					const expTime = result.exp - Date.now() - this.ticketBuffer;
					setTimeout(() => { this.refreshAppTicket() }, result.exp - Date.now() + this.ticketBuffer);
				}
			});

	};

	refreshAppTicket() {

		this.request({
				path: '/ticket/reissue',
				method: 'POST'
			},
			this.appTicket,
			(err, result) => {
				if (err){
					console.error('refreshAppTicket:', err);
					setTimeout(() => { this.getAppTicket }, this.errorTimeout);
				} else {
					this.appTicket = result;
					const expTime = result.exp - Date.now() - this.ticketBuffer;
					setTimeout(() => { this.refreshAppTicket }, result.exp - Date.now() - this.ticketBuffer);
				}
			});

	};


	request(options, credentials, callback) {

		Object.assign(options, {
			protocol: this.env.protocol,
			hostname: this.env.hostname
		});

		if (this.env.port){
			options.port = this.env.port;
		}

		if (callback === undefined && typeof credentials === 'function') {
			callback = credentials;
			credentials = null;
		}

		if (callback === undefined) {
			callback = function(err) {
				if (err) {
					console.error(err);;
				}
			}
		}

		// In case we want a request completely without any credentials, use {} as the credentials parameter to this function
		if (credentials === undefined || credentials === null){
			credentials = this.appTicket;
		}

		if (credentials !== undefined && credentials !== null && Object.keys(credentials).length > 1){
			var requestHref = Url.resolve(this.env.href, options.path);
			var hawkHeader = Hawk.client.header(requestHref, options.method || 'GET', {credentials: credentials, app: this.env.app});
			if (hawkHeader.err) {
				console.error(hawkHeader.err);
				return callback(new Error('Hawk header: ' + hawkHeader.err));
			}

			options.headers = {
				'Authorization': hawkHeader.header
			};
		}

		var reqHandler = https;
		if (options.protocol === 'http:') {
			reqHandler = http;
		}

		var req = reqHandler.request(options, this.parseResponse(callback));

		if (options.payload !== undefined && options.payload !== null){
			if (typeof options.payload === 'object'){
				req.write(JSON.stringify(options.payload));
			} else {
				req.write(options.payload);
			}
		}

		req.end();

		req.on('error', function (e) {
			console.error(e);
			callback(e);
		});
	}


	parseResponse (callback) {
		return function (res) {
			var data = '';

			res.on('data', function(d) {
				data = data + d;
			});

			res.on('end', function () {
				try {
					if (data.length > 0){
					  data = JSON.parse(data);
					}
				} catch (ex) {
					console.error('JSON parse error on: ', data);
					throw ex;
				}

				if (data.statusCode > 300) {

					if (data.statusCode === 401 && data.message === 'Expired ticket'){
						this.getAppTicket();
					}

					var err = Boom.create(data.statusCode, data.error.concat(' ', data.message), data.validation);
					callback(err, null);
				} else {
					callback(null, data);
				}
			});
		};
	}
};

module.exports = {
    bpc,
    plugins: [{
        name: 'bpc',
        version: '1.0.0',
        after: 'services',
        once: true,
        register(server) {
            server.route(routes);
        }
    }]
};

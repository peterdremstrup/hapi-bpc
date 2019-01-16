/*jshint node: true */
'use strict';

const Boom = require('boom');
const Joi = require('joi');

module.exports = [
    {
        method: 'POST',
        path: '/authenticate',
        options: {
            cors: false,
            state: {
                parse: true,
                failAction: 'log'
            },
            validate: {
                payload: Joi.object().keys({
                    UID: Joi.string(),
                    UIDSignature: Joi.string(),
                    signatureTimestamp: Joi.string(),
                    ID: Joi.strip(),
                    id_token: Joi.string(),
                    access_token: Joi.string(),
                    rsvp: Joi.string()
                })
                .xor('UID', 'id_token', 'rsvp')
                .with('UID', ['UIDSignature', 'signatureTimestamp'])
                .with('id_token', ['access_token'])
            }
        },
        handler: async function(request, h) {

            const bpc = request.server.services().bpc;
            const payload = Object.assign({}, request.payload, { app: bpc.app.id });
            let rsvp;

            if(payload.rsvp) {

                rsvp = payload.rsvp

            } else {

                // Doing the RSVP in the backend
                rsvp = await bpc.request(
                    {
                        path: '/rsvp',
                        method: 'POST',
                        payload: payload
                    }
                );
            }


            // Getting user ticket
            const userTicket = await bpc.request(
                {
                    path: '/ticket/user',
                    method: 'POST',
                    payload: rsvp
                },
                'appTicket'
            );

            h.state(bpc.env.state_name, userTicket);

            return h.response(userTicket);
        }
    },
    {
        method: 'GET',
        path: '/authenticate',
        options: {
            cors: false,
            state: {
                parse: true,
                failAction: 'log'
            }
        },
        handler: async function(request, h) {

            const bpc = request.server.services().bpc;
            const ticket = request.state[bpc.env.state_name];

            if (!ticket){

                throw Boom.unauthorized();

            }

            // Reissuing ticket.
            // This is also a check for valid grant.
            const reissuedTicket = await bpc.request(
                {
                    path: '/ticket/reissue',
                    method: 'POST'
                },
                ticket
            );

            h.state(bpc.env.state_name, reissuedTicket);

            return h.response(reissuedTicket);
        }
    },
    {
        method: 'DELETE',
        path: '/authenticate',
        options: {
            cors: false,
            state: {
                parse: true,
                failAction: 'log'
            }
        },
        handler: async function(request, h) {

            const bpc = request.server.services().bpc;

            // Deleting ticket from cookies.
            // This is not a global signout.
            h.unstate(bpc.env.state_name);
            
            return h.response({ status: 'ok' });
        }
    }
];

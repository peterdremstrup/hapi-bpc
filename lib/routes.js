/*jshint node: true */
'use strict';

const Boom = require('boom');
const Joi = require('joi');

module.exports = [
    {
        method: 'POST',
        path: '/authenticate',
        config: {
            cors: false,
            state: {
                parse: true,
                failAction: 'log'
            },
            validate: {
                payload: Joi.object().keys({
                    ID: Joi.string().required(),
                    id_token: Joi.string().required(),
                    access_token: Joi.string().required()
                })
            }
        },
        handler: async function(request, h) {

            const bpc = request.server.services().bpc;
            const payload = Object.assign({}, request.payload, { app: bpc.app.id });


            // Doing the RSVP in the backend
            const rsvp = await bpc.request(
                {
                    path: '/rsvp',
                    method: 'POST',
                    payload: payload
                },
                {}
            );

            const userTicket = await bpc.request(
                {
                    path: '/ticket/user',
                    method: 'POST',
                    payload: rsvp
                },
                null
            );

            h.state(bpc.env.state_name, userTicket);
            return h.response(userTicket);
        }
    },
    {
        method: 'DELETE',
        path: '/authenticate',
        config: {
        cors: false,
        state: {
            parse: true,
            failAction: 'log'
        }
        },
        handler: async function(request, h) {

            const bpc = request.server.services().bpc;
            // This is not a global signout.
            h.unstate(bpc.env.state_name);
            return null;
        }
    },
    {
        method: 'GET',
        path: '/authenticate/validate',
        config: {
            cors: false,
            state: {
                parse: true,
                failAction: 'log'
            }
        },
        handler: async function(request) {

            const bpc = request.server.services().bpc;
            const ticket = request.state[bpc.env.state_name];
            if (!ticket){
                return Boom.unauthorized();
            } else if (Date.now() > ticket.exp) {
                return Boom.unauthorized('expired ticket');
            }

            return await bpc.request({ path: '/validate' }, ticket);
        }
    },
    {
        method: 'GET',
        path: '/authenticate/ticket',
        config: {
            cors: false,
            state: {
                parse: true,
                failAction: 'log'
            }
        },
        handler: async function(request, h) {

            const bpc = request.server.services().bpc;

            if (request.state && request.state[bpc.env.state_name]) {

                const reissuedTicket = await bpc.request(
                    {
                        path: '/ticket/reissue',
                        method: 'POST'
                    },
                    request.state[bpc.env.state_name]
                );

                h.state(bpc.env.state_name, reissuedTicket);
                return h.response(reissuedTicket);

            } else {

                return Boom.badRequest();

            }
        }
    },
    {
        method: 'POST',
        path: '/authenticate/ticket',
        config: {
            cors: false,
            state: {
                parse: true,
                failAction: 'log'
            },
            validate: {
                payload: Joi.object().keys({
                    rsvp: Joi.string()
                })
            }
        },
        handler: async function(request, h) {

            const bpc = request.server.services().bpc;

            const userTicket = await bpc.request(
                {
                    path: '/ticket/user',
                    method: 'POST',
                    payload: request.payload
                },
                null
            );
            
            h.state(bpc.env.state_name, userTicket);
            return h.response(userTicket);
        }
    },
    {
        method: 'GET',
        path: '/authenticate/permissions',
        config: {
            cors: false,
            state: {
                parse: true,
                failAction: 'log'
            }
        },
        handler: async function(request) {

            const bpc = request.server.services().bpc;
            const ticket = request.state[bpc.env.state_name];
            if (!ticket){
                return Boom.unauthorized();
            } else if (Date.now() > ticket.exp) {
                return Boom.unauthorized('expired ticket');
            }

            return await bpc.request({ path: '/permissions' }, ticket);
        }
    }
];

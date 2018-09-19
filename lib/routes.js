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
                }
            );

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
            // This is not a global signout.
            h.unstate(bpc.env.state_name);
            return null;
        }
    },
    {
        method: 'GET',
        path: '/authenticate/validate',
        options: {
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

            if (ticket) {

                const reissuedTicket = await bpc.request(
                    {
                        path: '/ticket/reissue',
                        method: 'POST'
                    },
                    ticket
                );

                h.state(bpc.env.state_name, reissuedTicket);
                return h.response(reissuedTicket);

            } else {

                return Boom.unauthorized();

            }
        }
    },
    {
        method: 'POST',
        path: '/authenticate/ticket',
        options: {
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
                'appTicket'
            );
            
            h.state(bpc.env.state_name, userTicket);
            return h.response(userTicket);
        }
    },
    {
        method: 'GET',
        path: '/authenticate/permissions',
        options: {
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

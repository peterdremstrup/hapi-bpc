/*jshint node: true */
'use strict';

const Boom = require('boom');
const Joi = require('joi');

module.exports = [{
    method: 'POST',
    path: '/auth',
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
    handler: function(request) {

        const payload = Object.assign({}, request.payload, { app: server.services().bpc.env.app });

        // Doing the RSVP in the backend
        server.services().bpc.request({
                path: '/rsvp',
                method: 'POST',
                payload: payload
            },
            {},
            function (err, response) {
                if (err){
                    //reply.unstate('nyhedsbreveprofiladmin_ticket');
                    return err;
                }

                server.services().bpc.request({
                        path: '/ticket/user',
                        method: 'POST',
                        payload: response
                    },
                    null,
                    function (err, userTicket){
                        if (err){
                            //reply.unstate('nyhedsbreveprofiladmin_ticket');
                            return err;
                        }

                        //reply.state('nyhedsbreveprofiladmin_ticket', userTicket);
                        return userTicket;
                    });
            });
    }
},
{
    method: 'GET',
    path: '/auth/ticket',
    config: {
      cors: false,
      state: {
        parse: true,
        failAction: 'log'
      }
    },
    handler: function(request) {

      if (request.state && request.state.nyhedsbreveprofiladmin_ticket) {

        server.services().bpc.request({ path: '/ticket/reissue', method: 'POST' }, request.state.nyhedsbreveprofiladmin_ticket, function (err, reissuedTicket){
          if (err) {
            return err;
          }

          return reissuedTicket;
        });

      } else {

        return Boom.badRequest();

      }

    }
},
{
    method: 'POST',
    path: '/auth/ticket',
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
    handler: function(request) {
      server.services.bpc.request({ path: '/ticket/user', method: 'POST', payload: request.payload }, null, function (err, userTicket){
        if (err){
          reply.unstate('nyhedsbreveprofiladmin_ticket');
          return reply(err);
        }

        reply.state('nyhedsbreveprofiladmin_ticket', userTicket);
        reply(userTicket);
      });
    }
},
{
    method: 'DELETE',
    path: '/auth/ticket',
    config: {
      cors: false,
      state: {
        parse: true,
        failAction: 'log'
      }
    },
    handler: function(request) {
        // This is not a global signout.
        reply.unstate('nyhedsbreveprofiladmin_ticket');
        return;
    }
},
{
    method: 'GET',
    path: '/auth/permissions',
    config: {
      cors: false,
      state: {
        parse: true,
        failAction: 'log'
      }
    },
    handler: function(request) {
        const ticket = request.state.nyhedsbreveprofiladmin_ticket;
        if (!ticket){
            return Boom.unauthorized();
        } else if (Date.now() > ticket.exp) {
            return Boom.unauthorized('expired ticket');
        }

        return server.services().bpc.request({ path: '/permissions' }, ticket, reply);
    }
}];

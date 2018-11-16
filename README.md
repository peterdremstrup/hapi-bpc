# hapi-bpc

Hapi BPC plugin that enables service and auth scheme and strategy.

Requires ENV vars: `BPC_URL`, `BPC_APP_ID` and `BPC_APP_SECRET`.


Register plugin with Hapi.js:

```

server.register(require('hapi-bpc'), function(err) {
    ...

```

This will enable:

* Fetching and auto reissue of app ticket.
* Routes for clients to exchanges tickets with BPC.
* Management of the user ticket using a cookie.
* The _bpc_ service under `request.server.services().bpc`.
* Auth scheme and strategy _bpc_ to be used in routes.


Example:

```

    server.route({
        method: 'GET',
        path: '/',
        options: {
            auth: {
                strategy: 'bpc',
                access: {
                    scope: 'a_scope',
                    entity: 'any' // <- Can be any|app|user.
                }
            },
            state: {
                parse: true
            }
        },
        handler: (request, h) => {
            const bpc = request.server.services().bpc;

            const permissions = await bpc.request({
                path: '/permissions/{user}',
                method: 'GET'
            },
            'appTicket'); // <-- The string value 'appTicket' tells the service to use the app ticket to create the Hawk header.
            // Use null or undefined to not use any ticket - ie. an unauthenticated request.

            const userTicket = req.auth.credentials;
            // Note: req.auth.credentials can contain either a user ticket or an object {app, scope, exp} from the app ticket

            const permissions = await bpc.request({
                path: '/permissions',
                method: 'GET'
            },
            userTicket); // <-- Used the userTicket from state (aka. a cookie) to create the Hawk header.
        }
    });

```

## Auth scheme

When using the auth scheme `bpc`, the routes support both a) having the BPC ticket in a cookie, and b) a Hawk Authorization header created using a BPC ticket.

## Routes

These routes will be registeret with the Hapi server:

### [POST /authenticate]

This endpoint will trigger both a `POST /rsvp` and a `POST /ticket/user` request to BPC.

Payload must be the same as with a `POST /rsvp` request. Response will be a user _ticket_.

### [DELETE /authenticate]

This endpoint removes the ticket from the cookies. No other requests are made.

### [GET /authenticate]

This endpoint will trigger a `POST /ticket/reissue` request to BPC.

This request will check for valid grant.

### [GET /authenticate/validate]

This endpoint will trigger a `POST /validate` request to BPC.

This request does _not_ check for valid grant - _only_ valid user ticket.

If the ticket is expired, it will be tried reissued.

### [GET /authenticate/permissions]

This endpoint will trigger a `GET /permissions` request to BPC.

Response will be the permission object.

If the ticket is expired, it will be tried reissued.

### [POST /authenticate/ticket/user]

This endpoint will trigger a `POST /ticket/user` request to BPC.

Payload must be a _rsvp_.

This endpoint is not strictly needed for applications using the `POST|GET /authenticate` endpoints, but used for applications wher the `/rsvp` are done in the client.


# Developing

Clone this repo and register it with NPM locally using the command: `npm link`

Change directory to the Hapi.js project. Link the local version this repo using the command `npm link hapi-bpc`.

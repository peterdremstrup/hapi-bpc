# hapi-bpc

This package is published on NPM: [https://www.npmjs.com/package/hapi-bpc](https://www.npmjs.com/package/hapi-bpc)

Hapi BPC plugin that enables service, routes and auth scheme and strategy.

Benefits of the plugin:

* Fetching and auto reissue of app ticket.
* Auth scheme and strategy _bpc_ to be used in route options.
* Routes for clients to exchanges tickets with BPC.
* Management of the user ticket using a cookie.
* A _bpc client_ is available in the Hapi toolkit as `h.bpc`.

The _scheme_ (and _strategy_) enables the decoration of routes auth-options. See example usage in the route options below.

These routes will accept authorization in form of either A) a cookie containing BPC ticket or B) an Hawk Authorization header generated using a BPC ticket. Each request will be validated with a request to BPC.

The _toolkit_ enables interaction with BPC with a minmal effort. See example usage in the handler below.

The _routes_ enables endpoints for clients to interact with BPC with a minimal effort. See overview below.


The plugin requires ENV vars: `BPC_URL`, `BPC_APP_ID` and `BPC_APP_SECRET`.

Install plugin using:

```
npm install --save hapi-bpc
```



Register plugin with Hapi.js and connect to BPC:

```
await server.register(require('hapi-bpc'));
await server.bpc.connect();

```

## Auth scheme and toolkit

After registering the plugin, routes can be decorated with the auth scheme `bpc`. The auth scheme support both A) having the BPC ticket in a cookie, and B) a Hawk Authorization header created using a BPC ticket.

Autorized requests will have the credentials stored in the `req.auth.credentials` object.

The BPC client will also be available on the request toolkit as `h.bpc`.
See [https://github.com/BerlingskeMedia/bpc_client](https://github.com/BerlingskeMedia/bpc_client)

Example usage:

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

            // Getting the bpc client from toolkit to interact with BPC
            const bpc = h.bpc;

            const permissions = await bpc.request({
                path: '/permissions/{some_user_id}/{some_scope}',
                method: 'GET'
            },
            'appTicket'); // <-- The string value 'appTicket' tells the bpc client to use the app ticket to create the Hawk header.
            // Use null or undefined to not use any ticket - ie. an unauthenticated request.

            // The user ticket is available because of the auth strategy.
            const userTicket = req.auth.credentials;
            // Note: req.auth.credentials can contain either a user ticket or an object {app, scope, exp} from the app ticket

            const permissions = await bpc.request({
                path: '/permissions/{some_scope}',
                method: 'GET'
            },
            userTicket); // <-- Used the userTicket from state (aka. a cookie) to create the Hawk header.
        }
    });

```


## Routes

These routes will be registeret with the Hapi server:

### [POST /authenticate]

Payload can be a _rsvp_ or a Gigya/Google user session.

If payload is _rsvcp_ this endpoint will trigger a `POST /ticket/user` request to BPC.

If payload is a user session, this endpoint will trigger both a `POST /rsvp` and a `POST /ticket/user` request to BPC.

Response will be a user _ticket_.

### [GET /authenticate]

This endpoint will trigger a `POST /ticket/reissue` request to BPC.

This request will check for valid grant.

### [DELETE /authenticate]

This endpoint removes the ticket from the cookies. No other requests are made.


# Developing

Clone this repo and register it with NPM locally using the command: `npm link`

Change directory to the Hapi.js project. Link the local version this repo using the command `npm link hapi-bpc`.

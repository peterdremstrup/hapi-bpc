# hapi-bpc

This package is published on NPM: [https://www.npmjs.com/package/hapi-bpc](https://www.npmjs.com/package/hapi-bpc)

Hapi BPC plugin that enables service, routes and auth scheme and strategy.

Benefits of the plugin:

* Fetching and auto reissue of app ticket.
* Auth scheme and strategy _bpc_ to be used in route options.
* Routes for clients to exchanges tickets with BPC.
* Management of the user ticket using a cookie. Standard cookie settings can be overriden.
* A _bpc client_ is available on the request toolkit as `h.bpc` and the server as `server.bpc`.
* The Hawk library is available on the server as `server.hawk`.

The _scheme_ (and _strategy_) enables the decoration of routes auth-options. See example usage in the route options below.

These routes will accept authorization in form of either A) a cookie containing BPC ticket or B) an Hawk Authorization header generated using a BPC ticket. Each request will be validated with a request to BPC.

The _toolkit_ enables interaction with BPC with a minmal effort. See example usage in the handler below.

The _routes_ enables endpoints for clients to interact with BPC with a minimal effort. See overview below.


The plugin requires ENV vars: `BPC_URL`, `BPC_APP_ID` and `BPC_APP_KEY`.

Install plugin using:

```
npm install --save hapi-bpc
```


Register plugin with Hapi.js and connect to BPC:

```
await server.register(require('hapi-bpc'));
// Or: await server.register({ plugin: require('hapi-bpc'), options: { cors: false }});
await server.bpc.connect();

```

To override the standard cookie/state, use the options object, when registering the plugin.
See [https://hapi.dev/api/?v=18.3.2#server.state()](https://hapi.dev/api/?v=18.3.2#server.state()) for details on possile settings and values.

Example:

```
await server.register({ plugin: require('hapi-bpc'), options: { state: { ttl: null, encoding: 'none' } }});

```


If the ticket cookie must be served over a non-secure/non-HTTPS connection (eg. localhost development), set ENV var `SECURE_COOKIE=false`.

## Auth scheme and toolkit

After registering the plugin, routes can be decorated with the auth scheme `bpc`. The auth scheme support both A) having the BPC ticket in a cookie, and B) a Hawk Authorization header created using a BPC ticket.

Autorized requests will have the credentials stored in the `req.auth.credentials` object.

The BPC client will also be available on the request toolkit as `h.bpc`.
See [https://github.com/BerlingskeMedia/bpc_client](https://github.com/BerlingskeMedia/bpc_client)

The Hawk library is also available on the server as `server.hawk`.

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

            // The user details are available because of the auth strategy.
            const credentials = request.auth.credentials;
            // Note: request.auth.credentials can contain either a user ticket or an object {app, scope, exp} from the app ticket

            const permissions = await bpc.request({
                path: `/permissions/${credentials.user}/{some_scope}`,
                method: 'GET'
            });

            // In case the client is using the /authorize endpoints (also from this plugin) to authorize users
            // the user ticket is available in the request state.
            const userTicket = request.state[bpc.state_name];

            // User tickets can be used for BPC requests as well, like this:
            const permissions = await bpc.request({
                path: `/permissions/{some_scope}`,
                method: 'GET'
            }, userTicket);
        }
    });

```



Another example usage, where there is roles added to the app scopes. (In BPC, roles (`role:`) is a reserved form of scope.) Roles are created and added via the BPC Console.
In the example below, a _user_ and _admin_ are allow to get the data. But only an _admin_ are allowed post data.

See section [Scope](https://github.com/BerlingskeMedia/bpc#scope)

```
register: function (server, options) {

    const bpc_app_id = server.bpc.app.id;

    server.route({
        method: 'GET',
        path: '/data',
        options: {
            auth: {
                strategy: 'bpc',
                access: {
                    scope: [
                        `role:${ bpc_app_id }:user`,
                        `role:${ bpc_app_id }:admin`
                    ],
                    entity: 'user'
                }
            },
        },
        handler: (request, h) => {
            // Your magic here
        }
    });


    server.route({
        method: 'POST',
        path: '/data',
        options: {
            auth: {
                strategy: 'bpc',
                access: {
                    scope: [
                        `role:${ bpc_app_id }:admin`
                    ],
                    entity: 'user'
                }
            },
        },
        handler: (request, h) => {
            // Your magic here
        }
    });
}

```


## Routes

These routes will be registeret with the Hapi server:

### [GET|POST /authorize]

This route must be called to authorize the user in order to authorize request to routes decorated with the auth scheme `bpc`.

Querystring/payload can be empty, a _rsvp_ or a Gigya/Google user session.

If querystring/payload is _rsvp_ this endpoint will trigger a `POST /ticket/user` request to BPC.

If querystring/payload is a Gigya or Google user session, this endpoint will trigger both a `POST /rsvp` and a `POST /ticket/user` request to BPC.

If payload is a ticket, the ticket will be used in a `POST /ticket/reissue` request to BPC.
This request will check for valid grant.

If querystring/payload is empty, a ticket in cookie will be used in a `POST /ticket/reissue` request to BPC.
This request will check for valid grant.

Response will be a user _ticket_.

Response will also include a cookie, that is protected by the flags _SameSite=Strict_, _Secure_ and _HttpOnly_.


### [DELETE /authorize]

This endpoint removes the ticket from the cookies. No other requests are made.


# Developing

Clone this repo and register it with NPM locally using the command: `npm link`

Change directory to the Hapi.js project. Link the local version this repo using the command `npm link hapi-bpc`.

# Publish to NPM

Before you can publish, you need to be maintainer and run `npm login`.

Do this:

1. Commit/merge your change to master branch.
2. Run `npm version major|minor|patch` to increase the semver version in package.json file.
3. Run `npm publish`.
4. Run `git push`.

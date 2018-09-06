# hapi-bpc

Hapi BPC plugin that enables service and auth scheme and strategy.

Requires ENV vars: `BPC_URL`, `BPC_APP_ID` and `BPC_APP_SECRET`.


Register plugin:

```

server.register(require('hapi-bpc'), function(err) {
    ...

```

This will enable:

* Fetching and auto reissue of app ticket.
* Endpoints that quickly allows exchanges of tickets with BPC.
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
            // Use null or undefined to not use any ticket.

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

When using the auth scheme `bpc`, the endpoints support both a) having the BPC ticket in a cookie, and b) a Hawk Authorization header created using a BPC ticket.

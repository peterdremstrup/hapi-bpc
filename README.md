# hapi-bpc

Hapi BPC plugin that enables service and auth scheme and strategy.

Requires ENV vars: `BPC_URL`, `BPC_APP_ID` and `BPC_APP_SECRET`.


Register plugin:

```

server.register(require('hapi-bpc'), function(err) {

```

This will enable:

* Getting and auto reissue of app ticket.
* Endpoints that quickly allows exchanges of tickets with BPC
* The _bpc_ service under `request.server.services().bpc`
* Auth scheme and strategy _bpc_ to be used in routes.


Registering route with auth scheme:

```

    server.route({
        method: 'GET',
        path: '/',
        options: {
            auth: {
                strategy: 'bpc',
                access: {
                    scope: 'a_scope',
                    entity: 'any|app|user'
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
            'appTicket');

            const userTicket = request.state[bpc.env.state_name];

            const permissions = await bpc.request({
                path: '/permissions',
                method: 'GET'
            },
            userTicket);
        }

    });

```

/// <reference path="../.pocketbase/pb_data/types.d.ts" />
// Accounts are created by the superuser (the dashboard, or `npm run pixelgen:user`).
// A null create rule means the public API cannot sign anyone up, including as a guest.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '@request.body.role:isset = false || @request.body.role = "user"';
    app.save(users);
  },
);

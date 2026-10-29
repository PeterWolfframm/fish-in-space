/// <reference path="../.pocketbase/pb_data/types.d.ts" />
// One cloud save per signed-in member. Offline play stays in IndexedDB until sync.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const saves = new Collection({
      type: 'base',
      name: 'seedfall_saves',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: 'user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
      deleteRule: 'user = @request.auth.id',
      fields: [
        { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
        { type: 'json', name: 'state', required: true, maxSize: 5000000 },
        { type: 'number', name: 'schemaVersion', required: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_seedfall_saves_user ON seedfall_saves (user)'],
    });
    app.save(saves);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('seedfall_saves'));
  },
);

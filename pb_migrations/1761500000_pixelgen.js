/// <reference path="../.pocketbase/pb_data/types.d.ts" />
// pixelgen's collections: who swiped (users, guests included), what they swiped (swipes), and
// what was learnt (models: one public, one personal per user).
//
// Access, in rules rather than code:
//   - anyone can sign up, as role "user" only; nobody but a superuser can set role
//   - a guest may change its own email and password once (manageRule), to become a real account
//   - a swipe is visible to its owner and to admins; only its owner can add or undo (delete) it
//   - the public model is readable by everyone signed in and written by the trainer (superuser)
//     or an admin ("retrain now"); a personal model is its owner's to write, admins can read it

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new BoolField({ name: 'guest' }));
    users.fields.add(new SelectField({ name: 'role', values: ['user', 'admin'], maxSelect: 1 }));
    users.listRule = 'id = @request.auth.id || @request.auth.role = "admin"';
    users.viewRule = 'id = @request.auth.id || @request.auth.role = "admin"';
    users.createRule = '@request.body.role:isset = false || @request.body.role = "user"';
    users.updateRule = 'id = @request.auth.id && @request.body.role:isset = false';
    users.manageRule = 'id = @request.auth.id && guest = true && @request.body.role:isset = false';
    users.deleteRule = 'id = @request.auth.id';
    app.save(users);

    const swipes = new Collection({
      type: 'base',
      name: 'swipes',
      listRule: 'user = @request.auth.id || @request.auth.role = "admin"',
      viewRule: 'user = @request.auth.id || @request.auth.role = "admin"',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: null,
      deleteRule: 'user = @request.auth.id',
      fields: [
        { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
        { type: 'text', name: 'kind', required: true, max: 40 },
        { type: 'text', name: 'code', required: true, max: 200 },
        { type: 'text', name: 'seed', max: 200 },
        { type: 'select', name: 'verdict', required: true, values: ['approve', 'pass'], maxSelect: 1 },
        { type: 'json', name: 'fix', maxSize: 20000 },
        { type: 'json', name: 'instead', maxSize: 20000 },
        { type: 'text', name: 'asKind', max: 40 },
        { type: 'text', name: 'note', max: 2000 },
        { type: 'json', name: 'scores', maxSize: 2000 },
        { type: 'text', name: 'mode', max: 40 },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_swipes_user ON swipes (user)', 'CREATE INDEX idx_swipes_created ON swipes (created)'],
    });
    app.save(swipes);

    const models = new Collection({
      type: 'base',
      name: 'models',
      listRule: '(scope = "public" && @request.auth.id != "") || user = @request.auth.id || @request.auth.role = "admin"',
      viewRule: '(scope = "public" && @request.auth.id != "") || user = @request.auth.id || @request.auth.role = "admin"',
      createRule:
        '@request.auth.id != "" && ((@request.body.scope = "personal" && @request.body.user = @request.auth.id) || (@request.body.scope = "public" && @request.auth.role = "admin" && @request.body.user:isset = false))',
      updateRule:
        '(scope = "personal" && user = @request.auth.id && (@request.body.scope:isset = false || @request.body.scope = "personal") && (@request.body.user:isset = false || @request.body.user = @request.auth.id)) || (scope = "public" && @request.auth.role = "admin" && (@request.body.scope:isset = false || @request.body.scope = "public") && @request.body.user:isset = false)',
      deleteRule: 'scope = "personal" && user = @request.auth.id',
      fields: [
        { type: 'select', name: 'scope', required: true, values: ['public', 'personal'], maxSelect: 1 },
        { type: 'relation', name: 'user', collectionId: users.id, maxSelect: 1, cascadeDelete: true },
        { type: 'json', name: 'weights', maxSize: 16000000 },
        { type: 'text', name: 'schema', max: 40 },
        { type: 'json', name: 'stats', maxSize: 200000 },
        { type: 'date', name: 'trainedAt' },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_models_scope_user ON models (scope, user)'],
    });
    app.save(models);
  },
  (app) => {
    for (const name of ['models', 'swipes']) app.delete(app.findCollectionByNameOrId(name));
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('guest');
    users.fields.removeByName('role');
    app.save(users);
  },
);

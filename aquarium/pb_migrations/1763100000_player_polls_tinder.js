/// <reference path="../.pocketbase/pb_data/types.d.ts" />
// Per-member bridge poll votes and Fish Tinder tier list (swipes stay in `swipes`).

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const pollVotes = new Collection({
      type: 'base',
      name: 'poll_votes',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: 'user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
      deleteRule: 'user = @request.auth.id',
      fields: [
        { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
        { type: 'text', name: 'regionId', required: true, max: 40 },
        { type: 'text', name: 'nameId', required: true, max: 80 },
        { type: 'number', name: 'weight', required: true, noDecimal: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_poll_votes_user_region_name ON poll_votes (user, regionId, nameId)',
        'CREATE INDEX idx_poll_votes_user ON poll_votes (user)',
      ],
    });
    app.save(pollVotes);

    const tinderState = new Collection({
      type: 'base',
      name: 'tinder_state',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      updateRule: 'user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
      deleteRule: 'user = @request.auth.id',
      fields: [
        { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
        { type: 'json', name: 'tiers', required: true, maxSize: 500000 },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_tinder_state_user ON tinder_state (user)'],
    });
    app.save(tinderState);
  },
  (app) => {
    for (const name of ['tinder_state', 'poll_votes']) app.delete(app.findCollectionByNameOrId(name));
  },
);

// Train and load the two kinds of model, the same way in the trainer (Node) and the app (browser).
//
//   public    trained from scratch on everyone's swipes (users weighted 1/√n)
//   personal  the public model fine-tuned on one user's swipes, so it is useful after a handful;
//             from scratch when there is no public model yet
//
// A stored model is {scope, user, weights: Net JSON, schema, stats, trainedAt}; one whose schema
// isn't the current feature layout loads as null and gets retrained.

import { Net, fineTune } from './net.js';
import { toRows, fit, evaluate } from './dataset.js';
import { schema, l2Mask } from './features.js';

/** {net, stats} from swipes, or null with nothing to learn from. */
export function trainModel(swipes, { scope = 'public', base = null, epochs = 40, k = 0, cache } = {}) {
  const rows = toRows(swipes, { scope, cache });
  if (rows.length < 2) return null;
  const tune = scope === 'personal' && base;
  const make = (rs) => (tune ? fineTune(base, rs, { l2Mask: l2Mask() }) : fit(rs, { epochs }));
  const net = make(rows);
  const approve = swipes.filter((s) => s.verdict === 'approve').length;
  const stats = {
    swipes: swipes.length,
    rows: rows.length,
    users: new Set(swipes.map((s) => s.user)).size,
    approveRate: swipes.length ? approve / swipes.length : 0,
    fromPublic: !!tune,
    lastSwipe: swipes.reduce((m, s) => (s.created > m ? s.created : m), ''),
  };
  if (k && rows.length >= k * 4) stats.accuracy = evaluate(rows, make, { k }).accuracy;
  net.meta = { schema: schema(), scope, trainedAt: new Date().toISOString() };
  return { net, stats };
}

/** A Net from a stored model record, or null if missing or trained on another layout. */
export function loadModel(record) {
  if (!record?.weights || record.schema !== schema()) return null;
  try {
    return Net.fromJSON(record.weights);
  } catch {
    return null;
  }
}

/** The fields to store for a trained model. */
export const modelRecord = (scope, net, stats, user = null) => ({
  scope,
  ...(user ? { user } : {}),
  weights: net.toJSON(),
  schema: schema(),
  stats,
  trainedAt: new Date().toISOString(),
});

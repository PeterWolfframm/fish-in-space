#!/usr/bin/env node
import { adminClient } from '../server/pb.mjs';

const [email] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const demote = process.argv.includes('--demote');
const pb = await adminClient();

if (!email) {
  const admins = await pb.collection('users').getFullList({ filter: 'role = "admin"' });
  console.log(admins.length ? admins.map((u) => `${u.email}${u.name ? ` (${u.name})` : ''}`).join('\n') : 'no admins yet');
  process.exit(0);
}

const user = await pb
  .collection('users')
  .getFirstListItem(pb.filter('email = {:email}', { email }))
  .catch(() => null);
if (!user) {
  console.error(`no user with email ${email} — create one with: npm run pixelgen:user ${email} <password>`);
  process.exit(1);
}
if (!demote) {
  const others = await pb.collection('users').getFullList({ filter: pb.filter('role = "admin" && id != {:id}', { id: user.id }) });
  if (others.length) console.log(`note: ${others.map((u) => u.email).join(', ')} ${others.length > 1 ? 'are' : 'is'} admin too`);
}
await pb.collection('users').update(user.id, { role: demote ? 'user' : 'admin' });
console.log(`${email} is now ${demote ? 'a user' : 'the admin'}`);

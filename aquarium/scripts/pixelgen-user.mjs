#!/usr/bin/env node
import { adminClient } from '../server/pb.mjs';

const [email, password, ...nameParts] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('usage: npm run pixelgen:user <email> <password> [name]');
  console.error('password must be at least 8 characters');
  process.exit(1);
}

const pb = await adminClient();
const existing = await pb.collection('users').getFirstListItem(pb.filter('email = {:email}', { email })).catch(() => null);
if (existing) {
  console.error(`${email} already exists`);
  process.exit(1);
}
const name = nameParts.join(' ') || email.split('@')[0];
await pb.collection('users').create({
  email,
  password,
  passwordConfirm: password,
  name,
  guest: false,
  emailVisibility: false,
});
console.log(`created ${email} (${name})`);

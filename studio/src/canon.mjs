// Content hashes. Every stored object and every commit id is the sha256 of canonical JSON (canonical.mjs).
import crypto from 'node:crypto';
import { canonical } from './canonical.mjs';

export { canonical };
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hashOf = (v) => sha256(canonical(v));
// Stored objects hash their kind too, so an empty assets list and an empty components list are two objects, not one.
export const objectHash = (kind, v) => sha256(`${kind}\0${canonical(v)}`);
export const short = (h) => String(h).slice(0, 10);

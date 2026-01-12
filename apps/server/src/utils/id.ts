import { randomUUID } from 'node:crypto';

export function createId() {
  return `req_${randomUUID()}`;
}

export function createSessionId() {
  return `sess_${randomUUID()}`;
}

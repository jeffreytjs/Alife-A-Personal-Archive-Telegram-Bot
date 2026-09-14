import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canUseAlternate,
  consumeAlternate,
  subscribe,
  resetSubscriberStoreForTests,
} from '../services/subscriberStore.js';

describe('subscriberStore', () => {
  it('allows one alternate per date key', () => {
    resetSubscriberStoreForTests();
    subscribe(42);
    const dateKey = '2026-09-14';
    assert.equal(canUseAlternate(42, dateKey), true);
    consumeAlternate(42, dateKey);
    assert.equal(canUseAlternate(42, dateKey), false);
  });
});

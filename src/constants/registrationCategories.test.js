import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PREFERRED_CATEGORY_OPTIONS,
  REGISTRATION_CATEGORIES,
  REGISTRATION_SPORT_EVENT_OPTIONS,
} from './registrationCategories.js';
import { SPORT_OPTIONS } from './studentRegistrationOptions.js';

test('registration categories contain the complete, unique category hierarchy', () => {
  assert.deepEqual(REGISTRATION_CATEGORIES.map(({ name }) => name), [
    'Sports Event',
    'Visual Arts',
    'Music',
    'Dance',
    'Dramatic Art',
    'Literary Art',
    'Esports',
  ]);

  const sportsEvent = REGISTRATION_CATEGORIES[0];
  assert.deepEqual(sportsEvent.subcategories.map(({ name }) => name), [
    'Ball & Team Sports',
    'Racket & Net Sports',
    'Combat Sports & Martial Arts',
    'Individual & Accuracy Sports',
    'Dance Sports',
  ]);

  const sports = sportsEvent.subcategories.flatMap(({ sports: options }) => options);
  const events = REGISTRATION_CATEGORIES.slice(1).flatMap(({ events: options }) => options);
  assert.equal(sports.length, 34);
  assert.equal(events.length, 37);
  assert.equal(new Set([...sports, ...events]).size, sports.length + events.length);
  assert.equal(REGISTRATION_SPORT_EVENT_OPTIONS.length, sports.length + events.length);
  assert.ok(REGISTRATION_SPORT_EVENT_OPTIONS.every((option) => SPORT_OPTIONS.includes(option)));
  assert.ok(SPORT_OPTIONS.includes('Football Men'));
  assert.ok(sports.includes('Basketball (Women)'));
  assert.ok(sports.includes('Softball (Women)'));
  assert.ok(sports.includes('Tae-Kwon-Do (Men)'));
  assert.ok(events.includes('Additional Role: Technical – Sound/Music (Handles sound effects and music during the play to help set the mood of the Scenes)'));
  assert.ok(events.includes('Mobile Legends: Bang Bang'));
});

test('preferred category options match the racket and net sport flow', () => {
  assert.deepEqual(PREFERRED_CATEGORY_OPTIONS, [
    'Singles',
    'Doubles',
    'Mixed Doubles',
    'Any / Flexible',
    'Not Applicable',
  ]);
});

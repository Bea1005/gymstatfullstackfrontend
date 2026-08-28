import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEPARTMENT_OPTIONS,
  SPORT_OPTIONS,
  YEAR_LEVEL_OPTIONS,
} from './studentRegistrationOptions.js';

test('registration option lists stay aligned with screener filters', () => {
  assert.ok(DEPARTMENT_OPTIONS.includes('Bachelor of Science in Information Technology'));
  assert.ok(DEPARTMENT_OPTIONS.includes('Bachelor of Science in Criminology'));
  assert.ok(!DEPARTMENT_OPTIONS.some((option) => option.includes('CICS') || option.includes('CENG') || option.includes('CIT')));
  assert.deepEqual(YEAR_LEVEL_OPTIONS, ['I', 'II', 'III', 'IV']);
  assert.ok(SPORT_OPTIONS.includes('Badminton Women'));
  assert.ok(SPORT_OPTIONS.includes('Volleyball Women'));
  assert.ok(SPORT_OPTIONS.includes('Football Men'));
});

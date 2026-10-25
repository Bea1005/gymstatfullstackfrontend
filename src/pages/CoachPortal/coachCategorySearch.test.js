import test from 'node:test';
import assert from 'node:assert/strict';

import { filterCoachCategoryOptions, groupAndSortCoachCategoryOptions } from './coachCategorySearch.js';
import { SPORT_OPTIONS } from '../../constants/studentRegistrationOptions.js';

test('category search filters specific sports and events case-insensitively', () => {
  assert.ok(filterCoachCategoryOptions('basket').some((sport) => sport.includes('Basketball')));
  assert.ok(filterCoachCategoryOptions('soft').some((sport) => sport.includes('Softball')));
  assert.ok(filterCoachCategoryOptions('badminton (women)').includes('Badminton (Women)'));
  assert.ok(filterCoachCategoryOptions('VISUAL ARTS').includes('Pencil Drawing'));
  assert.ok(filterCoachCategoryOptions('dramatic art').includes('Radio Drama'));
  assert.ok(filterCoachCategoryOptions('literary art').includes('Essay Writing'));
  assert.ok(filterCoachCategoryOptions('esports').includes('Call of Duty: Mobile'));
  assert.ok(filterCoachCategoryOptions('dance sports').includes('Dance Sports (Latin)'));
});

test('clearing the query restores all existing options and unmatched queries are empty', () => {
  assert.deepEqual(filterCoachCategoryOptions(''), SPORT_OPTIONS);
  assert.deepEqual(filterCoachCategoryOptions('no matching event'), []);
});

test('sports and event options are sorted separately without changing the option set', () => {
  const groups = groupAndSortCoachCategoryOptions(filterCoachCategoryOptions(''));
  const collator = new Intl.Collator('en', { sensitivity: 'base' });

  assert.deepEqual(groups.sports, [...groups.sports].sort(collator.compare));
  assert.deepEqual(groups.events, [...groups.events].sort(collator.compare));
  assert.deepEqual([...groups.sports, ...groups.events].sort(), [...SPORT_OPTIONS].sort());
});

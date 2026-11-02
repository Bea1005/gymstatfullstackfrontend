import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterCoachCategoryOptions,
  getCoachGalleryCategoryLabel,
  groupAndSortCoachCategoryOptions,
  isCoachGalleryCategorySelected,
} from './coachCategorySearch.js';
import { REGISTRATION_SPORT_EVENT_OPTIONS } from '../../constants/registrationCategories.js';

test('category search filters specific sports and events case-insensitively', () => {
  assert.ok(filterCoachCategoryOptions('basket').some((sport) => sport.includes('Basketball')));
  assert.ok(filterCoachCategoryOptions('soft').some((sport) => sport.includes('Softball')));
  assert.ok(filterCoachCategoryOptions('badminton (women)').includes('Badminton (Women)'));
  assert.ok(!filterCoachCategoryOptions('badminton (women)').includes('Badminton Women'));
  assert.ok(filterCoachCategoryOptions('VISUAL ARTS').includes('Pencil Drawing'));
  assert.ok(filterCoachCategoryOptions('dramatic art').includes('Radio Drama'));
  assert.ok(filterCoachCategoryOptions('literary art').includes('Essay Writing'));
  assert.ok(filterCoachCategoryOptions('esports').includes('Call of Duty: Mobile'));
  assert.ok(filterCoachCategoryOptions('dance sports').includes('Dance Sports (Latin)'));
});

test('Gallery options use the official registration sports and events', () => {
  const options = filterCoachCategoryOptions('');
  assert.deepEqual(options, REGISTRATION_SPORT_EVENT_OPTIONS);
  assert.ok(options.includes('Basketball (Women)'));
  assert.ok(options.includes('Mobile Legends: Bang Bang'));
  assert.ok(options.includes('Pencil Drawing'));
  assert.ok(!options.includes('Basketball Women'));
});

test('legacy coach assignments display and select their canonical Gallery option', () => {
  assert.equal(getCoachGalleryCategoryLabel('Basketball Women'), 'Basketball (Women)');
  assert.equal(isCoachGalleryCategorySelected('Basketball Women', 'Basketball (Women)'), true);
  assert.equal(getCoachGalleryCategoryLabel('Mobile Legends: Bang Bang'), 'Mobile Legends: Bang Bang');
});

test('clearing the query restores all Gallery options and unmatched queries are empty', () => {
  assert.deepEqual(filterCoachCategoryOptions(''), REGISTRATION_SPORT_EVENT_OPTIONS);
  assert.deepEqual(filterCoachCategoryOptions('no matching event'), []);
});

test('sports and event options are sorted separately without changing the option set', () => {
  const groups = groupAndSortCoachCategoryOptions(filterCoachCategoryOptions(''));
  const collator = new Intl.Collator('en', { sensitivity: 'base' });

  assert.deepEqual(groups.sports, [...groups.sports].sort(collator.compare));
  assert.deepEqual(groups.events, [...groups.events].sort(collator.compare));
  assert.deepEqual(
    [...groups.sports, ...groups.events].sort(),
    filterCoachCategoryOptions('').sort()
  );
});

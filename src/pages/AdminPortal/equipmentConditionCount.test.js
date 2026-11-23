import assert from 'node:assert/strict';
import test from 'node:test';
import { getLostEquipmentCount } from './equipmentConditionCount.js';

test('counts unique Lost reference IDs across equipment types', () => {
  assert.equal(getLostEquipmentCount([
    { type: 'Basketball', referenceId: 'BALL-001', condition: 'Lost' },
    { type: 'Volleyball', referenceId: 'VOL-001', condition: 'lost' },
    { type: 'Racket', referenceId: 'RAC-001', condition: 'Good' },
    { type: 'Paddle', referenceId: 'PAD-001', condition: 'Repair' },
    { type: 'Basketball', referenceId: 'BALL-001', condition: 'Lost' },
  ]), 2);
});

test('counts only individually Lost references when a record contains multiple IDs', () => {
  assert.equal(getLostEquipmentCount([
    {
      type: 'Volleyball',
      referenceIds: ['VOL-001', 'VOL-002', 'VOL-003'],
      referenceConditions: ['Lost', 'Good', 'Damaged'],
      condition: 'Lost',
    },
  ]), 1);
});

test('uses the record condition when per-reference conditions are absent', () => {
  assert.equal(getLostEquipmentCount([
    {
      type: 'Table Tennis',
      referenceIds: ['TT-001', 'TT-002'],
      condition: 'Lost',
    },
    {
      type: 'Table Tennis',
      referenceIds: ['TT-003'],
      referenceConditions: ['Good'],
      condition: 'Lost',
    },
  ]), 2);
});

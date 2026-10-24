import assert from 'node:assert/strict';
import test from 'node:test';
import { filterEquipmentGroups } from './equipmentSearch.js';

const equipment = [
  {
    id: 'basketballs',
    name: 'Basketball',
    condition: 'Good',
    available: 1,
    onLoan: 0,
    total: 1,
    referenceId: 'BSB1013001',
    referenceIds: ['BSB1013001', 'BSB1013002'],
    items: [
      { referenceId: 'BSB1013001', condition: 'Good', available: 1, onLoan: 0, totalStock: 1 },
      { referenceId: 'BSB1013002', condition: 'Lost', available: 0, onLoan: 0, totalStock: 1 }
    ]
  },
  {
    id: 'volleyballs',
    name: 'Volleyball',
    condition: 'Damaged',
    available: 0,
    onLoan: 0,
    total: 1,
    referenceId: 'VOL1013001',
    referenceIds: ['VOL1013001'],
    items: [
      { referenceId: 'VOL1013001', condition: 'Damaged', available: 0, onLoan: 0, totalStock: 1 }
    ]
  }
];

test('searches equipment names and Reference IDs without case sensitivity', () => {
  assert.deepEqual(filterEquipmentGroups(equipment, 'BASKET'), [equipment[0]]);
  assert.deepEqual(filterEquipmentGroups(equipment, 'vol1013001'), [equipment[1]]);
});

test('filters by the actual saved condition and only shows matching units', () => {
  const good = filterEquipmentGroups(equipment, 'Good');
  const damaged = filterEquipmentGroups(equipment, 'damaged');
  const lost = filterEquipmentGroups(equipment, 'LOST');

  assert.deepEqual(good[0].items.map((item) => item.referenceId), ['BSB1013001']);
  assert.deepEqual(damaged[0].items.map((item) => item.referenceId), ['VOL1013001']);
  assert.deepEqual(lost[0].items.map((item) => item.referenceId), ['BSB1013002']);
  assert.equal(lost[0].condition, 'Lost');
});

test('supports combined name, Reference ID, and condition keywords', () => {
  assert.deepEqual(
    filterEquipmentGroups(equipment, 'basketball lost'),
    [filterEquipmentGroups(equipment, 'Lost')[0]]
  );
  assert.equal(filterEquipmentGroups(equipment, 'vol1013001 DAMAGED').length, 1);
  assert.equal(filterEquipmentGroups(equipment, 'basketball good lost').length, 0);
});

test('returns the full masterlist when the search is empty or whitespace', () => {
  assert.equal(filterEquipmentGroups(equipment, ''), equipment);
  assert.equal(filterEquipmentGroups(equipment, '   '), equipment);
});

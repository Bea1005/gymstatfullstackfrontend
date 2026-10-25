import assert from 'node:assert/strict';
import test from 'node:test';
import {
  toggleEquipmentReferenceSelection,
  toggleEquipmentSelection,
} from './borrowingEquipmentSelection.js';

test('selecting and deselecting equipment clears only its Reference IDs', () => {
  const selected = toggleEquipmentSelection(['Volleyball'], {
    Volleyball: ['VB-01'],
  }, 'Baseball');
  assert.deepEqual(selected, {
    selectedEquipment: ['Volleyball', 'Baseball'],
    selectedReferenceIdsByEquipment: { Volleyball: ['VB-01'], Baseball: [] },
  });

  const deselected = toggleEquipmentSelection(selected.selectedEquipment, {
    ...selected.selectedReferenceIdsByEquipment,
    Baseball: ['BB-01'],
  }, 'Baseball');
  assert.deepEqual(deselected, {
    selectedEquipment: ['Volleyball'],
    selectedReferenceIdsByEquipment: { Volleyball: ['VB-01'] },
  });
});

test('Reference ID selections are scoped to their equipment and can be toggled off', () => {
  const next = toggleEquipmentReferenceSelection({ Volleyball: ['VB-01'] }, 'Baseball', 'BB-01');
  assert.deepEqual(next, { Volleyball: ['VB-01'], Baseball: ['BB-01'] });
  assert.deepEqual(
    toggleEquipmentReferenceSelection(next, 'Baseball', 'BB-01'),
    { Volleyball: ['VB-01'], Baseball: [] }
  );
});

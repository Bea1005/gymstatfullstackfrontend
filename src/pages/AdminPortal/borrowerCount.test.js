import assert from 'node:assert/strict';
import test from 'node:test';
import { getUniqueBorrowerCount } from './borrowerCount.js';

test('counts each normalized borrower name once', () => {
  assert.equal(getUniqueBorrowerCount([
    { fullname: ' Alex Smith ' },
    { fullname: 'alex smith' },
    { fullname: 'Jordan Lee' }
  ]), 2);
});

test('prefers stable borrower IDs when names differ', () => {
  assert.equal(getUniqueBorrowerCount([
    { fullname: 'Alex Smith', studentId: 'S-01' },
    { fullname: 'Alex S.', studentId: 'S-01' },
    { fullname: 'Jordan Lee', studentId: 'S-02' }
  ]), 2);
});

test('uses populated borrowedBy only when its name matches the transaction borrower', () => {
  assert.equal(getUniqueBorrowerCount([
    {
      fullname: 'Alex Smith',
      borrowedBy: { _id: 'user-1', fullname: 'Alex Smith' }
    },
    {
      fullname: 'Jordan Lee',
      borrowedBy: { _id: 'admin-1', fullname: 'Admin User' }
    },
    {
      fullname: 'Jordan Lee',
      borrowedBy: { _id: 'admin-1', fullname: 'Admin User' }
    }
  ]), 2);
});

test('ignores records without borrower identity', () => {
  assert.equal(getUniqueBorrowerCount([{}, { fullname: '  ' }]), 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { getMissingCoachUploadLabels } from './coachStudentUploadStatus.js';

const publishedRequirements = [
  { id: 'medical-req', title: 'Medical Certificate', type: 'medical' },
  { id: 'psa-req', title: 'PSA', type: 'psa' },
  { id: 'insurance-req', title: 'Insurance', type: 'insurance' },
  { id: 'cor-req', title: 'Certificate of Registration', type: 'cor' },
  { id: 'custom-1', title: 'Proof of Residency', type: 'other', hasDocument: false },
  { id: 'file-requirement', title: 'Attached Form', type: 'other', hasDocument: true },
];

test('shows every available upload-card label when a student has no uploads', () => {
  assert.deepEqual(
    getMissingCoachUploadLabels(publishedRequirements, []),
    ['Medical Certificate', 'PSA', 'Insurance', 'Proof of Residency']
  );
});

test('treats submitted files as uploaded regardless of review status', () => {
  const uploads = [
    { requirementType: 'medical', fileName: 'medical.pdf', status: 'rejected' },
    { requirementType: 'other', customRequirementId: 'custom-1', fileName: 'residency.pdf', status: 'pending' },
  ];

  assert.deepEqual(
    getMissingCoachUploadLabels(publishedRequirements, uploads),
    ['PSA', 'Insurance']
  );
});

test('returns no missing labels when all required upload cards have files', () => {
  const uploads = [
    { requirementType: 'medical', fileName: 'medical.pdf' },
    { requirementType: 'psa', fileName: 'psa.pdf' },
    { requirementType: 'insurance', fileName: 'insurance.pdf' },
    { requirementType: 'other', customRequirementId: 'custom-1', fileName: 'residency.pdf' },
  ];

  assert.deepEqual(getMissingCoachUploadLabels(publishedRequirements, uploads), []);
});

test('does not count another student custom requirement or empty file record as uploaded', () => {
  const uploads = [
    { requirementType: 'other', customRequirementId: 'different-custom', fileName: 'other.pdf' },
    { requirementType: 'medical', fileName: '' },
  ];

  assert.deepEqual(
    getMissingCoachUploadLabels(publishedRequirements, uploads),
    ['Medical Certificate', 'PSA', 'Insurance', 'Proof of Residency']
  );
});

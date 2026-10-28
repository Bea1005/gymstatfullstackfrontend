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

test('requires uploaded files to be approved before they count as complete', () => {
  const uploads = [
    { requirementType: 'medical', fileName: 'medical.pdf', status: 'rejected' },
    { requirementType: 'other', customRequirementId: 'custom-1', fileName: 'residency.pdf', coachStatus: 'pending' },
  ];

  assert.deepEqual(
    getMissingCoachUploadLabels(publishedRequirements, uploads),
    ['Medical Certificate', 'PSA', 'Insurance', 'Proof of Residency']
  );
});

test('returns no missing labels when all required upload cards have approved files', () => {
  const uploads = [
    { requirementType: 'medical', fileName: 'medical.pdf', status: 'approved' },
    { requirementType: 'psa', fileName: 'psa.pdf', status: 'approved' },
    { requirementType: 'insurance', fileName: 'insurance.pdf', status: 'approved' },
    { requirementType: 'other', customRequirementId: 'custom-1', fileName: 'residency.pdf', coachStatus: 'approved' },
  ];

  assert.deepEqual(getMissingCoachUploadLabels(publishedRequirements, uploads), []);
});

test('treats coach-approved uploads as complete even when the top-level status is still pending', () => {
  const uploads = [
    { requirementType: 'medical', fileName: 'medical.pdf', status: 'pending', coachStatus: 'approved' },
    { requirementType: 'psa', fileName: 'psa.pdf', status: 'approved', coachStatus: 'pending' },
    { requirementType: 'insurance', fileName: 'insurance.pdf', status: 'pending', coachStatus: 'approved' },
    { requirementType: 'other', customRequirementId: 'custom-1', fileName: 'residency.pdf', status: 'pending', coachStatus: 'approved' },
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

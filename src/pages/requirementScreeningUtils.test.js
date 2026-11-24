import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildActiveRequirementBoxColumns,
  getCoachRequirementCounts,
  getCoachScreeningEmptyStateMessage,
  getRequirementColumnEntry,
  getScreenerRequirementCounts,
} from './requirementScreeningUtils.js';

test('builds table columns only from active custom requirement boxes with unique IDs', () => {
  const requirements = [
    {
      _id: 'custom-1',
      title: 'Supporting Document',
      type: 'other',
      status: 'published',
      isActive: true,
    },
    {
      _id: 'custom-2',
      title: 'Supporting Document',
      type: 'other',
      status: 'published',
      isActive: true,
    },
    {
      _id: 'uploaded-custom',
      title: 'Uploaded Template',
      type: 'other',
      status: 'published',
      isActive: true,
      file: { filename: 'template.pdf' },
    },
    {
      _id: 'uploaded-standard',
      title: 'Uploaded Standard Form',
      type: 'medical',
      status: 'published',
      isActive: true,
    },
    {
      _id: 'inactive',
      title: 'Inactive Requirement',
      type: 'other',
      status: 'published',
      isActive: false,
    },
    {
      _id: 'archived',
      title: 'Archived Requirement',
      type: 'other',
      status: 'archived',
      isActive: false,
    },
    {
      _id: 'draft',
      title: 'Draft Requirement',
      type: 'other',
      status: 'draft',
      isActive: true,
    },
    {
      _id: 'custom-1',
      title: 'Duplicate Record',
      type: 'other',
      status: 'published',
      isActive: true,
    },
  ];

  assert.deepEqual(
    buildActiveRequirementBoxColumns(requirements),
    [
      {
        id: 'custom:custom-1',
        type: 'other',
        requirementId: 'custom-1',
        label: 'Supporting Document',
      },
      {
        id: 'custom:custom-2',
        type: 'other',
        requirementId: 'custom-2',
        label: 'Supporting Document',
      },
    ]
  );
});

test('maps each table cell by requirement ID and selects only its latest submission', () => {
  const [firstColumn, secondColumn] = buildActiveRequirementBoxColumns([
    {
      _id: 'custom-1',
      title: 'Supporting Document',
      type: 'other',
      status: 'published',
      isActive: true,
    },
    {
      _id: 'custom-2',
      title: 'Supporting Document',
      type: 'other',
      status: 'published',
      isActive: true,
    },
  ]);
  const requirements = {
    documents: [
      {
        customRequirementId: 'custom-1',
        customRequirementLabel: 'Supporting Document',
        status: 'rejected',
        uploadedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        customRequirementId: 'custom-2',
        customRequirementLabel: 'Supporting Document',
        status: 'approved',
        uploadedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        customRequirementId: 'custom-2',
        customRequirementLabel: 'Supporting Document',
        status: 'pending',
        uploadedAt: '2026-01-03T00:00:00.000Z',
      },
    ],
  };

  assert.equal(getRequirementColumnEntry(requirements, firstColumn).status, 'rejected');
  assert.equal(getRequirementColumnEntry(requirements, secondColumn).status, 'pending');
});

test('counts only the latest uploaded requirement with an active definition and coach review status', () => {
  const publishedRequirements = [
    { _id: 'medical', type: 'medical', status: 'published', isActive: true },
    { _id: 'insurance', type: 'insurance', status: 'published', isActive: true },
    {
      _id: 'custom-active',
      type: 'other',
      status: 'published',
      isActive: true,
      file: { filename: 'admin-template.pdf' },
    },
    { _id: 'custom-inactive', type: 'other', status: 'published', isActive: false },
    { _id: 'custom-archived', type: 'other', status: 'archived', isActive: true },
    {
      _id: 'custom-volleyball',
      type: 'other',
      targetStudents: 'sport-specific',
      sport: 'Volleyball',
      status: 'published',
      isActive: true,
    },
  ];
  const students = [{
    requirements: {
      documents: [
        {
          requirementType: 'medical',
          coachStatus: 'approved',
          hasUpload: true,
          sport: 'Basketball Women',
          uploadedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          requirementType: 'medical',
          coachStatus: 'pending',
          hasUpload: true,
          sport: 'Basketball Women',
          uploadedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          requirementType: 'insurance',
          coachStatus: 'pending',
          hasUpload: false,
          sport: 'Basketball Women',
        },
        {
          customRequirementId: 'custom-active',
          coachStatus: 'approved',
          hasUpload: true,
          finalStatus: 'pending',
          sport: 'Basketball Women',
        },
        {
          customRequirementId: 'custom-inactive',
          coachStatus: 'approved',
          hasUpload: true,
          sport: 'Basketball Women',
        },
        {
          customRequirementId: 'custom-archived',
          coachStatus: 'pending',
          hasUpload: true,
          sport: 'Basketball Women',
        },
        {
          customRequirementId: 'custom-volleyball',
          coachStatus: 'pending',
          hasUpload: true,
          sport: 'Volleyball',
        },
      ],
    },
  }];

  assert.deepEqual(
    getCoachRequirementCounts(students, publishedRequirements, 'Basketball Women'),
    { pendingRequirements: 1, verifiedRequirements: 1 }
  );
});

test('counts distinct forwarded uploads by final Screener status and selected sport', () => {
  const documents = [
    {
      submissionId: 'pending-1',
      participationType: 'Intrams',
      status: 'pending',
      coachStatus: 'approved',
      hasUpload: true,
      screenerForwardedAt: '2026-10-01',
      sport: 'Basketball',
      files: [{ fileName: 'front.jpg' }, { fileName: 'back.jpg' }],
    },
    {
      submissionId: 'pending-1',
      participationType: 'Intrams',
      status: 'pending',
      coachStatus: 'approved',
      hasUpload: true,
      screenerForwardedAt: '2026-10-01',
      sport: 'Basketball',
    },
    {
      submissionId: 'verified-1',
      participationType: 'STRASUC',
      status: 'approved',
      coachStatus: 'approved',
      hasUpload: true,
      screenerForwardedAt: '2026-10-01',
      sport: 'Basketball',
    },
    {
      submissionId: 'coach-only',
      status: 'approved',
      coachStatus: 'pending',
      hasUpload: true,
      screenerForwardedAt: '2026-10-01',
      sport: 'Basketball',
    },
    {
      submissionId: 'unforwarded',
      status: 'pending',
      coachStatus: 'approved',
      hasUpload: true,
      sport: 'Basketball',
    },
    {
      submissionId: 'missing-file',
      status: 'pending',
      coachStatus: 'approved',
      hasUpload: false,
      screenerForwardedAt: '2026-10-01',
      sport: 'Basketball',
    },
    {
      submissionId: 'returned',
      status: 'returned',
      coachStatus: 'approved',
      hasUpload: true,
      screenerForwardedAt: '2026-10-01',
      sport: 'Basketball',
    },
    {
      submissionId: 'rejected',
      status: 'rejected',
      coachStatus: 'approved',
      hasUpload: true,
      screenerForwardedAt: '2026-10-01',
      sport: 'Basketball',
    },
    {
      submissionId: 'other-sport',
      status: 'pending',
      coachStatus: 'approved',
      hasUpload: true,
      screenerForwardedAt: '2026-10-01',
      sport: 'Volleyball',
    },
  ];
  const students = [
    { id: 'athlete-1', requirements: { documents } },
    { id: 'athlete-1', requirements: { documents: [documents[0]] } },
    {
      id: 'athlete-2',
      requirements: {
        documents: [{
          submissionId: 'athlete-2-pending',
          status: 'pending',
          coachStatus: 'approved',
          hasUpload: true,
          screenerForwardedAt: '2026-10-01',
          sport: 'Basketball',
        }],
      },
    },
  ];

  assert.deepEqual(
    getScreenerRequirementCounts(students, 'Basketball'),
    { totalStudents: 2, pendingRequirements: 2, verifiedRequirements: 1 }
  );
});

test('uses the year-level-specific empty state only when that year has no athletes', () => {
  assert.equal(
    getCoachScreeningEmptyStateMessage('II', false),
    'No student-athlete from this year level'
  );
  assert.equal(
    getCoachScreeningEmptyStateMessage('II', true),
    'No student requirements match your assigned sports.'
  );
  assert.equal(
    getCoachScreeningEmptyStateMessage('All', false),
    'No student requirements match your assigned sports.'
  );
});

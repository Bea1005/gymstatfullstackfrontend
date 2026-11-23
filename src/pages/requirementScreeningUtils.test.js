import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildActiveRequirementBoxColumns,
  getRequirementColumnEntry,
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

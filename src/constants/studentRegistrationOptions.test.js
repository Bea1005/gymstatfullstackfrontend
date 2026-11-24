import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEPARTMENT_OPTIONS,
  YEAR_LEVEL_OPTIONS,
} from './studentRegistrationOptions.js';
import COLLEGE_DEPARTMENT_OPTIONS from '../../../shared/collegeDepartmentOptions.json' with { type: 'json' };

test('registration option lists stay aligned with screener filters', () => {
  assert.ok(DEPARTMENT_OPTIONS.includes('Bachelor of Science in Information Technology'));
  assert.ok(DEPARTMENT_OPTIONS.includes('Bachelor of Science in Criminology'));
  assert.ok(!DEPARTMENT_OPTIONS.some((option) => option.includes('CICS') || option.includes('CENG') || option.includes('CIT')));
  assert.equal(new Set(DEPARTMENT_OPTIONS).size, DEPARTMENT_OPTIONS.length);
  assert.deepEqual(YEAR_LEVEL_OPTIONS, ['I', 'II', 'III', 'IV']);
});

test('college registration options only include existing programs mapped to the requested colleges', () => {
  const mappedDepartments = Object.values(COLLEGE_DEPARTMENT_OPTIONS).flat();

  assert.deepEqual(Object.keys(COLLEGE_DEPARTMENT_OPTIONS), [
    'College of Allied Health Sciences',
    'College of Arts and Social Sciences',
    'College of Business and Accountancy',
    'College of Education',
    'College of Engineering',
    'College of Environmental Studies',
    'College of Governance',
    'College of Industrial Technology',
    'College of Information and Computing Sciences',
  ]);
  assert.equal(new Set(mappedDepartments).size, mappedDepartments.length);
  assert.ok(mappedDepartments.every((department) => DEPARTMENT_OPTIONS.includes(department)));
  assert.ok(!mappedDepartments.includes('Bachelor of Science in Agriculture'));
  assert.ok(!mappedDepartments.includes('Bachelor of Science in Fisheries'));
  assert.ok(!mappedDepartments.includes('Bachelor of Science in Fisheries and Aquatic Resources Management'));
  assert.ok(!mappedDepartments.includes('Bachelor of Science in Criminology'));
});

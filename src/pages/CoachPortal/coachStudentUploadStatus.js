const REQUIRED_UPLOAD_LABELS = [
  ['medical', 'Medical Certificate'],
  ['psa', 'PSA'],
  ['insurance', 'Insurance'],
  ['profile', 'Profile'],
  ['consent', 'Parent Consent'],
];

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeRequirementType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  const aliases = {
    medicalcertificate: 'medical',
    psa: 'psa',
    insurance: 'insurance',
    profile: 'profile',
    parentconsent: 'consent',
    certificateofregistration: 'cor',
    cor: 'cor',
  };

  return aliases[compact] || compact;
};

const hasUploadedFile = (upload) => (
  upload?.hasFile === true || Boolean(String(upload?.fileName || '').trim())
);

const isApprovedUpload = (upload) => {
  if (!hasUploadedFile(upload)) return false;

  const candidateStatuses = [
    upload?.status,
    upload?.coachStatus,
    upload?.reviewStatus,
    upload?.approvalStatus,
    upload?.requirementStatus,
  ];

  return candidateStatuses.some((status) => normalizeStatus(status) === 'approved');
};

export const getMissingCoachUploadLabels = (publishedRequirements, uploads) => {
  const activeRequirements = Array.isArray(publishedRequirements) ? publishedRequirements : [];
  const uploadedRequirements = Array.isArray(uploads) ? uploads : [];

  const publishedTypes = new Set(
    activeRequirements
      .map((requirement) => normalizeRequirementType(requirement?.type))
      .filter(Boolean)
  );

  const approvedUploadKeys = new Set();
  uploadedRequirements.forEach((upload) => {
    if (!isApprovedUpload(upload)) return;

    const uploadType = normalizeRequirementType(upload?.requirementType || upload?.type || upload?.documentType || '');
    const uploadKey = uploadType ? `type:${uploadType}` : '';
    if (uploadKey) approvedUploadKeys.add(uploadKey);

    if (uploadType === 'other') {
      const customRequirementId = String(upload?.customRequirementId || upload?.customRequirement || '').trim();
      if (customRequirementId) approvedUploadKeys.add(`custom:${customRequirementId}`);
    }
  });

  const missingLabels = [];
  const seenLabels = new Set();

  REQUIRED_UPLOAD_LABELS.forEach(([type, label]) => {
    const normalizedType = normalizeRequirementType(type);
    if (!publishedTypes.has(normalizedType)) return;
    if (approvedUploadKeys.has(`type:${normalizedType}`)) return;
    if (!seenLabels.has(label)) {
      seenLabels.add(label);
      missingLabels.push(label);
    }
  });

  const customRequirements = activeRequirements
    .filter((requirement) => (
      normalizeRequirementType(requirement?.type) === 'other'
      && !requirement?.hasDocument
      && String(requirement?.id || requirement?._id || '').trim()
    ))
    .map((requirement) => ({
      id: String(requirement.id || requirement._id || '').trim(),
      title: String(requirement.title || '').trim(),
    }));

  customRequirements.forEach(({ id, title }) => {
    if (!title) return;
    if (approvedUploadKeys.has(`custom:${id}`)) return;
    if (!seenLabels.has(title)) {
      seenLabels.add(title);
      missingLabels.push(title);
    }
  });

  return missingLabels;
};

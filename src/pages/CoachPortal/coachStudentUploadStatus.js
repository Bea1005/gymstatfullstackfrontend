const REQUIRED_UPLOAD_LABELS = [
  ['medical', 'Medical Certificate'],
  ['psa', 'PSA'],
  ['insurance', 'Insurance'],
  ['profile', 'Profile'],
  ['consent', 'Parent Consent'],
];

const hasUploadedFile = (upload) => (
  upload?.hasFile === true || Boolean(String(upload?.fileName || '').trim())
);

export const getMissingCoachUploadLabels = (publishedRequirements, uploads) => {
  const activeRequirements = Array.isArray(publishedRequirements) ? publishedRequirements : [];
  const uploadedRequirements = Array.isArray(uploads) ? uploads : [];
  const publishedTypes = new Set(activeRequirements.map((requirement) => (
    String(requirement?.type || '').trim().toLowerCase()
  )));

  const missingLabels = REQUIRED_UPLOAD_LABELS
    .filter(([type]) => publishedTypes.has(type))
    .filter(([type]) => !uploadedRequirements.some((upload) => (
      String(upload?.requirementType || '').trim().toLowerCase() === type
      && hasUploadedFile(upload)
    )))
    .map(([, label]) => label);

  const customRequirements = new Map(
    activeRequirements
      .filter((requirement) => (
        String(requirement?.type || '').trim().toLowerCase() === 'other'
        && !requirement.hasDocument
        && requirement.id
      ))
      .map((requirement) => [String(requirement.id), requirement])
  );

  for (const [requirementId, requirement] of customRequirements) {
    const isUploaded = uploadedRequirements.some((upload) => (
      String(upload?.requirementType || '').trim().toLowerCase() === 'other'
      && String(upload?.customRequirementId || '') === requirementId
      && hasUploadedFile(upload)
    ));
    if (!isUploaded && requirement.title) missingLabels.push(requirement.title);
  }

  return missingLabels;
};

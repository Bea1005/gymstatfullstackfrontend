const normalizeSportValue = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase();

const normalizeRequirementType = (value) => (
  String(value ?? '').trim().toLocaleLowerCase() === 'medical'
    ? 'med'
    : String(value ?? '').trim().toLocaleLowerCase()
);

export const buildRequirementColumns = (publishedRequirements, sport = 'All') => {
  const columnsById = new Map();
  const normalizeSportScope = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLocaleLowerCase();
  const selectedSport = normalizeSportScope(sport);

  (Array.isArray(publishedRequirements) ? publishedRequirements : [])
    .filter((requirement) => (
      requirement?.status === 'published'
      && requirement.isActive !== false
      && typeof requirement.type === 'string'
    ))
    .forEach((requirement) => {
      if (sport !== 'All' && requirement.targetStudents === 'sport-specific') {
        const assignedSports = String(requirement.sport || '')
          .split('|')
          .map(normalizeSportScope)
          .filter(Boolean);
        if (!assignedSports.includes(selectedSport)) return;
      }

      const requirementId = String(requirement._id || requirement.id || '').trim();
      const type = requirement.type.trim().toLocaleLowerCase();
      if (type === 'other' && (
        !requirementId
        || requirement.file?.filename
        || requirement.file?.path
      )) return;

      const id = type === 'other' ? `custom:${requirementId}` : `type:${normalizeRequirementType(type)}`;
      if (columnsById.has(id)) return;

      const label = String(requirement.title || '').trim();
      columnsById.set(id, {
        id,
        type,
        requirementId,
        label: label || requirement.type
      });
    });

  return Array.from(columnsById.values());
};

export const getRequirementColumnEntry = (requirements, column) => {
  const documents = Array.isArray(requirements?.documents) ? requirements.documents : [];
  const matchingDocuments = documents.filter((document) => {
    if (column.type === 'other') {
      return String(document.customRequirementId || '') === column.requirementId;
    }

    return normalizeRequirementType(document.requirementType) === column.id.slice('type:'.length);
  });

  return matchingDocuments.reduce((latest, document) => (
    !latest || new Date(document.uploadedAt || 0) > new Date(latest.uploadedAt || 0)
      ? document
      : latest
  ), null);
};

export const getSportScopedRequirements = (requirements, sport) => {
  if (!sport) return requirements || {};

  const targetSport = normalizeSportValue(sport);
  const documents = (Array.isArray(requirements?.documents) ? requirements.documents : [])
    .filter((entry) => {
      const documentSports = String(entry?.sport || '')
        .split('|')
        .map(normalizeSportValue)
        .filter(Boolean);

      return !documentSports.length
        || documentSports.includes('general')
        || documentSports.includes(targetSport);
    });

  const scopedRequirements = {
    cor: null,
    med: null,
    psa: null,
    insurance: null,
    profile: null,
    consent: null,
    documents,
  };

  documents.forEach((document) => {
    const key = document.requirementType === 'medical' ? 'med' : document.requirementType;
    if (!(key in scopedRequirements) || key === 'documents') return;

    const currentEntry = scopedRequirements[key];
    if (!currentEntry || new Date(document.uploadedAt || 0) > new Date(currentEntry.uploadedAt || 0)) {
      scopedRequirements[key] = document;
    }
  });

  return { ...requirements, ...scopedRequirements };
};

export const areRequirementsComplete = (requirements) => {
  const requiredTypes = ['med', 'psa', 'insurance', 'profile', 'consent'];
  const requiredTypesApproved = requiredTypes.every((type) => requirements?.[type]?.status === 'approved');
  const additionalDocumentsApproved = (Array.isArray(requirements?.documents) ? requirements.documents : [])
    .filter((document) => String(document?.requirementType || '').toLowerCase() !== 'cor')
    .every((document) => document?.status === 'approved');

  return requiredTypesApproved && additionalDocumentsApproved;
};

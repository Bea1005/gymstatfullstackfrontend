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

const normalizeSportScope = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N}]+/gu, '')
  .toLocaleLowerCase();

export const buildRequirementColumns = (publishedRequirements, sport = 'All') => {
  const columnsById = new Map();
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

const buildRequirementCounterColumns = (publishedRequirements, sport) => {
  const columnsById = new Map();
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

      const type = requirement.type.trim().toLocaleLowerCase();
      const requirementId = String(requirement._id || requirement.id || '').trim();
      const id = type === 'other'
        ? (requirementId ? `custom:${requirementId}` : '')
        : `type:${normalizeRequirementType(type)}`;
      if (id && !columnsById.has(id)) {
        columnsById.set(id, { id, type, requirementId });
      }
    });

  return Array.from(columnsById.values());
};

export const buildActiveRequirementBoxColumns = (publishedRequirements, sport = 'All') => (
  buildRequirementColumns(
    (Array.isArray(publishedRequirements) ? publishedRequirements : [])
      .filter((requirement) => (
        String(requirement?.type || '').trim().toLocaleLowerCase() === 'other'
        && !requirement.file?.filename
        && !requirement.file?.path
      )),
    sport
  )
);

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

export const getCoachRequirementCounts = (students, publishedRequirements, sport = 'All') => {
  const columns = buildRequirementCounterColumns(publishedRequirements, sport);
  const selectedSport = sport === 'All' ? '' : sport;
  const counts = { pendingRequirements: 0, verifiedRequirements: 0 };

  (Array.isArray(students) ? students : []).forEach((student) => {
    const requirements = getSportScopedRequirements(student?.requirements, selectedSport);
    columns.forEach((column) => {
      const entry = getRequirementColumnEntry(requirements, column);
      if (entry?.hasUpload !== true) return;

      const coachStatus = String(entry.coachStatus || '').trim().toLocaleLowerCase();
      if (coachStatus === 'approved') counts.verifiedRequirements += 1;
      if (coachStatus === 'pending') counts.pendingRequirements += 1;
    });
  });

  return counts;
};

export const getScreenerRequirementCounts = (students, sport = 'All') => {
  const athletes = new Set();
  const requirements = new Set();
  const counts = { totalStudents: 0, pendingRequirements: 0, verifiedRequirements: 0 };
  const selectedSport = sport === 'All' ? '' : sport;

  (Array.isArray(students) ? students : []).forEach((student) => {
    const athleteId = String(student?.id || student?._id || '').trim();
    if (!athleteId) return;

    const scopedRequirements = getSportScopedRequirements(student?.requirements, selectedSport);
    const documents = Array.isArray(scopedRequirements.documents) ? scopedRequirements.documents : [];
    documents.forEach((document) => {
      const submissionId = String(document?.submissionId || '').trim();
      if (!submissionId
        || document.hasUpload !== true
        || !document.screenerForwardedAt
        || String(document.coachStatus || '').trim().toLowerCase() !== 'approved') return;

      const requirementKey = `${athleteId}:${document.participationType || ''}:${submissionId}`;
      if (requirements.has(requirementKey)) return;
      requirements.add(requirementKey);
      athletes.add(athleteId);

      const finalStatus = String(document.finalStatus ?? document.status ?? '').trim().toLowerCase();
      if (finalStatus === 'pending') counts.pendingRequirements += 1;
      if (finalStatus === 'approved') counts.verifiedRequirements += 1;
    });
  });

  counts.totalStudents = athletes.size;
  return counts;
};

export const getCoachScreeningEmptyStateMessage = (yearLevelFilter, hasStudentsForYearLevel) => (
  yearLevelFilter !== 'All' && !hasStudentsForYearLevel
    ? 'No student-athlete from this year level'
    : 'No student requirements match your assigned sports.'
);

export const areDisplayedRequirementsComplete = (requirements, columns) => {
  const displayedDocuments = (Array.isArray(columns) ? columns : [])
    .map((column) => getRequirementColumnEntry(requirements, column))
    .filter(Boolean);

  return displayedDocuments.length > 0 && displayedDocuments.every((document) => (
    document.coachStatus === 'approved'
    && document.hasUpload === true
    && document.status === 'approved'
  ));
};

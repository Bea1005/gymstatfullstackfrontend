const normalizeReferenceId = (referenceId) => String(referenceId || '')
  .trim()
  .toLocaleUpperCase();

const isLostCondition = (condition) => String(condition || '')
  .trim()
  .toLocaleLowerCase() === 'lost';

export const getLostEquipmentCount = (equipmentRecords) => {
  const lostReferenceIds = new Set();

  (Array.isArray(equipmentRecords) ? equipmentRecords : []).forEach((record) => {
    const referenceIds = Array.isArray(record?.referenceIds) && record.referenceIds.length
      ? record.referenceIds
      : [record?.referenceId];
    const hasIndividualConditions = Array.isArray(record?.referenceConditions)
      && record.referenceConditions.length > 0;

    referenceIds.forEach((referenceId, index) => {
      const normalizedReferenceId = normalizeReferenceId(referenceId);
      if (!normalizedReferenceId) return;

      const condition = hasIndividualConditions
        ? record.referenceConditions[index]
        : record.condition;
      if (isLostCondition(condition)) {
        lostReferenceIds.add(normalizedReferenceId);
      }
    });
  });

  return lostReferenceIds.size;
};

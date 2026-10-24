const CONDITIONS = new Set(['good', 'damaged', 'lost']);

const normalize = (value) => String(value || '').trim().toLocaleLowerCase();

const matchesSearch = (equipmentName, item, terms) => {
  const name = normalize(equipmentName);
  const referenceId = normalize(item.referenceId);
  const condition = normalize(item.condition);

  return terms.every((term) => {
    if (CONDITIONS.has(term)) {
      return condition === term;
    }
    return name.includes(term) || referenceId.includes(term) || condition.includes(term);
  });
};

export const filterEquipmentGroups = (equipmentGroups, search) => {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return equipmentGroups;
  }

  return equipmentGroups.flatMap((equipment) => {
    const equipmentItems = Array.isArray(equipment.items) && equipment.items.length > 0
      ? equipment.items
      : [{
        referenceId: equipment.referenceId,
        condition: equipment.condition
      }];
    const matchingItems = equipmentItems.filter((item) => (
      matchesSearch(equipment.name, item, terms)
    ));

    if (matchingItems.length === 0) {
      return [];
    }

    if (matchingItems.length === equipmentItems.length) {
      return [equipment];
    }

    const available = matchingItems.reduce((sum, item) => sum + Number(item.available || 0), 0);
    const onLoan = matchingItems.reduce((sum, item) => sum + Number(item.onLoan || 0), 0);
    const total = matchingItems.reduce((sum, item) => sum + Number(item.totalStock || 0), 0);
    const referenceIds = matchingItems.map((item) => item.referenceId).filter(Boolean);

    return [{
      ...equipment,
      available,
      onLoan,
      total,
      referenceId: referenceIds[0] || '',
      referenceIds,
      items: matchingItems,
      condition: matchingItems.every((item) => normalize(item.condition) === normalize(matchingItems[0].condition))
        ? matchingItems[0].condition
        : equipment.condition
    }];
  });
};

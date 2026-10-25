export const toggleEquipmentSelection = (selectedEquipment, selectedReferenceIdsByEquipment, equipmentName) => {
  const isSelected = selectedEquipment.includes(equipmentName);
  const nextReferenceIdsByEquipment = { ...selectedReferenceIdsByEquipment };
  if (isSelected) {
    delete nextReferenceIdsByEquipment[equipmentName];
  } else {
    nextReferenceIdsByEquipment[equipmentName] = [];
  }

  return {
    selectedEquipment: isSelected
      ? selectedEquipment.filter((name) => name !== equipmentName)
      : [...selectedEquipment, equipmentName],
    selectedReferenceIdsByEquipment: nextReferenceIdsByEquipment,
  };
};

export const toggleEquipmentReferenceSelection = (selectedReferenceIdsByEquipment, equipmentName, referenceId) => {
  const selectedReferenceIds = selectedReferenceIdsByEquipment[equipmentName] || [];
  return {
    ...selectedReferenceIdsByEquipment,
    [equipmentName]: selectedReferenceIds.includes(referenceId)
      ? selectedReferenceIds.filter((id) => id !== referenceId)
      : [...selectedReferenceIds, referenceId],
  };
};

const normalizeBorrowerName = (name) => String(name || '').trim().toLocaleLowerCase();

const getIdentifier = (value) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  if (value && typeof value === 'object') {
    return String(value._id || value.id || '').trim();
  }
  return '';
};

export const getUniqueBorrowerCount = (records) => {
  const borrowers = new Set();

  (Array.isArray(records) ? records : []).forEach((record) => {
    const borrowerName = normalizeBorrowerName(record?.fullname || record?.Name);
    const borrowerIdentity = [
      ['borrower', getIdentifier(record?.borrowerId)],
      ['student', getIdentifier(record?.studentId || record?.studentID)],
      ['user', getIdentifier(record?.userId || record?.userID)]
    ].find(([, identifier]) => identifier);

    const populatedBorrower = record?.borrowedBy;
    const populatedBorrowerName = normalizeBorrowerName(
      populatedBorrower?.fullname || populatedBorrower?.Name
    );
    const populatedBorrowerId = populatedBorrowerName === borrowerName
      ? getIdentifier(populatedBorrower)
      : '';

    const identity = borrowerIdentity
      ? `${borrowerIdentity[0]}:${borrowerIdentity[1]}`
      : populatedBorrowerId
        ? `user:${populatedBorrowerId}`
        : '';
    if (identity) {
      borrowers.add(identity);
    } else if (borrowerName) {
      borrowers.add(`name:${borrowerName}`);
    }
  });

  return borrowers.size;
};

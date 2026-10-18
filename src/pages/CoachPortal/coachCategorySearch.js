import { REGISTRATION_CATEGORIES } from '../../constants/registrationCategories.js';
import { SPORT_OPTIONS } from '../../constants/studentRegistrationOptions.js';

const normalizeSearchValue = (value) => String(value || '').toLocaleLowerCase();
const normalizeSportKey = (value) => normalizeSearchValue(value).replace(/[^a-z0-9]/g, '');
const sportSearchTermsByOption = new Map();

REGISTRATION_CATEGORIES.forEach(({ name, events = [], subcategories = [] }) => {
  events.forEach((event) => {
    sportSearchTermsByOption.set(normalizeSportKey(event), [name]);
  });
  subcategories.forEach(({ name: subcategory, sports }) => {
    sports.forEach((sport) => {
      sportSearchTermsByOption.set(normalizeSportKey(sport), [name, subcategory]);
    });
  });
});

export const filterCoachCategoryOptions = (query) => {
  const normalizedQuery = normalizeSearchValue(query).trim();
  if (!normalizedQuery) return SPORT_OPTIONS;

  return SPORT_OPTIONS.filter((sport) => {
    const searchableTerms = [
      sport,
      ...(sportSearchTermsByOption.get(normalizeSportKey(sport)) || ['Sports Event']),
    ];
    return searchableTerms.some((term) => normalizeSearchValue(term).includes(normalizedQuery));
  });
};

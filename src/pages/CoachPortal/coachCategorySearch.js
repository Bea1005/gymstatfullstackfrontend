import { REGISTRATION_CATEGORIES } from '../../constants/registrationCategories.js';
import { REGISTRATION_SPORT_EVENT_OPTIONS } from '../../constants/registrationCategories.js';

const normalizeSearchValue = (value) => String(value || '').toLocaleLowerCase();
const normalizeSportKey = (value) => normalizeSearchValue(value).replace(/[^a-z0-9]/g, '');
const sportSearchTermsByOption = new Map();
const eventOptions = new Set(REGISTRATION_CATEGORIES.flatMap(({ events = [] }) => events));
const coachGalleryOptions = REGISTRATION_SPORT_EVENT_OPTIONS;
const categoryOptionCollator = new Intl.Collator('en', { sensitivity: 'base' });

export const getCoachGalleryCategoryLabel = (category) => {
  const normalizedCategory = normalizeSportKey(category);
  return coachGalleryOptions.find((option) => normalizeSportKey(option) === normalizedCategory)
    || String(category || '').trim();
};

export const isCoachGalleryCategorySelected = (selectedCategory, option) => (
  normalizeSportKey(selectedCategory) === normalizeSportKey(option)
);

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
  if (!normalizedQuery) return coachGalleryOptions;
  const normalizedCategoryQuery = normalizeSportKey(normalizedQuery);

  return coachGalleryOptions.filter((sport) => {
    const searchableTerms = [
      sport,
      ...(sportSearchTermsByOption.get(normalizeSportKey(sport)) || ['Sports Event']),
    ];
    return searchableTerms.some((term) => normalizeSearchValue(term).includes(normalizedQuery))
      || normalizeSportKey(sport).includes(normalizedCategoryQuery);
  });
};

export const groupAndSortCoachCategoryOptions = (options) => ({
  sports: options
    .filter((option) => !eventOptions.has(option))
    .sort(categoryOptionCollator.compare),
  events: options
    .filter((option) => eventOptions.has(option))
    .sort(categoryOptionCollator.compare),
});

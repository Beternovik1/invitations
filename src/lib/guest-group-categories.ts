export const OTHER_GUEST_GROUP_CATEGORY = "Otros";

export const DEFAULT_GUEST_GROUP_CATEGORIES = [
  "Familia materna",
  "Familia paterna",
  "Amigos",
  "Trabajo",
  OTHER_GUEST_GROUP_CATEGORY,
] as const;

export const DEFAULT_GUEST_GROUP_CATEGORY = OTHER_GUEST_GROUP_CATEGORY;
export const MAX_GUEST_GROUP_CATEGORY_LENGTH = 80;

export type DefaultGuestGroupCategory =
  (typeof DEFAULT_GUEST_GROUP_CATEGORIES)[number];

export function isDefaultGuestGroupCategory(
  category: string
): category is DefaultGuestGroupCategory {
  return DEFAULT_GUEST_GROUP_CATEGORIES.includes(
    category as DefaultGuestGroupCategory
  );
}

export function getCategorySelectValue(
  category: string,
  categoryOptions: readonly string[] = DEFAULT_GUEST_GROUP_CATEGORIES
): string {
  return categoryOptions.includes(category)
    ? category
    : OTHER_GUEST_GROUP_CATEGORY;
}

export function getCustomCategoryValue(
  category: string,
  categoryOptions: readonly string[] = DEFAULT_GUEST_GROUP_CATEGORIES
): string {
  return categoryOptions.includes(category) ? "" : category;
}

export function getGuestGroupCategoryOptions(
  categories: readonly (string | null | undefined)[]
): string[] {
  const customCategories = categories
    .map((category) => category?.trim() ?? "")
    .filter(
      (category) =>
        category.length > 0 && !isDefaultGuestGroupCategory(category)
    );

  return [
    ...DEFAULT_GUEST_GROUP_CATEGORIES.filter(
      (category) => category !== OTHER_GUEST_GROUP_CATEGORY
    ),
    ...Array.from(new Set(customCategories)).sort((a, b) =>
      a.localeCompare(b, "es")
    ),
    OTHER_GUEST_GROUP_CATEGORY,
  ];
}

export function normalizeGuestGroupCategory(
  category: string,
  customCategory: string | null
): string {
  const selected = category.trim();
  if (selected === OTHER_GUEST_GROUP_CATEGORY) {
    const custom = customCategory?.trim() ?? "";
    return custom.length > 0 ? custom : OTHER_GUEST_GROUP_CATEGORY;
  }
  return selected.length > 0 ? selected : DEFAULT_GUEST_GROUP_CATEGORY;
}

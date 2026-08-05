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
  const normalized = category.trim();
  return DEFAULT_GUEST_GROUP_CATEGORIES.includes(
    normalized as DefaultGuestGroupCategory
  );
}

export function isCustomGuestGroupCategory(category: string): boolean {
  const normalized = category.trim();
  return normalized.length > 0 && !isDefaultGuestGroupCategory(normalized);
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
  const customCategoriesByKey = new Map<string, string>();
  for (const rawCategory of categories) {
    const category = rawCategory?.trim() ?? "";
    if (!isCustomGuestGroupCategory(category)) continue;
    const key = category.toLocaleLowerCase("es");
    if (!customCategoriesByKey.has(key)) {
      customCategoriesByKey.set(key, category);
    }
  }

  return [
    ...DEFAULT_GUEST_GROUP_CATEGORIES.filter(
      (category) => category !== OTHER_GUEST_GROUP_CATEGORY
    ),
    ...Array.from(customCategoriesByKey.values()).sort((a, b) =>
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

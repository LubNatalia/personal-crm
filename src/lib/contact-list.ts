type ListView = {
  // What was typed in the search, trimmed; empty when not searching
  query: string;
  // Name of the chosen group; null for "all"
  groupName: string | null;
};

// The line above the list. `total` is the size of what is searched in: all
// contacts, or the chosen group
export function formatListSummary({
  query,
  groupName,
  shown,
  total,
}: ListView & { shown: number; total: number }) {
  if (query) {
    return `Найдено: ${shown} из ${total}`;
  }
  return groupName === null
    ? `Всего: ${total}`
    : `В группе «${groupName}»: ${total}`;
}

// Instead of the list when there is nobody to show
export function formatEmptyListMessage({ query, groupName }: ListView) {
  if (query) {
    return groupName === null
      ? `Никого не нашли по запросу «${query}».`
      : `Никого не нашли по запросу «${query}» в группе «${groupName}».`;
  }
  return groupName === null
    ? "Контактов пока нет. Добавьте первый."
    : `В группе «${groupName}» пока никого нет.`;
}

// Non-empty lines of the notes, trimmed
function noteLines(notes: string | null) {
  return (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// A new note means we were in touch: the notes got at least one new
// non-empty line, and every previous line is still there, unchanged and in
// the same order. Editing, extending or deleting a line doesn't count
export function hasNewNoteLines(previous: string | null, next: string | null) {
  const before = noteLines(previous);
  const after = noteLines(next);
  if (after.length <= before.length) {
    return false;
  }

  // The previous lines must be a subsequence of the new ones
  let matched = 0;
  for (const line of after) {
    if (matched < before.length && line === before[matched]) {
      matched++;
    }
  }
  return matched === before.length;
}

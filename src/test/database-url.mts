// Same connection string with another database name
export function withDatabase(url: string, name: string) {
  const parsed = new URL(url);
  parsed.pathname = `/${encodeURIComponent(name)}`;
  return parsed.toString();
}

export function databaseName(url: string) {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

// Tests use their own database next to the working one: `crm` -> `crm_test`.
// The working data is never touched
export function testDatabaseUrl(url: string) {
  return withDatabase(url, `${databaseName(url)}_test`);
}

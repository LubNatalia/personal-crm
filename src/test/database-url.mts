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

// End-to-end tests have a database of their own: `crm` -> `crm_e2e_test`,
// so they can run alongside Vitest without emptying its tables
export function e2eDatabaseUrl(url: string) {
  return withDatabase(url, `${databaseName(url)}_e2e_test`);
}

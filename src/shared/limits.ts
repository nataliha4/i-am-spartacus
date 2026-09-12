export const REQUEST_BODY_BYTES = 4 * 1024 * 1024;
// 5 MiB of stored JSON plus metadata for 50,000 rows fits below 16 MiB.
// This includes the import envelope, not just the uploaded file.
export const IMPORT_BODY_BYTES = 16 * 1024 * 1024;
export const IMPORT_FILE_BYTES = IMPORT_BODY_BYTES - 1024;
export const isImportPath = (path: string) =>
  path === "/api/v1/import" || path === "/api/v1/import/preview";

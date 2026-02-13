export function isValidMegaUrl(url) {
  return (
    !!url &&
    (url.startsWith("https://mega.nz/") ||
      url.startsWith("https://mega.co.nz/"))
  );
}

export function requireArray(value, name) {
  if (!value || !Array.isArray(value)) {
    const err = new Error(`${name} must be an array`);
    err.status = 400;
    throw err;
  }
}

export function requireString(value, name) {
  if (!value || typeof value !== "string") {
    const err = new Error(`${name} required`);
    err.status = 400;
    throw err;
  }
}

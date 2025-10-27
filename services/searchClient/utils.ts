export const toBase64 = (str: string): string =>
  Buffer.from(str).toString("base64");

export const fromBase64 = (b64: string): string =>
  Buffer.from(b64, "base64").toString("utf8");

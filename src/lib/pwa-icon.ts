import { readFile } from "node:fs/promises";

let cachedLogoDataUrl: string | null = null;

export async function getPwaLogoDataUrl() {
  if (cachedLogoDataUrl) {
    return cachedLogoDataUrl;
  }

  const logoBuffer = await readFile(
    `${process.cwd()}/public/brand/next-logo-black.png`,
  );

  cachedLogoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  return cachedLogoDataUrl;
}

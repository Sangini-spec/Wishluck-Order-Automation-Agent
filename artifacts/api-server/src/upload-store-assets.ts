import { storeAssetFile, storeAssetNames } from "./lib/store-assets";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

for (const name of storeAssetNames) {
  const file = storeAssetFile(name)!;
  await file.save(await readFile(resolve("../../attached_assets/generated_images", `wishluck-${name}.jpg`)), {
    resumable: false,
    metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=86400" },
    preconditionOpts: { ifGenerationMatch: 0 },
  });
  console.log(`Stored product image: ${name}`);
}

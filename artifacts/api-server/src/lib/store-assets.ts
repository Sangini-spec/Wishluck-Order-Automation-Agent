import { Storage } from "@google-cloud/storage";

// Replit sidecar credentials are resolved by the SDK, never logged or persisted.
export const storeAssetStorage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: "http://127.0.0.1:1106/token",
    type: "external_account",
    credential_source: {
      url: "http://127.0.0.1:1106/credential",
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export const storeAssetNames = ["kurta", "graphic-tee", "jeans", "briefs", "tote", "sale-tee"] as const;

export function storeAssetFile(name: string) {
  if (!(storeAssetNames as readonly string[]).includes(name)) return null;
  const root = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",")[0]?.trim();
  if (!root) throw new Error("Store asset storage is not configured.");
  const match = /^\/([^/]+)\/(.+)$/.exec(root);
  if (!match) throw new Error("Invalid public asset storage path.");
  return storeAssetStorage.bucket(match[1]).file(`${match[2]}/wishluck-products/${name}.jpg`);
}

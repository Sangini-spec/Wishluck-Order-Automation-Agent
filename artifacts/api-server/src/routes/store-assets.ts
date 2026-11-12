import { Router } from "express";
import { pipeline } from "node:stream/promises";
import { storeAssetFile } from "../lib/store-assets";

const router = Router();
// Deliberately public, fixed catalog imagery only. Never exposes arbitrary bucket paths.
router.get("/store-assets/:filename", async (req, res, next) => {
  const name = req.params.filename.replace(/\.jpg$/, "");
  if (req.params.filename !== `${name}.jpg`) { res.sendStatus(404); return; }
  const file = storeAssetFile(name);
  if (!file) { res.sendStatus(404); return; }
  try {
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: "Product image unavailable." }); return; }
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" });
    await pipeline(file.createReadStream(), res);
  } catch (error) { next(error); }
});
export default router;

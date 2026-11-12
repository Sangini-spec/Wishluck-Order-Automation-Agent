import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wishluckRouter from "./wishluck";
import storeAssetsRouter from "./store-assets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storeAssetsRouter);
router.use(wishluckRouter);

export default router;

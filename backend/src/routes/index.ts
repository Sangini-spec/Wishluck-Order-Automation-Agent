import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wishluckRouter from "./wishluck";

const router: IRouter = Router();

router.use(healthRouter);
router.use(wishluckRouter);

export default router;

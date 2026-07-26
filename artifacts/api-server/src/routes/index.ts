import { Router, type IRouter } from "express";
import healthRouter from "./health";
import parseRouter from "./parse";
import auditRouter from "./audit";
import statusRouter from "./status";

const router: IRouter = Router();

router.use(healthRouter);
router.use(parseRouter);
router.use(auditRouter);
router.use(statusRouter);

export default router;

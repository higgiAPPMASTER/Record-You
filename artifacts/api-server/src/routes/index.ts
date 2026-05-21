import { Router, type IRouter } from "express";
import healthRouter from "./health";
import songsRouter from "./songs";
import commentsRouter from "./comments";
import takesRouter from "./takes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(songsRouter);
router.use(commentsRouter);
router.use(takesRouter);

export default router;

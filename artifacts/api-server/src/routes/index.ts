import { Router, type IRouter } from "express";
import healthRouter from "./health";
import songsRouter from "./songs";
import commentsRouter from "./comments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(songsRouter);
router.use(commentsRouter);

export default router;

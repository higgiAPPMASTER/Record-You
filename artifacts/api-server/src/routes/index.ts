import { Router, type IRouter } from "express";
import healthRouter from "./health";
import songsRouter from "./songs";
import collabRouter from "./collab";

const router: IRouter = Router();

router.use(healthRouter);
router.use(songsRouter);
router.use(collabRouter);

export default router;

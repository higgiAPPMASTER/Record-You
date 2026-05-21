import { Router, type IRouter } from "express";
import healthRouter from "./health";
import songsRouter from "./songs";
import collabRouter from "./collab";
import communityRouter from "./community";

const router: IRouter = Router();

router.use(healthRouter);
router.use(songsRouter);
router.use(collabRouter);
router.use(communityRouter);

export default router;

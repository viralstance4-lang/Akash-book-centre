import { Router } from "express";

import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import { deleteUser, getUser, getUsers } from "./users.controller";

const usersRouter = Router();

usersRouter.use(authMiddleware, requireAdmin);

usersRouter.get("/", getUsers);
usersRouter.get("/:id", getUser);
usersRouter.delete("/:id", deleteUser);

export default usersRouter;

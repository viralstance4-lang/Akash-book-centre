import { Router } from "express";

import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import {
  createGenre,
  deleteGenre,
  listGenres,
} from "./genres.controller";
import { createGenreSchema } from "./genres.schema";

const genresRouter = Router();

genresRouter.get("/", listGenres);
genresRouter.post(
  "/",
  authMiddleware,
  requireAdmin,
  validate(createGenreSchema),
  createGenre,
);
genresRouter.delete("/:id", authMiddleware, requireAdmin, deleteGenre);

export default genresRouter;

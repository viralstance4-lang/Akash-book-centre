import { type RequestHandler } from "express";

import {
  createGenre as createGenreService,
  deleteGenre as deleteGenreService,
  getAllGenres,
} from "./genres.service";

export const listGenres: RequestHandler = async (req, res, next) => {
  void req;

  try {
    const genres = await getAllGenres();

    res.status(200).json({
      success: true,
      message: "Genres fetched successfully",
      data: genres,
    });
  } catch (error) {
    next(error);
  }
};

export const createGenre: RequestHandler = async (req, res, next) => {
  try {
    const genre = await createGenreService(req.body.name);

    res.status(201).json({
      success: true,
      message: "Genre created successfully",
      data: genre,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteGenre: RequestHandler = async (req, res, next) => {
  try {
    const genreId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await deleteGenreService(genreId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

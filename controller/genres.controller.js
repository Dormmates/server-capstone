import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError } from "../middleware/errorHandler.middleware.js";
import { addGenre, deleteGenre, getGenres, getGenresWithShowCount, updateGenreName } from "../services/genre.service.js";

export const getGenresController = asyncHandler(async (req, res) => {
  const genres = await getGenres();
  res.json(genres);
});

export const getGenresWithShowCountController = asyncHandler(async (req, res) => {
  const genres = await getGenresWithShowCount();
  res.json(genres);
});

export const addNewGenreController = asyncHandler(async (req, res) => {
  const { genre } = req.body;

  if (!genre) {
    throw new AppError("Missing Post Fields");
  }

  await addGenre(genre);
  res.json({ message: "Added" });
});

export const updateGenereController = asyncHandler(async (req, res) => {
  const { oldGenre, newGenre } = req.body;

  if (!oldGenre || !newGenre) {
    throw new AppError("Missing Post Fields");
  }

  await updateGenreName({ oldGenre, newGenre });
  res.json({ message: "Updated" });
});

export const deleteGenreController = asyncHandler(async (req, res) => {
  const { genre } = req.body;

  if (!genre) {
    throw new AppError("Missing Post Fields");
  }

  await deleteGenre(genre);
  res.json({ message: "Deleted" });
});

import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { getDistributorShowsAndTicketsAllocated } from "../services/distributorTickets.service.js";
import { archiveShow, createShow, deleteShow, doesShowExist, getShow, getShows, unArchiveShow, updateShow } from "../services/show.service.js";

export const createShowController = asyncHandler(async (req, res, next) => {
  const { showTitle, description, department, genre, createdBy, showType } = req.body;

  const { imageUrl } = req;

  if (!showTitle || !description || !genre || !createdBy || !showType) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const cleanedGenres = genre
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g !== "");

  const newShow = await createShow({ showTitle, coverImage: imageUrl, description, department, genre: cleanedGenres, createdBy, showType });
  const genreNames = newShow?.showgenre.map((g) => g.genre_showgenre_genreTogenre.name);

  res.status(HttpStatusCodes.OK).json({ ...newShow, genreNames });
});

export const updateShowController = asyncHandler(async (req, res, next) => {
  const { showId, showTitle, description, department, genre, createdBy, showType } = req.body;

  const { imageUrl } = req;

  if (!showTitle || !description || !genre || !createdBy || !showType) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const cleanedGenres = genre
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g !== "");

  const updatedShow = await updateShow({
    showId,
    showTitle,
    coverImage: imageUrl,
    description,
    department,
    genre: cleanedGenres,
    createdBy,
    showType,
  });

  const genreNames = updatedShow?.showgenre.map((g) => g.genre_showgenre_genreTogenre.name);

  res.status(HttpStatusCodes.Created).json({ ...updatedShow, genreNames });
});

export const getShowController = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const exists = await doesShowExist(id);

  if (!exists) {
    throw new AppError("Show Not Found", HttpStatusCodes.NotFound);
  }

  const show = await getShow({ id });

  const genreNames = show?.showgenre.map((g) => g.genre_showgenre_genreTogenre.name);

  const { showgenre, ...data } = show;

  res.status(HttpStatusCodes.OK).json({
    ...data,
    genreNames,
  });
});

export const getShowsController = asyncHandler(async (req, res) => {
  const departmentId = req.query.departmentId;
  const showType = req.query.showType;

  const { shows } = await getShows({ departmentId, showType });

  res.json(shows);
});

export const getArchivedShowsController = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;

  const shows = await getShows({ departmentId, isArchived: true });
  res.status(HttpStatusCodes.OK).json({ shows });
});

export const archiveShowController = asyncHandler(async (req, res) => {
  const { showId } = req.body;

  if (!showId) {
    throw new AppError("Show ID is required", HttpStatusCodes.BadRequest);
  }

  const exists = await doesShowExist(showId);

  if (!exists) {
    throw new AppError("Show Not Found", HttpStatusCodes.NotFound);
  }

  await archiveShow(showId);
  res.status(HttpStatusCodes.OK).json({ message: "Show archived successfully." });
});

export const unArchiveShowController = asyncHandler(async (req, res) => {
  const { showId } = req.body;

  if (!showId) {
    throw new AppError("Show ID is required", HttpStatusCodes.BadRequest);
  }

  const exists = await doesShowExist(showId);

  if (!exists) {
    throw new AppError("Show Not Found", HttpStatusCodes.NotFound);
  }
  await unArchiveShow(showId);
  res.status(HttpStatusCodes.OK).json({ message: "Show unarchived successfully." });
});

export const deleteShowController = asyncHandler(async (req, res) => {
  const { showId } = req.body;

  if (!showId) {
    throw new AppError("Show ID is required", HttpStatusCodes.BadRequest);
  }

  const exists = await doesShowExist(showId);

  if (!exists) {
    throw new AppError("Show Not Found", HttpStatusCodes.NotFound);
  }

  await deleteShow(showId);
  res.status(HttpStatusCodes.OK).json({ message: "Show deleted successfully." });
});

export const getDistributorShowsAndTicketsAllocatedController = asyncHandler(async (req, res, next) => {
  const { distributorId } = req.params;

  const data = await getDistributorShowsAndTicketsAllocated({ distributorId });
  res.json(data);
});

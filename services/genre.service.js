import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import prisma from "../utils/primsa.connection.js";

export const getGenres = () => {
  return prisma.genre.findMany({
    orderBy: { name: "asc" },
  });
};

export const getGenresWithShowCount = async () => {
  const result = await prisma.genre.findMany({
    include: {
      _count: {
        select: { showGenres: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return result.map((g) => ({
    genre: g.name,
    showCount: g._count.showGenres,
  }));
};

export const deleteGenre = async (genreName) => {
  const linkedShowsCount = await prisma.showGenre.count({
    where: { genre: genreName },
  });

  if (linkedShowsCount > 0) {
    throw new AppError("Cannot delete a genre that is linked to a show", HttpStatusCodes.Forbidden);
  }

  return prisma.genre.delete({
    where: { name: genreName },
  });
};

export const addGenre = async (genreName) => {
  const exists = await prisma.genre.findUnique({ where: { name: genreName } });

  if (exists) {
    throw new AppError("This genre name already exists", HttpStatusCodes.Forbidden);
  }

  return prisma.genre.create({ data: { name: genreName } });
};

export const updateGenreName = async ({ oldGenre, newGenre }) => {
  const exists = await prisma.genre.findUnique({ where: { name: newGenre } });

  if (exists) {
    throw new AppError("This genre name already exists", HttpStatusCodes.Forbidden);
  }

  return prisma.genre.update({
    where: { name: oldGenre },
    data: { name: newGenre },
  });
};

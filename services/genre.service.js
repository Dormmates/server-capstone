import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import prisma from "../utils/primsa.connection.js";

export const getGenres = () => {
  return prisma.genre.findMany();
};

export const getGenresWithShowCount = async () => {
  const result = await prisma.genre.findMany({
    include: {
      _count: {
        select: { showgenre_showgenre_genreTogenre: true },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return result.map((g) => ({
    genre: g.name,
    showCount: g._count.showgenre_showgenre_genreTogenre,
  }));
};

export const deleteGenre = async (genreName) => {
  const count = await prisma.showgenre.count({
    where: { genre: genreName },
  });

  if (count > 0) {
    throw new AppError("Cannot delete a Genre that is linked to a show", HttpStatusCodes.Forbidden);
  }

  return prisma.genre.delete({
    where: { name: genreName },
  });
};

export const addGenre = async (genreName) => {
  const exists = await prisma.genre.findUnique({ where: { name: genreName } });

  if (exists) {
    throw new AppError("This genere name already exists", HttpStatusCodes.Forbidden);
  }

  return await prisma.genre.create({
    data: {
      name: genreName,
    },
  });
};

export const updateGenreName = async ({ oldGenre, newGenre }) => {
  const exists = await prisma.genre.findUnique({ where: { name: newGenre } });

  if (exists) {
    throw new AppError("This genere name already exists", HttpStatusCodes.Forbidden);
  }

  return await prisma.genre.update({ where: { name: oldGenre }, data: { name: newGenre } });
};

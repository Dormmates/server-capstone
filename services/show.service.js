import prisma from "../utils/primsa.connection.js";

export const doesShowExist = async (showId) => {
  const existingShow = await prisma.shows.findUnique({
    where: { showId },
    select: { showId: true },
  });

  return !!existingShow;
};

export const createShow = async ({ showTitle, coverImage, description, department, genre = [], createdBy, showType }) => {
  const newShow = await prisma.shows.create({
    data: {
      showId: crypto.randomUUID(),
      title: showTitle,
      description,
      showType,
      ...(department && { departmentId: department }),
      createdBy,
      showCover: coverImage,
      showgenre: {
        create: genre.map((name) => ({
          genre_showgenre_genreTogenre: {
            connectOrCreate: {
              where: { name: name.trim() },
              create: { name: name.trim() },
            },
          },
        })),
      },
    },
    select: {
      showId: true,
      title: true,
      description: true,
      showType: true,
      department: true,
      createdBy: true,
      createdAt: true,
      isArchived: true,
      showCover: true,
      showgenre: {
        select: {
          genre_showgenre_genreTogenre: {
            select: { name: true },
          },
        },
      },
      showschedules: true,
    },
  });

  return newShow;
};

export const updateShow = async ({ showId, showTitle, coverImage, description, department, genre = [], showType }) => {
  return await prisma.$transaction(async (tx) => {
    await tx.shows.update({
      where: { showId },
      data: {
        title: showTitle,
        description,
        showType,
        departmentId: department ?? null,
        ...(coverImage && { showCover: coverImage }),
      },
    });

    // Remove existing genres
    await tx.showgenre.deleteMany({
      where: { showId },
    });

    // Add updated genres
    for (const name of genre) {
      await tx.showgenre.create({
        data: {
          shows: {
            connect: { showId },
          },
          genre_showgenre_genreTogenre: {
            connectOrCreate: {
              where: { name: name.trim() },
              create: { name: name.trim() },
            },
          },
        },
      });
    }

    const updatedShow = await tx.shows.findUnique({
      where: { showId },
      include: {
        department: true,
        showgenre: {
          include: {
            genre_showgenre_genreTogenre: true,
          },
        },
        showschedules: true,
      },
    });

    return updatedShow;
  });
};

export const getShows = async ({ departmentId = null, showType = null, includeMajorProduction = false, excludeArchived = false }) => {
  const where = {
    ...(departmentId && {
      OR: [{ departmentId }, { departmentId: null }],
    }),

    ...(showType
      ? { showType }
      : {
          showType: {
            in: includeMajorProduction ? ["majorConcert", "showCase", "majorProduction"] : ["majorConcert", "showCase"],
          },
        }),

    ...(excludeArchived && { isArchived: false }),
  };
  const shows = await prisma.shows.findMany({
    where,
    include: {
      showschedules: true,
      department: true,
      showgenre: {
        include: {
          genre_showgenre_genreTogenre: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const transformedShows = shows.map(({ showgenre, ...rest }) => ({
    ...rest,
    genreNames: showgenre.map((g) => g.genre_showgenre_genreTogenre.name),
  }));

  return { shows: transformedShows };
};

export const getShow = async ({ id }) => {
  return await prisma.shows.findFirst({
    where: {
      showId: id,
    },
    include: {
      showschedules: true,
      department: true,
      showgenre: {
        include: {
          genre_showgenre_genreTogenre: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
};

export const archiveShow = async (showId) => {
  await prisma.$transaction(async (tx) => {
    await tx.shows.update({
      where: { showId },
      data: { isArchived: true },
    });

    await tx.showschedules.deleteMany({
      where: { showId },
    });
  });
};

export const unArchiveShow = async (showId) => {
  return await prisma.shows.update({
    where: { showId },
    data: { isArchived: false },
  });
};

export const deleteShow = async (showId) => {
  return await prisma.shows.delete({
    where: { showId },
  });
};

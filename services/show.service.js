import { storage } from "../utils/appwriteconfig.js";
import { getFileId } from "../utils/general.utils.js";
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
      users: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
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
  const archivedShow = await prisma.$transaction(async (tx) => {
    const show = await tx.shows.update({
      where: { showId },
      data: { isArchived: true },
    });

    await tx.showschedules.deleteMany({
      where: { showId },
    });

    return show;
  });

  return archivedShow;
};

export const unArchiveShow = async (showId) => {
  return await prisma.shows.update({
    where: { showId },
    data: { isArchived: false },
  });
};

export const deleteShow = async (showId) => {
  const deletedShow = await prisma.shows.delete({
    where: { showId },
  });

  const fileId = getFileId(deletedShow.showCover);

  if (fileId) {
    storage.deleteFile(process.env.APP_WRITE_BUCKET_ID, fileId).catch((e) => console.error("File deletion failed:", e));
  }

  return deletedShow;
};

export const generateSalesReport = async (showId, scheduleIds) => {
  const show = await prisma.shows.findUnique({
    where: { showId },
    include: {
      showschedules: {
        where: scheduleIds ? { scheduleId: { in: scheduleIds } } : undefined,
        include: {
          ticket: {
            include: {
              users: true,
              showseats: true,
            },
          },
          ticketpricing: true,
        },
      },
    },
  });

  if (!show) throw new AppError("Show not found");

  const toNumber = (val) => {
    if (val === null || val === undefined) return 0;
    return Number(val.toString());
  };

  const controlledSections = ["orchestraLeft", "orchestraMiddle", "orchestraRight", "balconyLeft", "balconyMiddle", "balconyRight"];

  const report = {
    showId: show.showId,
    showTitle: show.title,
    schedules: [],
    overallTotals: {
      totalTickets: 0,
      soldTickets: 0,
      unsoldTickets: 0,
      totalDiscount: 0,
      ticketSales: 0,
      totalCommission: 0,
      netSales: 0,
    },
  };

  for (const schedule of show.showschedules) {
    const tickets = schedule.ticket ?? [];
    const commissionFeePct = schedule.ticketpricing ? toNumber(schedule.ticketpricing.commisionFee) : 0;
    const { ticketPricing, ticket, ...rest } = schedule;

    const scheduleTotals = {
      schedule: rest,
      totalTickets: tickets.length,
      soldTickets: 0,
      unsoldTickets: 0,
      totalDiscount: 0,
      ticketSales: 0,
      totalCommission: 0,
      netSales: 0,
      salesBySection: [],
      salesByDistributor: [],
    };

    const sectionMap = new Map();
    const distributorsMap = new Map();
    const scheduleControlNumbers = [];

    // Pre-populate sectionMap based on seating type
    if (schedule.seatingType === "controlledSeating") {
      for (const sec of controlledSections) {
        sectionMap.set(sec, {
          section: sec,
          ticketsSold: 0,
          totalTickets: 0,
          totalSales: 0,
          totalDiscount: 0,
          totalCommission: 0,
          discountBreakdown: {
            ticketControlNumbers: [],
            discountPercentage: 0,
            totalAmount: 0,
          },
        });
      }
    } else {
      sectionMap.set("General", {
        section: "General",
        ticketsSold: 0,
        totalSales: 0,
        totalTickets: 0,
        totalDiscount: 0,
        totalCommission: 0,
        discountBreakdown: {
          ticketControlNumbers: [],
          discountPercentage: 0,
          totalAmount: 0,
        },
      });
    }

    for (const t of tickets) {
      const ticketPrice = toNumber(t.ticketPrice);
      const discountPct = t.discountPercentage ? toNumber(t.discountPercentage) : 0;
      const discountAmount = (ticketPrice * discountPct) / 100;
      const isSold = ["sold", "remitted", "lost"].includes(t.status);
      const netPrice = isSold ? ticketPrice : 0;
      const commissionAmount = isSold && commissionFeePct ? (commissionFeePct * netPrice) / 100 : 0;

      const seat = t.showseats[0];
      const section = schedule.seatingType === "controlledSeating" ? seat.seatSection : "General";

      if (isSold) {
        scheduleTotals.soldTickets += 1;
        scheduleTotals.ticketSales += netPrice;
        scheduleTotals.totalDiscount += discountAmount;
        scheduleTotals.totalCommission += commissionAmount;
        scheduleControlNumbers.push(t.controlNumber);
      }

      // Section breakdown
      const sec = sectionMap.get(section);
      if (sec && isSold) {
        sec.ticketsSold += 1;
        sec.totalSales += netPrice;
        sec.totalTickets += 1;
        sec.totalCommission += commissionAmount;
        sec.totalDiscount += discountAmount;
        if (discountPct > 0) {
          sec.discountBreakdown.ticketControlNumbers.push(t.controlNumber);
          sec.discountBreakdown.discountPercentage = discountPct;
          sec.discountBreakdown.totalAmount += discountAmount;
        }
      }

      // Distributor breakdown
      const distributorId = t.users ? t.users.userId : "online";
      const distributorName = t.users ? `${t.users.firstName} ${t.users.lastName}` : "Online Reservation";

      if (!distributorsMap.has(distributorId)) {
        distributorsMap.set(distributorId, {
          distributorId,
          distributorName,
          ticketsSold: 0,
          totalAmountRemitted: 0,
          totalCommission: 0,
        });
      }

      if (isSold) {
        const dist = distributorsMap.get(distributorId);
        dist.ticketsSold += 1;
        dist.totalAmountRemitted += netPrice;
        dist.totalCommission += commissionAmount;
      }
    }

    scheduleTotals.unsoldTickets = scheduleTotals.totalTickets - scheduleTotals.soldTickets;
    scheduleTotals.netSales = scheduleTotals.ticketSales - (scheduleTotals.totalCommission + scheduleTotals.totalDiscount);
    scheduleTotals.salesBySection = Array.from(sectionMap.values());
    scheduleTotals.salesByDistributor = Array.from(distributorsMap.values());

    report.schedules.push(scheduleTotals);

    // Overall totals
    report.overallTotals.totalTickets += scheduleTotals.totalTickets;
    report.overallTotals.soldTickets += scheduleTotals.soldTickets;
    report.overallTotals.unsoldTickets += scheduleTotals.unsoldTickets;
    report.overallTotals.totalDiscount += scheduleTotals.totalDiscount;
    report.overallTotals.ticketSales += scheduleTotals.ticketSales;
    report.overallTotals.totalCommission += scheduleTotals.totalCommission;
    report.overallTotals.netSales += scheduleTotals.netSales;
  }

  return report;
};

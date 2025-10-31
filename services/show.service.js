import { storage } from "../utils/appwriteconfig.js";
import { getFileId } from "../utils/general.utils.js";
import prisma from "../utils/primsa.connection.js";

export const doesShowExist = async (showId) => {
  const existingShow = await prisma.show.findUnique({
    where: { showId },
    select: { showId: true },
  });

  return !!existingShow;
};

export const createShow = async ({ showTitle, coverImage, description, department, genre = [], createdBy, showType }) => {
  const newShow = await prisma.show.create({
    data: {
      showId: crypto.randomUUID(),
      title: showTitle,
      description,
      showType,
      ...(department && { departmentId: department }),
      createdBy,
      showCover: coverImage,
      genres: {
        create: genre.map((name) => ({
          genreFk: {
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
      creator: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      genres: {
        select: {
          genreFk: {
            select: { name: true },
          },
        },
      },
      schedules: true,
    },
  });

  return newShow;
};

export const updateShow = async ({ showId, showTitle, coverImage, description, department, genre = [], showType }) => {
  return await prisma.$transaction(async (tx) => {
    await tx.show.update({
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
    await tx.showGenre.deleteMany({
      where: { showId },
    });

    // Add updated genres
    for (const name of genre) {
      await tx.showGenre.create({
        data: {
          show: {
            connect: { showId },
          },
          genreFk: {
            connectOrCreate: {
              where: { name: name.trim() },
              create: { name: name.trim() },
            },
          },
        },
      });
    }

    const updatedShow = await tx.show.findUnique({
      where: { showId },
      include: {
        department: true,
        genres: {
          include: {
            genreFk: true,
          },
        },
        schedules: true,
      },
    });

    return updatedShow;
  });
};

export const getShows = async ({ departmentId = null, showType = null, includeMajorProduction = false, excludeArchived = false, limit = null }) => {
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
  const shows = await prisma.show.findMany({
    where,
    include: {
      schedules: true,
      department: true,
      genres: {
        include: {
          genreFk: {
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
    ...(limit ? { take: Number(limit) } : {}),
  });

  const transformedShows = shows.map(({ genres, schedules, ...rest }) => ({
    ...rest,
    showschedules: schedules,
    genreNames: genres.map((g) => g.genreFk.name),
  }));

  return { shows: transformedShows };
};

export const getShow = async ({ id }) => {
  return await prisma.show.findFirst({
    where: {
      showId: id,
    },
    include: {
      schedules: true,
      department: true,
      genres: {
        include: {
          genreFk: {
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
    const show = await tx.show.update({
      where: { showId },
      data: { isArchived: true },
    });

    // await tx.showSchedule.deleteMany({
    //   where: { showId },
    // });

    await tx.showSchedule.updateMany({
      where: { showId },
      data: {
        isOpen: false,
      },
    });
    return show;
  });

  return archivedShow;
};

export const unArchiveShow = async (showId) => {
  return await prisma.show.update({
    where: { showId },
    data: { isArchived: false },
  });
};

export const deleteShow = async (showId) => {
  const deletedShow = await prisma.show.delete({
    where: { showId },
  });

  const fileId = getFileId(deletedShow.showCover);

  if (fileId) {
    storage.deleteFile(process.env.APP_WRITE_BUCKET_ID, fileId).catch((e) => console.error("File deletion failed:", e));
  }

  return deletedShow;
};

export const generateSalesReport = async (showId, scheduleIds) => {
  const show = await prisma.show.findUnique({
    where: { showId },
    include: {
      schedules: {
        where: scheduleIds ? { scheduleId: { in: scheduleIds } } : undefined,
        include: {
          tickets: {
            where: {
              isComplimentary: false,
            },
            include: {
              distributor: {
                include: {
                  distributor: {
                    select: {
                      distributorType: true,
                    },
                  },
                },
              },
              seats: true,
            },
          },
          ticketPricing: true,
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

  for (const schedule of show.schedules) {
    const tickets = schedule.tickets ?? [];
    const commissionFeePct = schedule.ticketPricing ? toNumber(schedule.ticketPricing.commissionFee) : 0;
    const { ticket, ...rest } = schedule;

    const scheduleTotals = {
      schedule: { ...rest },
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
      const isSold = ["sold", "remitted", "lost", "paidToCCA"].includes(t.status);
      const netPrice = isSold ? ticketPrice : 0;
      const commissionAmount = commissionFeePct;

      const seat = t.seats[0];
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
      } else {
        sec.totalTickets += 1;
      }

      //skip if no distributor
      if (!t.distributor) continue;

      // Distributor breakdown
      const distributorId = t.distributor ? t.distributor.userId : "online";
      const distributorName = t.distributor ? `${t.distributor.firstName} ${t.distributor.lastName}` : "Online Reservation";
      const distributorType = t.distributor?.distributor?.distributorType ?? "Trainer";

      if (!distributorsMap.has(distributorId)) {
        distributorsMap.set(distributorId, {
          distributorType,
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

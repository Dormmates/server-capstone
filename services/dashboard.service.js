import prisma from "../utils/primsa.connection.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault("Asia/Manila");

export const getTopShowsByTicketSold = async ({ departmentId = null }) => {
  const groupedTickets = await prisma.ticket.groupBy({
    by: ["scheduleId"],
    where: {
      status: {
        in: ["remitted", "sold", "lost"],
      },
      ...(departmentId && {
        schedule: {
          show: {
            departmentId,
          },
        },
      }),
    },
    _count: {
      scheduleId: true,
    },
    orderBy: {
      _count: {
        scheduleId: "desc",
      },
    },
  });

  if (!groupedTickets.length) return [];

  const schedules = await prisma.showSchedule.findMany({
    where: {
      scheduleId: { in: groupedTickets.map((g) => g.scheduleId) },
    },
    include: {
      show: {
        select: {
          showId: true,
          title: true,
          showType: true,
          department: {
            select: { name: true, departmentId: true },
          },
        },
      },
    },
  });

  const combined = schedules.map((s) => {
    const count = groupedTickets.find((g) => g.scheduleId === s.scheduleId)?._count.scheduleId || 0;

    return {
      showId: s.show.showId,
      showTitle: s.show.title,
      department: s.show.department?.name ?? null,
      showType: s.show.showType,
      departmentId: s.show.department?.departmentId ?? null,
      soldTickets: count,
    };
  });

  const aggregated = Object.values(
    combined.reduce((acc, curr) => {
      if (!acc[curr.showId]) {
        acc[curr.showId] = { ...curr, soldTickets: 0 };
      }
      acc[curr.showId].soldTickets += curr.soldTickets;
      return acc;
    }, {})
  );

  return aggregated.sort((a, b) => b.soldTickets - a.soldTickets).slice(0, 5);
};

export const getTopShowsByTotalRevenue = async ({ departmentId } = {}) => {
  const tickets = await prisma.ticket.findMany({
    where: {
      status: {
        in: ["remitted", "sold", "lost"],
      },
      ...(departmentId && {
        schedule: {
          show: {
            departmentId,
          },
        },
      }),
    },
    select: {
      ticketPrice: true,
      schedule: {
        select: {
          ticketPricing: true,
          show: {
            select: {
              showType: true,
              showId: true,
              title: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          },
        },
      },
      distributor: {
        select: {
          distributor: {
            select: {
              hasCommission: true,
            },
          },
        },
      },
    },
  });

  const showMap = new Map();

  for (const ticket of tickets) {
    const showId = ticket.schedule.show.showId;
    const hasCommission = ticket.distributor.distributor.hasCommission;

    const commissionAmount = hasCommission ? ticket.schedule.ticketPricing.commissionFee : 0;
    const netRevenue = ticket.ticketPrice - commissionAmount;

    if (!showMap.has(showId)) {
      showMap.set(showId, {
        showId,
        showTitle: ticket.schedule.show.title,
        department: ticket.schedule.show.department?.name ?? null,
        showType: ticket.schedule.show.showType,
        totalRevenue: 0,
        totalCommission: 0,
        totalTickets: 0,
      });
    }

    const record = showMap.get(showId);
    record.totalRevenue += netRevenue;
    record.totalCommission += commissionAmount;
    record.totalTickets++;
  }

  return Array.from(showMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);
};

export const getTopShowsByGenre = async ({ departmentId }) => {
  const tickets = await prisma.ticket.findMany({
    where: {
      status: {
        in: ["remitted", "sold", "lost"],
      },
      ...(departmentId && {
        schedule: {
          show: {
            departmentId,
          },
        },
      }),
    },
    select: {
      ticketPrice: true,
      schedule: {
        select: {
          ticketPricing: true,
          show: {
            select: {
              showType: true,
              showId: true,
              title: true,
              departmentId: true,
              department: { select: { name: true } },
              genres: {
                select: {
                  genreFk: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      distributor: {
        select: {
          distributor: {
            select: {
              hasCommission: true,
            },
          },
        },
      },
    },
  });

  const genreMap = new Map();

  for (const ticket of tickets) {
    const show = ticket.schedule.show;
    const showTitle = show.title;
    const showId = show.showId;
    const genres = show.genres.map((g) => g.genreFk.name);

    const hasCommission = ticket.distributor.distributor.hasCommission;

    const commissionAmount = hasCommission ? ticket.schedule.ticketPricing.commissionFee : 0;
    const netRevenue = ticket.ticketPrice - commissionAmount;

    for (const genre of genres) {
      if (!genreMap.has(genre)) {
        genreMap.set(genre, {
          genre,
          totalTickets: 0,
          totalRevenue: 0,
          totalCommission: 0,
          shows: new Map(),
        });
      }

      const genreRecord = genreMap.get(genre);
      genreRecord.totalTickets += 1;
      genreRecord.totalRevenue += netRevenue;
      genreRecord.totalCommission += commissionAmount;

      if (!genreRecord.shows.has(showId)) {
        genreRecord.shows.set(showId, {
          showId,
          title: showTitle,
          department: show.department?.name || "N/A",
          showType: show.showType,
          totalTickets: 0,
          totalRevenue: 0,
          totalCommission: 0,
        });
      }

      const showRecord = genreRecord.shows.get(showId);
      showRecord.totalTickets += 1;
      showRecord.totalRevenue += netRevenue;
      showRecord.totalCommission += commissionAmount;
    }
  }

  return Array.from(genreMap.values())
    .map((g) => ({
      genre: g.genre,
      totalTickets: g.totalTickets,
      totalRevenue: g.totalRevenue,
      totalCommission: g.totalCommission,
      shows: Array.from(g.shows.values()).sort((a, b) => b.totalRevenue - a.totalRevenue),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);
};

export const getTopDistributors = async ({ departmentId }) => {
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ["remitted", "sold", "lost"] },
      ...(departmentId && {
        schedule: {
          show: {
            departmentId,
          },
        },
      }),
    },
    select: {
      ticketPrice: true,
      schedule: {
        select: {
          scheduleId: true,
          datetime: true,
          ticketPricing: {
            select: { commissionFee: true },
          },
          show: {
            select: {
              showId: true,
              title: true,
              showType: true,
              department: { select: { name: true } },
            },
          },
        },
      },
      distributor: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          distributor: {
            select: {
              department: true,
              distributorType: true,
              hasCommission: true,
            },
          },
        },
      },
    },
  });

  const distributorMap = new Map();

  for (const ticket of tickets) {
    const dist = ticket.distributor;
    if (!dist) continue;

    const userId = dist.userId;
    const fullName = `${dist.firstName} ${dist.lastName}`;
    const show = ticket.schedule.show;
    const schedule = ticket.schedule;

    const hasCommission = dist.distributor?.hasCommission ?? false;
    const commissionFee = schedule.ticketPricing?.commissionFee ?? 0;
    const commissionAmount = hasCommission ? commissionFee : 0;
    const netRevenue = ticket.ticketPrice - commissionAmount;

    if (!distributorMap.has(userId)) {
      distributorMap.set(userId, {
        userId,
        fullName,
        distributorType: dist.distributor.distributorType,
        department: dist.distributor.department.name,
        totalTickets: 0,
        totalCommission: 0,
        totalNetRevenue: 0,
        shows: new Map(),
      });
    }

    const record = distributorMap.get(userId);
    record.totalTickets += 1;
    record.totalCommission += commissionAmount;
    record.totalNetRevenue += netRevenue;

    if (!record.shows.has(show.showId)) {
      record.shows.set(show.showId, {
        showId: show.showId,
        title: show.title,
        showType: show.showType,
        departmentName: show.department?.name ?? null,
        schedules: new Map(),
      });
    }

    const showRecord = record.shows.get(show.showId);
    if (!showRecord.schedules.has(schedule.scheduleId)) {
      showRecord.schedules.set(schedule.scheduleId, {
        scheduleId: schedule.scheduleId,
        dateTime: schedule.datetime,
        ticketsSold: 0,
        commission: 0,
        net: 0,
      });
    }

    const schedRecord = showRecord.schedules.get(schedule.scheduleId);
    schedRecord.ticketsSold += 1;
    schedRecord.commission += commissionAmount;
    schedRecord.net += netRevenue;
  }

  const result = Array.from(distributorMap.values())
    .map((dist) => ({
      ...dist,
      shows: Array.from(dist.shows.values()).map((s) => ({
        ...s,
        schedules: Array.from(s.schedules.values()),
      })),
    }))
    .sort((a, b) => b.totalNetRevenue - a.totalNetRevenue)
    .slice(0, 10);

  return result;
};

export const getDashboardKpiSummary = async ({ departmentId }) => {
  const now = dayjs().tz();
  const nextMonth = now.add(30, "day").toDate();

  const whereDepartment = departmentId ? { departmentId } : {};

  const [totalShows, openSchedules, closedSchedules, upcomingShows, totalDepartments, totalDistributors] = await Promise.all([
    prisma.show.count({
      where: {
        isArchived: false,
        ...whereDepartment,
      },
    }),

    prisma.showSchedule.count({
      where: {
        isOpen: true,
        show: { ...whereDepartment, isArchived: false },
      },
    }),

    prisma.showSchedule.count({
      where: {
        isOpen: false,
        show: { ...whereDepartment, isArchived: false },
      },
    }),

    prisma.show.count({
      where: {
        isArchived: false,
        ...(departmentId && {
          OR: [
            { departmentId },
            {
              departmentId: null,
              showType: "majorProduction",
            },
          ],
        }),
        schedules: {
          some: {
            datetime: { gt: now.toDate(), lte: nextMonth },
          },
        },
      },
    }),

    departmentId ? 0 : prisma.department.count(),

    prisma.distributor.count({
      where: { ...whereDepartment },
    }),
  ]);

  return {
    totalShows,
    openSchedules,
    closedSchedules,
    upcomingShows,
    totalDepartments,
    totalDistributors,
    generatedAt: now.format("YYYY-MM-DD HH:mm:ss"),
  };
};

export const getUpcomingShowsSummary = async ({ departmentId, daysAhead }) => {
  const now = dayjs().tz("Asia/Manila");
  const endDate = daysAhead ? now.add(daysAhead, "day") : now.endOf("year");

  const shows = await prisma.show.findMany({
    where: {
      isArchived: false,
      ...(departmentId && {
        OR: [
          { departmentId },
          {
            departmentId: null,
            showType: "majorProduction",
          },
        ],
      }),
      schedules: {
        some: {
          isOpen: true,
          datetime: {
            gt: now.toDate(),
            lte: endDate.toDate(),
          },
        },
      },
    },
    select: {
      showId: true,
      title: true,
      showType: true,
      department: { select: { name: true } },
      genres: { select: { genreFk: { select: { name: true } } } },
      schedules: {
        where: {
          isOpen: true,
          datetime: {
            gt: now.toDate(),
            lte: endDate.toDate(),
          },
        },
        select: { datetime: true },
        orderBy: { datetime: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return shows
    .map((show) => ({
      showId: show.showId,
      title: show.title,
      showType: show.showType,
      department: show.department?.name || "All Group",
      earliestSchedule: show.schedules[0] ? dayjs(show.schedules[0].datetime).tz("Asia/Manila").format("YYYY-MM-DD hh:mm A") : null,
      totalUpcomingSchedules: show.schedules.length,
      genres: show.genres.map((g) => g.genreFk.name),
    }))
    .sort((a, b) => {
      const dateA = dayjs(a.earliestSchedule, "YYYY-MM-DD hh:mm A");
      const dateB = dayjs(b.earliestSchedule, "YYYY-MM-DD hh:mm A");
      return dateA - dateB;
    });
};

export const getShowSchedulesWithMostSales = ({ departmentId }) => {};

export const getShowSalesEachMonth = ({ departmentId }) => {};

export const getDepartmentPerformance = async ({ departmentId }) => {
  // aggregate total sales & revenue per department
};

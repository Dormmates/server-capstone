import { getUserRoles } from "../services/accounts.service.js";
import { getDepartmentTrainer } from "../services/department.service.js";
import { createNotification, getCcaHeadIds, getTrainerIds } from "../services/notification.service.js";
import dayjs from "dayjs";
import prisma from "./primsa.connection.js";

export const ShowNotificationAction = Object.freeze({
  CREATE: "createShow",
  ARCHIVE: "archiveShow",
  UNARCHIVE: "unarchiveShow",
  DELETE: "deleteShow",
});

export const DistributorNotification = Object.freeze({
  SOLD: "soldTicket",
  UNSOLD: "unsoldTicket",
});

export const DistributorTicketNotification = Object.freeze({
  ALLOCATE: "allocate",
  UNALLOCATE: "unallocate",
  REMIT: "remit",
  UNREMIT: "unremit",
});

export const sendShowNotification = async ({ actionBy, showId, showTitle, showType, department, action, name }) => {
  try {
    const creatorRoles = await getUserRoles(actionBy);
    const headIds = await getCcaHeadIds(actionBy);
    let trainerIds = [];

    let notificationTitle = "";
    let notificationMessage = "";

    if (creatorRoles.includes("head")) {
      if (showType === "majorProduction") {
        trainerIds = await getTrainerIds(actionBy);
      } else {
        const trainer = await getDepartmentTrainer(department);
        if (trainer) trainerIds.push(trainer.id);
      }
    }

    switch (action) {
      case ShowNotificationAction.CREATE:
        notificationTitle = showType === "majorProduction" ? "New Major Production Show Created" : "New Show Created";
        notificationMessage =
          showType === "majorProduction"
            ? `A new major production show titled "${showTitle}" has been created by ${name}.`
            : `A new show titled "${showTitle}" has been created by ${name}.`;
        break;

      case ShowNotificationAction.ARCHIVE:
        notificationTitle = showType === "majorProduction" ? "Major Production Show Archived" : "Show Archived";
        notificationMessage =
          showType === "majorProduction"
            ? `The major production show "${showTitle}" has been archived by ${name}.`
            : `The show "${showTitle}" has been archived by ${name}.`;
        break;

      case ShowNotificationAction.UNARCHIVE:
        notificationTitle = showType === "majorProduction" ? "Major Production Show Unarchived" : "Show Unarchived";
        notificationMessage =
          showType === "majorProduction"
            ? `The major production show "${showTitle}" has been unarchived by ${name}.`
            : `The show "${showTitle}" has been unarchived by ${name}.`;
        break;

      case ShowNotificationAction.DELETE:
        notificationTitle = showType === "majorProduction" ? "Major Production Show Deleted" : "Show Deleted";
        notificationMessage =
          showType === "majorProduction"
            ? `The major production show "${showTitle}" has been deleted by ${name}.`
            : `The show "${showTitle}" has been deleted by ${name}.`;
        break;

      default:
        notificationTitle = "Show Notification";
        notificationMessage = `An action was performed on show "${showTitle}" by ${name}.`;
        break;
    }

    const recipientIds = [...new Set([...headIds, ...trainerIds])];

    if (recipientIds.length > 0) {
      await createNotification({
        senderId: actionBy,
        title: notificationTitle,
        type: action,
        message: notificationMessage,
        metaData: { showId },
        recipientIds,
      });
    }
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
};
export const sendDistributorActivityNotification = async ({ actionBy, distributorId, scheduleId, customerMetaData = [], totalTickets, action }) => {
  try {
    const distributor = await prisma.user.findUnique({ where: { userId: distributorId } });
    if (!distributor) return;

    const schedule = await prisma.showSchedule.findUnique({
      where: { scheduleId },
      select: {
        show: { select: { showId: true, title: true, showType: true, departmentId: true } },
        datetime: true,
      },
    });
    if (!schedule) return;

    const headIds = await getCcaHeadIds();
    let trainerIds = [];
    if (schedule.show.showType === "majorProduction") {
      trainerIds = await getTrainerIds();
    } else {
      const trainer = await getDepartmentTrainer(schedule.show.departmentId);
      if (trainer) trainerIds.push(trainer.id);
    }
    const recipientIds = [...new Set([...headIds, ...trainerIds])];
    if (!recipientIds.length) return;

    const formattedDate = dayjs(schedule.datetime).format("ddd, MMM D, YYYY hh:mm A");

    let notificationMessage = "";
    if (customerMetaData.length > 0) {
      const groupedCustomers = customerMetaData
        .filter((ticket) => ticket)
        .reduce((acc, ticket) => {
          const name = ticket.customerName || "No Customer Info";
          const email = ticket.customerEmail || null;

          if (!acc[name]) acc[name] = { customerName: name, customerEmail: email, ticketCount: 0 };
          acc[name].ticketCount += 1;

          return acc;
        }, {});

      const groupedMetaData = Object.values(groupedCustomers);
      const customerMessages = groupedMetaData.map((c) => `${c.customerName}${c.customerEmail ? `, Email: ${c.customerEmail}` : ""}`);

      notificationMessage =
        action === DistributorNotification.SOLD
          ? `${distributor.firstName} ${distributor.lastName} sold ${totalTickets} ticket(s) for "${
              schedule.show.title
            }" scheduled at ${formattedDate}:\n${customerMessages.join("\n")}`
          : `${distributor.firstName} ${distributor.lastName} marked ${totalTickets} ticket(s) as unsold for "${
              schedule.show.title
            }" scheduled at ${formattedDate}:\n${customerMessages.join("\n")}`;
    } else {
      notificationMessage =
        action === DistributorNotification.SOLD
          ? `${distributor.firstName} ${distributor.lastName} sold ${totalTickets} ticket(s) for "${schedule.show.title}" scheduled at ${formattedDate} without customer information.`
          : `${distributor.firstName} ${distributor.lastName} marked ${totalTickets} ticket(s) as unsold for "${schedule.show.title}" scheduled at ${formattedDate} without customer information.`;
    }

    createNotification({
      senderId: actionBy,
      title: action === DistributorNotification.SOLD ? "Tickets Sold by Distributor" : "Tickets Marked Unsold",
      type: action,
      message: notificationMessage,
      metaData: { scheduleId, showId: schedule.show.showId },
      recipientIds,
    }).catch((err) => console.error("Failed to create notification:", err));
  } catch (err) {
    console.error("Failed to send distributor activity notification:", err);
  }
};

export const sendTicketNotificationsToDistributor = async ({ actionBy, distributorId, scheduleId, ticketMetaData = [], totalTickets, action }) => {
  try {
    let notificationMessage = "You have new ticket allocation";

    const distributor = await prisma.user.findUnique({ where: { userId: distributorId } });
    if (!distributor) return;

    const allocatedBy = await prisma.user.findUnique({ where: { userId: actionBy } });

    if (!allocatedBy) return;

    const schedule = await prisma.showSchedule.findUnique({
      where: { scheduleId },
      select: {
        show: { select: { showId: true, title: true, showType: true, departmentId: true } },
        datetime: true,
      },
    });

    if (!schedule) return;

    const formattedDate = dayjs(schedule.datetime).format("ddd, MMM D, YYYY hh:mm A");

    createNotification({
      senderId: actionBy,
      title: action === DistributorNotification.SOLD ? "Tickets Sold by Distributor" : "Tickets Marked Unsold",
      type: action,
      message: notificationMessage,
      metaData: { scheduleId, showId: schedule.show.showId },
      recipientIds,
    }).catch((err) => console.error("Failed to create notification:", err));
  } catch (err) {
    console.error("Failed to send distributor activity notification:", err);
  }
};

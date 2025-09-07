import { getUserRoles } from "../services/accounts.service.js";
import { getDepartmentTrainer } from "../services/department.service.js";
import { createNotification, getCcaHeadIds, getTrainerIds } from "../services/notification.service.js";

export const ShowNotificationAction = Object.freeze({
  CREATE: "createShow",
  ARCHIVE: "archiveShow",
  UNARCHIVE: "unarchiveShow",
  DELETE: "deleteShow",
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

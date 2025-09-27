import { AppError } from "../middleware/errorHandler.middleware.js";
import prisma from "../utils/primsa.connection.js";
import crypto from "crypto";
import { pusher } from "../utils/pusher.instance.js";

export const createNotification = async ({ senderId, title, message, metaData = {}, recipientIds, type }) => {
  if (!recipientIds || recipientIds.length === 0) {
    throw new AppError("At least one recipient is required");
  }

  const notificationId = crypto.randomUUID();
  const deliveryMap = {};

  const [notification] = await prisma.$transaction(async (tx) => {
    const newNotification = await tx.notifications.create({
      data: { notificationId, senderId, title, message, metaData, type },
      include: {
        users_notifications_senderIdTousers: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    const deliveries = recipientIds.map((id) => {
      const deliveryId = crypto.randomUUID();
      deliveryMap[id] = deliveryId;
      return {
        id: deliveryId,
        notificationId,
        receipientId: id,
      };
    });

    await tx.notificationdelivery.createMany({ data: deliveries });

    return [newNotification];
  });

  recipientIds.forEach((uid) => {
    if (uid === senderId) return;

    pusher.trigger(`user-${uid}`, "notification:new", {
      notificationId: deliveryMap[uid],
      title,
      type,
      message,
      metaData,
      readAt: null,
      sentAt: notification.sentAt,
      sender: `${notification.users_notifications_senderIdTousers.firstName} ${notification.users_notifications_senderIdTousers.lastName}`,
    });
  });

  return notification;
};

export const getUserNotifications = async ({ userId, cursor, limit = 30 }) => {
  const notifications = await prisma.notificationdelivery.findMany({
    where: { receipientId: userId },
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    take: limit + 1,
    orderBy: {
      notifications: {
        sentAt: "desc",
      },
    },
    include: {
      notifications: {
        select: {
          title: true,
          message: true,
          metaData: true,
          senderId: true,
          sentAt: true,
          type: true,
        },
      },
    },
  });

  const hasNextPage = notifications.length > limit;
  const items = hasNextPage ? notifications.slice(0, -1) : notifications;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id : null;

  return {
    notifications: items.map((d) => ({
      notificationId: d.id,
      readAt: d.readAt,
      ...d.notifications,
    })),
    nextCursor,
    hasNextPage,
  };
};

export const getUnreadNotificationCount = async (userId) => {
  const count = await prisma.notificationdelivery.count({
    where: {
      receipientId: userId,
      readAt: null,
    },
  });
  return count;
};

export const markNotificationsRead = async (userId, notificationIds) => {
  const whereClause = { receipientId: userId, readAt: null };
  if (notificationIds) {
    whereClause.notificationId = { in: notificationIds };
  }

  const result = await prisma.notificationdelivery.updateMany({
    where: whereClause,
    data: { readAt: new Date() },
  });

  return result.count;
};

export const markNotificationAsRead = async (deliveryId) => {
  const notificationDelivery = await prisma.notificationdelivery.update({
    where: {
      id: deliveryId,
    },
    data: {
      readAt: new Date(),
    },
    include: {
      notifications: {
        select: {
          notificationId: true,
          sentAt: true,
          message: true,
          title: true,
          metaData: true,
          type: true,
          users_notifications_senderIdTousers: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return {
    deliveryId: notificationDelivery.id,
    notificationId: notificationDelivery.notifications.notificationId,
    title: notificationDelivery.notifications.title,
    message: notificationDelivery.notifications.message,
    metaData: notificationDelivery.notifications.metaData,
    type: notificationDelivery.notifications.type,
    sentAt: notificationDelivery.notifications.sentAt,
    readAt: notificationDelivery.readAt,
    sender: `${notificationDelivery.notifications.users_notifications_senderIdTousers.firstName} ${notificationDelivery.notifications.users_notifications_senderIdTousers.lastName}`,
  };
};

export const getDistributorIds = async (excludeUserId) => {
  const distributors = await prisma.users.findMany({
    where: {
      userId: excludeUserId ? { not: excludeUserId } : undefined,
      userroles: {
        some: { role: "distributor" },
      },
    },
    select: { userId: true },
  });

  return distributors.map((u) => u.userId);
};

export const getTrainerIds = async (excludeUserId) => {
  const trainers = await prisma.users.findMany({
    where: {
      userId: excludeUserId ? { not: excludeUserId } : undefined,
      userroles: {
        some: { role: "trainer" },
      },
    },
    select: { userId: true },
  });

  return trainers.map((u) => u.userId);
};

export const getCcaHeadIds = async (excludeUserId) => {
  const ccaHeads = await prisma.users.findMany({
    where: {
      userId: excludeUserId ? { not: excludeUserId } : undefined,
      userroles: {
        some: { role: "head" },
      },
    },
    select: { userId: true },
  });

  return ccaHeads.map((u) => u.userId);
};

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

  const deliveries = recipientIds.map((id) => {
    const deliveryId = crypto.randomUUID();
    deliveryMap[id] = deliveryId;
    return {
      id: deliveryId,
      notificationId,
      recipientId: id,
    };
  });

  const [notification] = await prisma.$transaction([
    prisma.notification.create({
      data: { notificationId, senderId, title, message, metaData, type },
      include: {
        sender: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.notificationDelivery.createMany({ data: deliveries }),
  ]);

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
      sender: `${notification.sender.firstName} ${notification.sender.lastName}`,
    });
  });

  return notification;
};
export const getUserNotifications = async ({ userId, cursor, limit = 30 }) => {
  const notifications = await prisma.notificationDelivery.findMany({
    where: { recipientId: userId },
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    take: limit + 1,
    orderBy: {
      notification: {
        sentAt: "desc",
      },
    },
    include: {
      notification: {
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
      ...d.notification,
    })),
    nextCursor,
    hasNextPage,
  };
};

export const getUnreadNotificationCount = async (userId) => {
  return prisma.notificationDelivery.count({
    where: { recipientId: userId, readAt: null },
  });
};

export const markNotificationsRead = async (userId, notificationIds) => {
  const whereClause = { recipientId: userId, readAt: null };
  if (notificationIds) {
    whereClause.notificationId = { in: notificationIds };
  }

  const result = await prisma.notificationDelivery.updateMany({
    where: whereClause,
    data: { readAt: new Date() },
  });

  return result.count;
};

export const markNotificationAsRead = async (deliveryId) => {
  const notificationDelivery = await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: { readAt: new Date() },
    include: {
      notification: {
        select: {
          notificationId: true,
          sentAt: true,
          message: true,
          title: true,
          metaData: true,
          type: true,
          sender: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  return {
    deliveryId: notificationDelivery.id,
    notificationId: notificationDelivery.notification.notificationId,
    title: notificationDelivery.notification.title,
    message: notificationDelivery.notification.message,
    metadata: notificationDelivery.notification.metaData,
    type: notificationDelivery.notification.type,
    sentAt: notificationDelivery.notification.sentAt,
    readAt: notificationDelivery.readAt,
    sender: `${notificationDelivery.notification.sender.firstName} ${notificationDelivery.notification.sender.lastName}`,
  };
};

// Utility functions to get user IDs by role
export const getDistributorIds = async (excludeUserId) => {
  const distributors = await prisma.user.findMany({
    where: {
      userId: excludeUserId ? { not: excludeUserId } : undefined,
      roles: { some: { role: "distributor" } },
    },
    select: { userId: true },
  });

  return distributors.map((u) => u.userId);
};

export const getTrainerIds = async (excludeUserId) => {
  const trainers = await prisma.user.findMany({
    where: {
      userId: excludeUserId ? { not: excludeUserId } : undefined,
      roles: { some: { role: "trainer" } },
    },
    select: { userId: true },
  });

  return trainers.map((u) => u.userId);
};

export const getCcaHeadIds = async (excludeUserId) => {
  const ccaHeads = await prisma.user.findMany({
    where: {
      userId: excludeUserId ? { not: excludeUserId } : undefined,
      roles: { some: { role: "head" } },
    },
    select: { userId: true },
  });

  return ccaHeads.map((u) => u.userId);
};

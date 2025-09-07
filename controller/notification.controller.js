import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { getUnreadNotificationCount, getUserNotifications, markNotificationAsRead } from "../services/notification.service.js";

export const getUserNotificationsController = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { cursor, limit } = req.query;

  const result = await getUserNotifications({
    userId: id,
    cursor: cursor ? String(cursor) : null,
    limit: limit ? parseInt(String(limit)) : 30,
  });

  res.json({
    success: true,
    data: result.notifications,
    pagination: {
      nextCursor: result.nextCursor,
      hasNextPage: result.hasNextPage,
    },
  });
});

export const getUserUnreadNotificationsCountController = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const count = await getUnreadNotificationCount(id);

  res.json(count);
});

export const markNotificationsReadController = asyncHandler(async (req, res, next) => {
  const { notificationId } = req.body;

  console.log(notificationId);

  const data = await markNotificationAsRead(notificationId);
  res.json(data);
});

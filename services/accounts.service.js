import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { hashPassword } from "../utils/password.utils.js";
import prisma from "../utils/primsa.connection.js";
import { getUserByEmail, getUserById } from "./auth.service.js";

export const getDistributorTypes = async () => {
  return await prisma.distributortypes.findMany();
};

export const getTrainers = async () => {
  const trainers = await prisma.users.findMany({
    where: {
      userroles: {
        some: { role: "trainer" },
      },
    },
    include: {
      department: {
        select: {
          name: true,
          departmentId: true,
        },
      },
      userroles: {
        select: {
          role: true,
        },
      },
    },
  });

  return trainers.map((user) => ({
    ...user,
    roles: user.userroles.map((ur) => ur.role),
  }));
};

export const getDistributors = async (departmentId) => {
  const distributors = await prisma.users.findMany({
    where: {
      userroles: {
        some: { role: "distributor" },
        every: { role: "distributor" },
      },
      ...(departmentId && {
        distributor: {
          OR: [{ departmentId }, { departmentId: null }],
        },
      }),
    },
    include: {
      distributor: {
        select: {
          department: {
            select: {
              name: true,
              departmentId: true,
            },
          },
          distributortypes: {
            select: {
              name: true,
              haveCommision: true,
              id: true,
            },
          },
          contactNumber: true,
        },
      },
      userroles: {
        select: {
          role: true,
        },
      },
    },
  });

  // Map userroles to roles array
  return distributors.map((user) => ({
    ...user,
    roles: user.userroles.map((ur) => ur.role),
  }));
};

export const getCCAHeads = async () => {
  const heads = await prisma.users.findMany({
    where: {
      userroles: {
        some: { role: "head" },
      },
    },
    include: {
      department: {
        select: {
          name: true,
          departmentId: true,
        },
      },
      userroles: {
        select: {
          role: true,
        },
      },
    },
  });

  return heads.map((user) => ({
    ...user,
    roles: user.userroles.map((ur) => ur.role),
  }));
};

export const editAccount = async ({ userId, firstName, lastName, email }) => {
  const user = await getUserByEmail(email);

  if (user && user.userId !== userId) {
    throw new AppError("Email already used", HttpStatusCodes.Conflict);
  }

  return await prisma.users.update({
    where: {
      userId,
    },
    data: {
      firstName,
      lastName,
      email,
    },
  });
};

export const createDistributorAccount = async ({ firstName, lastName, email, password, distributorType, contactNumber, departmentId }) => {
  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    throw new AppError("Email already used", HttpStatusCodes.Conflict);
  }

  const distributorData = {
    distributorTypeId: Number(distributorType),
    contactNumber,
  };

  if (Number(distributorType) === 2) {
    if (!departmentId) {
      throw new AppError("Department ID is required for distributor (CCA Member)", HttpStatusCodes.BadRequest);
    }

    const findDepartment = await prisma.department.findFirst({ where: { departmentId } });

    if (!findDepartment) {
      throw new AppError("Department ID not found", HttpStatusCodes.BadRequest);
    }

    distributorData.departmentId = departmentId;
  }
  const result = await prisma.users.create({
    data: {
      userId: crypto.randomUUID(),
      firstName,
      lastName,
      email,
      password: await hashPassword(password),

      distributor: {
        create: distributorData,
      },
      userroles: {
        create: { role: "distributor" },
      },
    },
  });

  const { password: _, createdAt, isArchived, isLocked, distributor, ...userData } = result;
  const distributorDetails = distributor?.[0] ?? distributor;

  return {
    ...userData,
    ...distributorDetails,
  };
};

export const editDistributorAccount = async ({ userId, firstName, lastName, email, password, distributorType, contactNumber, departmentId }) => {
  const existingUser = await prisma.users.findUnique({
    where: { userId },
    include: { distributor: true },
  });

  if (!existingUser) {
    throw new AppError("Distributor not found", HttpStatusCodes.NotFound);
  }

  if (email && email !== existingUser.email) {
    const emailTaken = await prisma.users.findUnique({ where: { email } });
    if (emailTaken) {
      throw new AppError("Email already used", HttpStatusCodes.Conflict);
    }
  }

  if (Number(distributorType) === 2) {
    if (!departmentId) {
      throw new AppError("Department ID is required for distributor (CCA Member)", HttpStatusCodes.BadRequest);
    }

    const findDepartment = await prisma.department.findFirst({ where: { departmentId } });
    if (!findDepartment) {
      throw new AppError("Department ID not found", HttpStatusCodes.BadRequest);
    }
  }

  const currentDistributor = await prisma.distributor.findFirst({
    where: { userId },
    select: { distributorTypeId: true },
  });

  if (!currentDistributor) {
    throw new AppError("Distributor not found", HttpStatusCodes.NotFound);
  }

  const updatedUser = await prisma.users.update({
    where: { userId },
    data: {
      firstName,
      lastName,
      email,
      ...(password && { password: await hashPassword(password) }),
      distributor: {
        update: {
          where: {
            userId,
          },
          data: {
            contactNumber,
            distributorTypeId: Number(distributorType),
            departmentId: Number(distributorType) === 2 ? departmentId : null,
          },
        },
      },
    },
    include: { distributor: true },
  });

  const { password: _, createdAt, isArchived, isLocked, distributor, ...userData } = updatedUser;
  return {
    ...userData,
    ...distributor[0],
  };
};

export const deleteUsersSafely = async (userIds) => {
  const deletedUsers = [];
  const skippedUsers = [];

  for (const userId of userIds) {
    const hasReferences =
      (await prisma.department.count({ where: { trainerId: userId } })) > 0 ||
      (await prisma.distributor.count({ where: { userId } })) > 0 ||
      (await prisma.notifications.count({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } })) > 0 ||
      (await prisma.shows.count({ where: { createdBy: userId } })) > 0 ||
      (await prisma.ticket.count({ where: { distributorId: userId } })) > 0 ||
      (await prisma.ticketactionlog.count({ where: { OR: [{ actionBy: userId }, { distributorId: userId }] } })) > 0;

    if (hasReferences) {
      skippedUsers.push(userId);
    } else {
      await prisma.users.delete({ where: { userId } });
      deletedUsers.push(userId);
    }
  }

  return { deletedUsers, skippedUsers };
};

export const deleteUserSafely = async (userId) => {
  const hasReferences =
    (await prisma.department.count({ where: { trainerId: userId } })) > 0 ||
    (await prisma.notifications.count({
      where: { OR: [{ senderId: userId }] },
    })) > 0 ||
    (await prisma.shows.count({ where: { createdBy: userId } })) > 0 ||
    (await prisma.ticket.count({ where: { distributorId: userId } })) > 0 ||
    (await prisma.ticketactionlog.count({
      where: { OR: [{ actionBy: userId }, { distributorId: userId }] },
    })) > 0;

  if (hasReferences) {
    throw new AppError("User cannot be deleted, user contains some data");
  }

  await prisma.users.delete({ where: { userId } });
  return { deleted: true };
};

export const archiveUser = async (userId) => {
  await prisma.users.update({ where: { userId }, data: { isArchived: true } });
};

export const unArchiveUser = async (userId) => {
  await prisma.users.update({ where: { userId }, data: { isArchived: false } });
};

export const getUserRoles = async (userId) => {
  const roles = await prisma.userroles.findMany({ where: { userId } });

  return roles.map((role) => role.role);
};

export const addCCAHeadRoles = async (userIds) => {
  return prisma.userroles.createMany({
    data: userIds.map((id) => ({
      userId: id,
      role: "head",
    })),
  });
};

export const removeCCAHeadRole = async (userId) => {
  const headCount = await prisma.userroles.count({
    where: { role: "head" },
  });

  if (headCount <= 1) {
    throw new AppError("Cannot remove the last remaining CCA Head.");
  }

  return prisma.userroles.delete({
    where: {
      userId_role: {
        userId,
        role: "head",
      },
    },
  });
};

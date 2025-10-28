import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { hashPassword } from "../utils/password.utils.js";
import prisma from "../utils/primsa.connection.js";
import { validateEmail } from "../utils/validators.js";
import { getUserByEmail, getUserById } from "./auth.service.js";

export const getTrainers = async () => {
  const trainers = await prisma.user.findMany({
    where: {
      roles: {
        some: { role: "trainer" },
      },
    },
    include: {
      departments: {
        select: {
          department: true,
        },
      },
      roles: {
        select: {
          role: true,
        },
      },
    },
  });

  return trainers.map((user) => ({
    ...user,
    departments: user.departments.map((d) => d.department),
    roles: user.roles.map((ur) => ur.role),
  }));
};

export const getDistributors = async (departmentId, excludeCCA, includeOtherTypes) => {
  const distributors = await prisma.user.findMany({
    where: {
      roles: {
        some: { role: "distributor" },
        every: { role: "distributor" },
      },
      ...(departmentId && {
        distributor: {
          OR: [{ departmentId }, ...(includeOtherTypes ? [{ departmentId: null }] : [])],
        },
      }),

      ...(excludeCCA && {
        distributor: {
          distributorType: {
            not: "cca",
          },
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
          distributorType: {
            select: {
              name: true,
              hasCommission: true,
              id: true,
            },
          },
          contactNumber: true,
        },
      },
      roles: {
        select: {
          role: true,
        },
      },
    },
    orderBy: {
      lastName: "asc",
    },
  });

  return distributors.map((user) => ({
    ...user,
    roles: user.roles.map((ur) => ur.role),
  }));
};

export const getCCAHeads = async () => {
  const heads = await prisma.user.findMany({
    where: {
      roles: {
        some: { role: "head" },
      },
    },
    include: {
      departments: {
        select: {
          department: true,
        },
      },
      roles: {
        select: {
          role: true,
        },
      },
    },
  });

  return heads.map((user) => ({
    ...user,
    departments: user.departments.map((d) => d),
    roles: user.roles.map((ur) => ur.role),
  }));
};

export const editAccount = async ({ userId, firstName, lastName, email }) => {
  const user = await getUserByEmail(email);

  if (user && user.userId !== userId) {
    throw new AppError("Email already used", HttpStatusCodes.Conflict);
  }

  return await prisma.user.update({
    where: { userId },
    data: { firstName, lastName, email },
  });
};

export const createBulkDistributorAccounts = async ({ distributors, performingGroup }) => {
  const CHUNK_SIZE = 50; // Process 50 users per transaction
  const TIMEOUT_MS = 60_000; // 60 seconds per chunk
  const allResults = [];

  for (let i = 0; i < distributors.length; i += CHUNK_SIZE) {
    const chunk = distributors.slice(i, i + CHUNK_SIZE);

    const chunkResults = await prisma.$transaction(
      async (tx) => {
        const results = [];

        for (const dist of chunk) {
          const trimmedFirst = dist.firstName.trim();
          const trimmedLast = dist.lastName.trim();
          const normalizedEmail = dist.email.trim().toLowerCase();

          if (!validateEmail({ requiredDomain: "@slu.edu.ph", email: normalizedEmail })) {
            results.push({
              name: `${trimmedFirst} ${trimmedLast}`,
              email: normalizedEmail,
              status: "skipped (email must end with @slu.edu.ph)",
            });
            continue;
          }

          const existing = await tx.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (existing) {
            results.push({
              name: `${trimmedFirst} ${trimmedLast}`,
              email: normalizedEmail,
              status: "skipped (email already exists)",
            });
            continue;
          }

          const newUser = await tx.user.create({
            data: {
              userId: crypto.randomUUID(),
              firstName: trimmedFirst,
              lastName: trimmedLast,
              email: normalizedEmail,
              password: await hashPassword("123456"),
              isDefaultPassword: true,
              roles: {
                create: { role: "distributor" },
              },
              distributor: {
                create: {
                  distributorType: "cca",
                  departmentId: performingGroup,
                  contactNumber: String(dist.contactNumber).trim(),
                },
              },
            },
          });

          results.push({
            name: `${trimmedFirst} ${trimmedLast}`,
            email: newUser.email,
            status: "created",
          });
        }

        return results;
      },
      { timeout: TIMEOUT_MS }
    );

    allResults.push(...chunkResults);
  }

  return {
    message: "Bulk distributor creation completed.",
    summary: allResults,
  };
};

export const createDistributorAccount = async ({ firstName, lastName, email, password, distributorType, contactNumber, departmentId }) => {
  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    throw new AppError("Email already used", HttpStatusCodes.Conflict);
  }

  const distributorData = {
    distributorType,
    contactNumber,
  };

  if (distributorType === "cca") {
    if (!departmentId) {
      throw new AppError("Department ID is required for distributor (CCA Member)", HttpStatusCodes.BadRequest);
    }

    const findDepartment = await prisma.department.findFirst({ where: { departmentId } });
    if (!findDepartment) {
      throw new AppError("Department ID not found", HttpStatusCodes.BadRequest);
    }

    distributorData.departmentId = departmentId;
  }

  const result = await prisma.user.create({
    data: {
      userId: crypto.randomUUID(),
      firstName,
      lastName,
      email,
      password: await hashPassword(password),
      distributor: {
        create: distributorData,
      },
      roles: {
        create: { role: "distributor" },
      },
    },
  });

  const { password: _, createdAt, isArchived, isLocked, distributor, ...userData } = result;
  return {
    ...userData,
    ...distributor,
  };
};

export const editDistributorAccount = async ({ userId, firstName, lastName, email, password, distributorType, contactNumber, departmentId }) => {
  const existingUser = await prisma.user.findUnique({
    where: { userId },
    include: { distributor: true },
  });

  if (!existingUser) {
    throw new AppError("Distributor not found", HttpStatusCodes.NotFound);
  }

  if (email && email !== existingUser.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      throw new AppError("Email already used", HttpStatusCodes.Conflict);
    }
  }

  if (distributorType === "cca") {
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
    select: { distributorType: true },
  });

  if (!currentDistributor) {
    throw new AppError("Distributor not found", HttpStatusCodes.NotFound);
  }

  const updatedUser = await prisma.user.update({
    where: { userId },
    data: {
      firstName,
      lastName,
      email,
      ...(password && { password: await hashPassword(password) }),
      distributor: {
        update: {
          where: { userId },
          data: {
            contactNumber,
            distributorType: distributorType,
            departmentId: distributorType === "cca" ? departmentId : null,
          },
        },
      },
    },
    include: { distributor: true },
  });

  const { password: _, createdAt, isArchived, isLocked, distributor, ...userData } = updatedUser;
  return {
    ...userData,
    ...distributor,
  };
};

export const deleteUsersSafely = async (userIds) => {
  const deletedUsers = [];
  const skippedUsers = [];

  for (const userId of userIds) {
    const hasReferences =
      (await prisma.department.count({ where: { trainerId: userId } })) > 0 ||
      (await prisma.distributor.count({ where: { userId } })) > 0 ||
      (await prisma.notification.count({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } })) > 0 ||
      (await prisma.show.count({ where: { createdBy: userId } })) > 0 ||
      (await prisma.ticket.count({ where: { distributorId: userId } })) > 0 ||
      (await prisma.ticketActionLog.count({ where: { OR: [{ actionBy: userId }, { distributorId: userId }] } })) > 0;

    if (hasReferences) {
      skippedUsers.push(userId);
    } else {
      await prisma.user.delete({ where: { userId } });
      deletedUsers.push(userId);
    }
  }

  return { deletedUsers, skippedUsers };
};

export const deleteUserSafely = async (userId) => {
  const hasReferences =
    (await prisma.departmentTrainer.count({ where: { userId } })) > 0 ||
    // (await prisma.notification.count({ where: { OR: [{ senderId: userId }] } })) > 0 ||
    (await prisma.show.count({ where: { createdBy: userId } })) > 0 ||
    (await prisma.ticket.count({ where: { distributorId: userId } })) > 0 ||
    (await prisma.ticketActionLog.count({ where: { OR: [{ actionBy: userId }, { distributorId: userId }] } })) > 0;

  if (hasReferences) {
    throw new AppError("User cannot be deleted, user contains some data");
  }

  await prisma.user.delete({ where: { userId } });
  return { deleted: true };
};

export const archiveUser = async (userId) => {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { userId },
      data: { isArchived: true },
      select: { departments: { select: { departmentId: true } } },
    });

    const departmentIds = user.departments.map((d) => d.departmentId);

    if (departmentIds.length > 0) {
      await tx.departmentTrainer.deleteMany({
        where: {
          userId,
          departmentId: { in: departmentIds },
        },
      });
    }
  });
};

export const unArchiveUser = async (userId) => {
  await prisma.user.update({ where: { userId }, data: { isArchived: false } });
};

export const getUserRoles = async (userId) => {
  const roles = await prisma.userRole.findMany({ where: { userId } });
  return roles.map((role) => role.role);
};

export const addCCAHeadRoles = async (userIds) => {
  return prisma.userRole.createMany({
    data: userIds.map((id) => ({
      userId: id,
      role: "head",
    })),
  });
};

export const removeCCAHeadRole = async (userId) => {
  const headCount = await prisma.userRole.count({
    where: { role: "head" },
  });

  if (headCount <= 1) {
    throw new AppError("Cannot remove the last remaining CCA Head.");
  }

  return prisma.userRole.delete({
    where: {
      userId_role: {
        userId,
        role: "head",
      },
    },
  });
};

export const getEmails = async () => {
  return await prisma.user.findMany({ select: { email: true } });
};

export const resetPassword = async (userId) => {
  const resetPassword = await hashPassword("123456");

  return await prisma.user.update({
    where: {
      userId,
    },
    data: {
      isDefaultPassword: true,
      password: resetPassword,
    },
  });
};

import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { hashPassword, verifyPassword } from "../utils/password.utils.js";
import prisma from "../utils/primsa.connection.js";

export const getUserByEmail = async (email) => {
  const user = await prisma.users.findUnique({
    where: { email },
    select: {
      password: true,
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      distributor: {
        select: {
          contactNumber: true,
          distributortypes: {
            select: {
              id: true,
              name: true,
            },
          },
          department: {
            select: {
              departmentId: true,
              name: true,
            },
          },
        },
      },
      department: {
        select: {
          departmentId: true,
          name: true,
        },
      },
      userroles: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!user) return null;

  return {
    ...user,
    roles: user.userroles.map((r) => r.role),
  };
};

export const getUserById = async (userId) => {
  const user = await prisma.users.findFirst({
    where: { userId },
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      distributor: {
        select: {
          contactNumber: true,
          distributortypes: {
            select: {
              id: true,
              name: true,
            },
          },
          department: {
            select: {
              departmentId: true,
              name: true,
            },
          },
        },
      },
      department: {
        select: {
          departmentId: true,
          name: true,
        },
      },
      userroles: {
        select: {
          role: true,
        },
      },
    },
  });

  return { ...user, roles: user.userroles.map((r) => r.role) };
};

export const login = async ({ email, password }) => {
  const userData = await getUserByEmail(email);

  if (!userData) {
    throw new AppError("Wrong email or password", HttpStatusCodes.Forbidden);
  }

  const isPasswordValid = await verifyPassword(password, userData.password);
  if (!isPasswordValid) {
    throw new AppError("Wrong email or password", HttpStatusCodes.Forbidden);
  }

  const { password: _, isLocked, createdAt, ...safeUserData } = userData;

  return safeUserData;
};

export const createAccount = async ({ firstName, lastName, userType, email, password }) => {
  const user = await getUserByEmail(email);

  if (user) {
    throw new AppError("Email already used", HttpStatusCodes.Conflict);
  }

  const newAccount = await prisma.users.create({
    data: {
      userId: crypto.randomUUID(),
      firstName,
      lastName,
      email,
      password: await hashPassword(password),
      userroles: {
        create: {
          role: userType,
        },
      },
    },
  });

  const { password: _, createdAt, isArchived, isLocked, ...data } = newAccount;
  return data;
};

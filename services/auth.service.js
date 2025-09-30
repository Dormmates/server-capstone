import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { hashPassword, verifyPassword } from "../utils/password.utils.js";
import prisma from "../utils/primsa.connection.js";

export const getUserByEmail = async (email) => {
  const user = await prisma.user.findUnique({
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
          distributorType: {
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
      roles: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!user) return null;

  return {
    ...user,
    roles: user.roles.map((r) => r.role),
  };
};

export const getUserById = async (userId) => {
  const user = await prisma.user.findFirst({
    where: { userId },
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      distributor: {
        select: {
          contactNumber: true,
          distributorType: {
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
      roles: {
        select: {
          role: true,
        },
      },
    },
  });

  return { ...user, roles: user.roles.map((r) => r.role) };
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

  const rolesToCreate = [{ role: userType }];
  if (userType === "head") {
    rolesToCreate.push({ role: "trainer" });
  }

  const newAccount = await prisma.user.create({
    data: {
      userId: crypto.randomUUID(),
      firstName,
      lastName,
      email,
      password: await hashPassword(password),
      roles: {
        create: rolesToCreate,
      },
    },
  });

  const { password: _, createdAt, isArchived, isLocked, ...data } = newAccount;
  return data;
};

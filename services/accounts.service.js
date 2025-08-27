import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { hashPassword } from "../utils/password.utils.js";
import prisma from "../utils/primsa.connection.js";
import { checkEmailExistence } from "./auth.service.js";

export const getDistributorTypes = async () => {
  return await prisma.distributortypes.findMany();
};

export const getTrainers = async () => {
  return await prisma.users.findMany({
    where: { role: "trainer" },
    include: {
      department: {
        select: {
          name: true,
          departmentId: true,
        },
      },
    },
  });
};

export const getDistributors = async (departmentId) => {
  return await prisma.users.findMany({
    where: {
      role: "distributor",
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
    },
  });
};

export const editAccount = async ({ userId, firstName, lastName, email }) => {
  const user = await checkEmailExistence(email);

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
  const existingUser = await checkEmailExistence(email);

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
      role: "distributor",
      distributor: {
        create: distributorData,
      },
    },
    include: {
      distributor: true,
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

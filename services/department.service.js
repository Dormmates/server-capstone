import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { storage } from "../utils/appwriteconfig.js";
import { getFileId } from "../utils/general.utils.js";
import prisma from "../utils/primsa.connection.js";
import { validateEmail } from "../utils/validators.js";
import { getUserByEmail } from "./auth.service.js";

const findDepartment = async (name) => {
  return prisma.department.findUnique({ where: { name } });
};

export const createDepartment = async ({ name, logoUrl }) => {
  const checkDepartmentName = await findDepartment(name);

  if (checkDepartmentName) {
    throw new AppError("Department name already exists", HttpStatusCodes.Conflict);
  }

  const newDepartment = await prisma.department.create({
    data: {
      departmentId: crypto.randomUUID(),
      name,
      logoUrl,
    },
  });

  return newDepartment;
};

export const getDepartmentTrainer = async (departmentId) => {
  const trainer = await prisma.department.findUnique({
    where: { departmentId },
    select: {
      users: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
        },
      },
    },
  });

  return {
    name: trainer.users.firstName + " " + trainer.users.lastName,
    id: trainer.users.userId,
  };
};

export const getDepartments = async () => {
  const departments = await prisma.department.findMany({
    include: {
      users: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          shows: true,
        },
      },
    },
  });

  const result = departments.map((dep) => ({
    departmentId: dep.departmentId,
    name: dep.name,
    trainerId: dep.trainerId,
    logoUrl: dep.logoUrl,
    trainerName: dep.users ? `${dep.users.firstName} ${dep.users.lastName}` : null,
    totalShows: dep._count.shows,
  }));

  return result;
};

export const deleteDepartment = async (departmentId) => {
  const shows = await prisma.shows.count({ where: { departmentId } });
  if (shows !== 0) throw new AppError("Cannot Delete a Department with Shows", HttpStatusCodes.Forbidden);
  const deletedDepartment = await prisma.department.delete({ where: { departmentId } });

  const fileId = getFileId(deletedDepartment.logoUrl);

  if (fileId) {
    storage.deleteFile(process.env.APP_WRITE_BUCKET_ID, fileId).catch((e) => console.error("File deletion failed:", e));
  }
};

export const updateDepartment = async ({ departmentId, name, logoUrl }) => {
  return await prisma.department.update({
    where: { departmentId },
    data: {
      name,
      ...(logoUrl && { logoUrl }),
    },
  });
};

export const removeDepartmentTrainer = async (departmentId, tx = prisma) => {
  return await tx.department.update({
    where: { departmentId },
    data: { trainerId: null },
  });
};

export const removeDepartmentTrainerByTrainerId = async (trainerId, tx = prisma) => {
  return await tx.department.updateMany({
    where: { trainerId },
    data: { trainerId: null },
  });
};

export const assignDepartmentTrainer = async ({ departmentId, trainerId, tx = prisma }) => {
  const department = await tx.department.findUnique({ where: { departmentId } });

  if (!department) {
    throw new AppError("Department not found", HttpStatusCodes.NotFound);
  }

  if (department.trainerId) {
    throw new AppError("The Department already have trainer", HttpStatusCodes.BadRequest);
  }

  return await tx.department.update({ where: { departmentId }, data: { trainerId } });
};

export const createTrainerAndAssign = async ({ departmentId, firstName, lastName, email }) => {
  const user = await getUserByEmail(email);

  if (user) {
    throw new AppError("Email already exist");
  }

  if (!validateEmail({ requiredDomain: "slu.edu.ph", email })) {
    throw new AppError("Only @slu.edu.ph emails are allowed here");
  }

  const userId = crypto.randomUUID();

  return await prisma.$transaction(async (tx) => {
    await tx.users.create({
      data: {
        userId,
        firstName,
        lastName,
        email,
        password: "123456",
        userroles: {
          create: {
            role: "trainer",
          },
        },
      },
    });

    await tx.department.update({
      where: { departmentId },
      data: {
        trainerId: userId,
      },
    });

    return "Updated";
  });
};

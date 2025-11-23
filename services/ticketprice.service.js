import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import prisma from "../utils/primsa.connection.js";

export const newFixedPricing = async ({ name, fixedPrice, commissionFee }) => {
  const priceNameExists = await prisma.ticketPricing.findFirst({
    where: { priceName: name },
  });

  if (priceNameExists) {
    throw new AppError(`"${name}" price name already exists`);
  }

  const priceValueExists = await prisma.ticketPricing.findFirst({
    where: { fixedPrice: Number(fixedPrice) },
  });

  if (priceValueExists) {
    throw new AppError(`Price "${fixedPrice}" already exists`);
  }

  return await prisma.ticketPricing.create({
    data: {
      priceName: name,
      fixedPrice: Number(fixedPrice),
      commissionFee: Number(commissionFee),
      type: "fixed",
      id: crypto.randomUUID(),
    },
  });
};

export const newSectionedPricing = async ({ name, sectionedPricing, commissionFee }) => {
  const numericSectionPrices = Object.fromEntries(Object.entries(sectionedPricing).map(([key, value]) => [key, Number(value)]));

  return await prisma.ticketPricing.create({
    data: {
      id: crypto.randomUUID(),
      priceName: name,
      sectionPrices: numericSectionPrices,
      commissionFee: Number(commissionFee),
      type: "sectioned",
    },
  });
};

export const updatePricingName = async ({ priceId, newName }) => {
  const price = await prisma.ticketPricing.findFirst({ where: { priceName: newName } });

  if (price) {
    throw new AppError(`"${newName}" price name already exists`);
  }

  return await prisma.ticketPricing.update({
    where: {
      id: priceId,
    },
    data: {
      priceName: newName,
    },
  });
};

export const deleteSectionedPricing = async (id) => {
  const inUse = await prisma.showSchedule.findFirst({
    where: { ticketPricingId: id },
    select: { scheduleId: true },
  });

  if (inUse) {
    throw new AppError("Cannot delete: This sectioned pricing is already used by a schedule.", HttpStatusCodes.BadRequest);
  }

  return prisma.ticketPricing.delete({
    where: { id, type: "sectioned" },
  });
};

export const deleteFixedPricing = async (id) => {
  const inUse = await prisma.showSchedule.findFirst({
    where: { ticketPricingId: id },
    select: { scheduleId: true },
  });

  if (inUse) {
    throw new AppError("Cannot delete: This fixed pricing is already used by a schedule.", HttpStatusCodes.BadRequest);
  }

  return prisma.ticketPricing.delete({
    where: { id, type: "fixed" },
  });
};

export const getTicketPricings = async () => {
  return await prisma.ticketPricing.findMany();
};

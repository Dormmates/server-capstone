import prisma from "../utils/primsa.connection.js";

export const newFixedPricing = async ({ name, fixedPrice, commissionFee }) => {
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

export const updatSectionedPricing = async ({ priceId, name, sectionedPricing, commissionFee }) => {
  return await prisma.ticketPricing.update({
    where: {
      id: priceId,
      type: "sectioned",
    },
    data: {
      priceName: name,
      sectionPrices: sectionedPricing,
      commisionFee: Number(commissionFee),
    },
  });
};

export const updatFixedPricing = async ({ priceId, name, fixedPrice, commissionFee }) => {
  return await prisma.ticketPricing.update({
    where: {
      id: priceId,
      type: "fixed",
    },
    data: {
      priceName: name,
      fixedPrice,
      commisionFee: Number(commissionFee),
    },
  });
};

export const deleteSectionedPricing = async (id) => {
  return await prisma.ticketPricing.delete({ where: { id, type: "sectioned" } });
};

export const deleteFixedPricing = async (id) => {
  return await prisma.ticketPricing.delete({ where: { id, type: "fixed" } });
};

export const getTicketPricings = async () => {
  return await prisma.ticketPricing.findMany();
};

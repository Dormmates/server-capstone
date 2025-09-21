import prisma from "../utils/primsa.connection.js";

export const newFixedPricing = async ({ name, fixedPrice, commissionFee }) => {
  return await prisma.ticketpricing.create({
    data: {
      priceName: name,
      fixedPrice,
      commisionFee: commissionFee,
      type: "fixed",
      id: crypto.randomUUID(),
    },
  });
};

export const newSectionedPricing = async ({ name, sectionedPricing, commissionFee }) => {
  return await prisma.ticketpricing.create({
    data: {
      priceName: name,
      sectionPrices: sectionedPricing,
      commisionFee: commissionFee,
      id: crypto.randomUUID(),
      type: "sectioned",
    },
  });
};

export const getTicketPricings = async () => {
  return await prisma.ticketpricing.findMany();
};

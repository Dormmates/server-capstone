import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import {
  deleteFixedPricing,
  deleteSectionedPricing,
  getTicketPricings,
  newFixedPricing,
  newSectionedPricing,
  updatFixedPricing,
  updatSectionedPricing,
} from "../services/ticketprice.service.js";

export const addTicketPricingController = asyncHandler(async (req, res) => {
  const { priceName, type, fixedPrice, sectionPrices, commissionFee } = req.body;

  if (!priceName) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  if (type == "fixed") {
    if (!fixedPrice) {
      throw new AppError("Ticket Price is Missing", HttpStatusCodes.BadRequest);
    }
    await newFixedPricing({ name: priceName, fixedPrice, commissionFee });
  } else {
    if (!sectionPrices) {
      throw new AppError("Sectioned Price is Missing", HttpStatusCodes.BadRequest);
    }
    await newSectionedPricing({ name: priceName, commissionFee, sectionedPricing: sectionPrices });
  }

  res.json({ message: "Pricing Created" });
});

export const getTicketPricesController = asyncHandler(async (req, res) => {
  const prices = await getTicketPricings();
  res.json(prices);
});

export const updateSectionPricingController = asyncHandler(async (req, res) => {
  const { priceName, sectionPrices, commisionFee, id } = req.body;

  if (!priceName || !sectionPrices || !id) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await updatSectionedPricing({ priceId: id, name: priceName, sectionedPricing: sectionPrices, commissionFee: commisionFee });
  res.json({ message: "Updated" });
});

export const updateFixedPricingController = asyncHandler(async (req, res) => {
  const { priceName, fixedPrice, commisionFee, id } = req.body;

  if (!priceName || !fixedPrice || !id) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await updatFixedPricing({ priceId: id, name: priceName, fixedPrice, commissionFee: commisionFee });
  res.json({ message: "Updated" });
});

export const deleteSectionPricingController = asyncHandler(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }
  await deleteSectionedPricing(id);

  res.json({ message: "Deleted" });
});

export const deleteFixedPricingController = asyncHandler(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await deleteFixedPricing(id);
  res.json({ message: "Deleted" });
});

import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { getTicketPricings, newFixedPricing, newSectionedPricing } from "../services/ticketprice.service.js";

export const addTicketPricingController = asyncHandler(async (req, res) => {
  const { priceName, type, fixedPrice, sectionPrices, commisionFee } = req.body;

  if (!priceName) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  if (type == "fixed") {
    if (!fixedPrice) {
      throw new AppError("Ticket Price is Missing", HttpStatusCodes.BadRequest);
    }
    await newFixedPricing({ name: priceName, fixedPrice, commissionFee: commisionFee });
  } else {
    if (!sectionPrices) {
      throw new AppError("Sectioned Price is Missing", HttpStatusCodes.BadRequest);
    }
    await newSectionedPricing({ name: priceName, commissionFee: commisionFee, sectionedPricing: sectionPrices });
  }

  res.json({ message: "Pricing Created" });
});

export const getTicketPricesController = asyncHandler(async (req, res) => {
  const prices = await getTicketPricings();
  res.json(prices);
});

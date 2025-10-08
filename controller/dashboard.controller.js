import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { getTopDistributors, getTopShowsByGenre, getTopShowsByTicketSold, getTopShowsByTotalRevenue } from "../services/dashboard.service.js";

export const getTopShowsByTicketSoldController = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  const result = await getTopShowsByTicketSold({ departmentId });
  res.json(result);
});

export const getTopShowsByTotalRevenueController = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  const result = await getTopShowsByTotalRevenue({ departmentId });
  res.json(result);
});

export const getTopShowsByGenreController = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  const result = await getTopShowsByGenre({ departmentId });
  res.json(result);
});

export const getTopDistributorsController = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  const result = await getTopDistributors({ departmentId });
  res.json(result);
});

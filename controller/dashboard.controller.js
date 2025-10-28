import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import {
  getDashboardKpiSummary,
  getTopDistributors,
  getTopShowsByGenre,
  getTopShowsByTicketSold,
  getTopShowsByTotalRevenue,
  getUpcomingShowsSummary,
} from "../services/dashboard.service.js";

export const getTopShowsByTicketSoldController = asyncHandler(async (req, res) => {
  const { departmentId, from, to } = req.query;

  const result = await getTopShowsByTicketSold({ departmentId, dateRange: { from, to } });
  res.json(result);
});

export const getTopShowsByTotalRevenueController = asyncHandler(async (req, res) => {
  const { departmentId, from, to } = req.query;

  const result = await getTopShowsByTotalRevenue({ departmentId, dateRange: { from, to } });
  res.json(result);
});

export const getTopShowsByGenreController = asyncHandler(async (req, res) => {
  const { departmentId, from, to } = req.query;

  const result = await getTopShowsByGenre({ departmentId, dateRange: { from, to } });
  res.json(result);
});

export const getTopDistributorsController = asyncHandler(async (req, res) => {
  const { departmentId, from, to } = req.query;

  const result = await getTopDistributors({ departmentId, dateRange: { from, to } });
  res.json(result);
});

export const getKPISummaryController = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  const result = await getDashboardKpiSummary({ departmentId });
  res.json(result);
});

export const getUpcomingShowsController = asyncHandler(async (req, res) => {
  const { departmentId, from, to } = req.query;

  const result = await getUpcomingShowsSummary({ departmentId, dateRange: { from, to } });
  res.json(result);
});

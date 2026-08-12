import prisma from "../../lib/prisma";
import AppError from "../../lib/AppError";
import type { CreatePageInput, UpdatePageInput } from "./pages.schema";

export const getAllPages = async () => prisma.page.findMany({ orderBy: { createdAt: "desc" } });
export const getActivePage = async (slug: string) => {
  const page = await prisma.page.findFirst({ where: { slug, isActive: true } });
  if (!page) throw new AppError("Page not found", 404, "PAGE_NOT_FOUND");
  return page;
};
export const createPage = async (data: CreatePageInput) => {
  const existing = await prisma.page.findFirst({ where: { slug: data.slug } });
  if (existing) throw new AppError("Slug already exists", 409, "SLUG_EXISTS");
  return prisma.page.create({ data });
};
export const updatePage = async (id: string, data: UpdatePageInput) => {
  if (data.slug !== undefined) {
    const existing = await prisma.page.findFirst({ where: { slug: data.slug, id: { not: id } } });
    if (existing) throw new AppError("Slug already exists", 409, "SLUG_EXISTS");
  }
  return prisma.page.update({ where: { id }, data });
};
export const deletePage = async (id: string) => prisma.page.delete({ where: { id } });
export const getFooterPages = async () => prisma.page.findMany({ where: { isActive: true, showInFooter: true }, select: { id: true, title: true, slug: true } });

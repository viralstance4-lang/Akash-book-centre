/**
 * seed-book-categories.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Assigns categories + subcategories to all existing books by matching on
 * book title keywords.
 *
 * Run:
 *   npx tsx --env-file=.env prisma/seed-book-categories.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma  = new PrismaClient({ adapter } as any);

// ── Keyword rules ─────────────────────────────────────────────────────────────
// Each rule maps a set of title keywords (case-insensitive) to
// target category names and subcategory names.

type Rule = {
  keywords:      string[];   // any of these must appear in title
  categories:    string[];   // category names
  subcategories: string[];   // subcategory names
};

const RULES: Rule[] = [
  // NCERT books
  {
    keywords:      ["ncert", "class 6", "class 7", "class 8", "class 9", "class 10", "class 11", "class 12"],
    categories:    ["NCERT ORIGINAL BOOKS"],
    subcategories: ["NEW", "OLD"],
  },
  // Anthropology
  {
    keywords:      ["anthropology"],
    categories:    ["OPTIONAL NOTES", "UPSC OPTIONAL TEST SERIES"],
    subcategories: ["ANTHROPOLOGY"],
  },
  // PSIR / Political Science
  {
    keywords:      ["psir", "political science", "international relations"],
    categories:    ["OPTIONAL NOTES", "UPSC OPTIONAL TEST SERIES"],
    subcategories: ["PSIR"],
  },
  // Sociology
  {
    keywords:      ["sociology"],
    categories:    ["OPTIONAL NOTES", "UPSC OPTIONAL TEST SERIES"],
    subcategories: ["SOCIOLOGY"],
  },
  // Geography
  {
    keywords:      ["geography"],
    categories:    ["OPTIONAL NOTES", "UPSC OPTIONAL TEST SERIES"],
    subcategories: ["GEOGRAPHY"],
  },
  // History
  {
    keywords:      ["history", "ancient", "medieval", "modern india"],
    categories:    ["OPTIONAL NOTES"],
    subcategories: ["HISTORY"],
  },
  // Economy / Economics
  {
    keywords:      ["economy", "economics", "economic"],
    categories:    ["OPTIONAL NOTES", "ALL GS NOTES"],
    subcategories: ["ECONOMY", "GS PAPER 3"],
  },
  // Public Administration
  {
    keywords:      ["public administration"],
    categories:    ["OPTIONAL NOTES", "UPSC OPTIONAL TEST SERIES"],
    subcategories: ["PUBLIC ADMINISTRATION"],
  },
  // Maths
  {
    keywords:      ["mathematics", "maths"],
    categories:    ["OPTIONAL NOTES", "UPSC OPTIONAL TEST SERIES"],
    subcategories: ["MATHS"],
  },
  // GS Prelims
  {
    keywords:      ["prelim", "upsc prelim", "gs prelim", "pre cum mains"],
    categories:    ["UPSC GS PRE CUM MAINS", "UPSC PRELIMS TEST SERIES"],
    subcategories: ["PRELIMS"],
  },
  // GS Mains
  {
    keywords:      ["mains", "gs mains"],
    categories:    ["UPSC GS PRE CUM MAINS", "UPSC MAINS TEST SERIES"],
    subcategories: ["MAINS"],
  },
  // CSAT
  {
    keywords:      ["csat"],
    categories:    ["UPSC GS PRE CUM MAINS", "UPSC CSAT TEST SERIES"],
    subcategories: ["CSAT"],
  },
  // Current Affairs
  {
    keywords:      ["current affairs", "current affair"],
    categories:    ["UPSC CURRENT AFFAIRS"],
    subcategories: ["YEARLY COMPILATION"],
  },
  // PYQ
  {
    keywords:      ["pyq", "previous year", "question paper"],
    categories:    ["ALL PYQ"],
    subcategories: ["PRELIMS PYQ", "MAINS GS PYQ"],
  },
  // Hindi medium
  {
    keywords:      ["hindi", "hindi medium"],
    categories:    ["ALL NOTES HINDI MEDIUM"],
    subcategories: ["GS PAPER 1 HINDI"],
  },
  // GS Notes generic
  {
    keywords:      ["gs notes", "general studies", "note"],
    categories:    ["ALL GS NOTES"],
    subcategories: ["GS PAPER 1", "GS PAPER 2"],
  },
  // Test series generic (fallback)
  {
    keywords:      ["test series", "vision ias", "forum ias", "vajiram", "insights", "nextias", "drishti"],
    categories:    ["UPSC PRELIMS TEST SERIES", "UPSC MAINS TEST SERIES"],
    subcategories: ["VISION IAS TEST", "FORUM IAS TEST"],
  },
];

async function main() {
  console.log("🌱  Assigning categories to books…\n");

  // Load all categories + subcategories
  const allCategories = await prisma.category.findMany({
    include: { subcategories: true },
  });

  const catByName  = new Map(allCategories.map((c) => [c.name, c]));
  const subByName  = new Map(
    allCategories.flatMap((c) => c.subcategories.map((s) => [s.name, s]))
  );

  // Load all books
  const books = await prisma.book.findMany();
  console.log(`  Found ${books.length} books.\n`);

  let assigned = 0;

  for (const book of books) {
    const titleLower = book.title.toLowerCase();

    const catIds  = new Set<string>();
    const subIds  = new Set<string>();

    for (const rule of RULES) {
      const matches = rule.keywords.some((kw) => titleLower.includes(kw.toLowerCase()));
      if (!matches) continue;

      for (const catName of rule.categories) {
        const cat = catByName.get(catName);
        if (cat) catIds.add(cat.id);
      }
      for (const subName of rule.subcategories) {
        const sub = subByName.get(subName);
        if (sub) subIds.add(sub.id);
      }
    }

    // Fallback: if no rule matched, assign to "ALL GS NOTES" + "GS PAPER 1"
    if (catIds.size === 0) {
      const fallbackCat = catByName.get("ALL GS NOTES");
      const fallbackSub = subByName.get("GS PAPER 1");
      if (fallbackCat) catIds.add(fallbackCat.id);
      if (fallbackSub) subIds.add(fallbackSub.id);
    }

    // Delete existing assignments (idempotent)
    await prisma.bookCategory.deleteMany({ where: { bookId: book.id } });
    await prisma.bookSubcategory.deleteMany({ where: { bookId: book.id } });

    if (catIds.size > 0) {
      await prisma.bookCategory.createMany({
        data: [...catIds].map((categoryId) => ({ bookId: book.id, categoryId })),
        skipDuplicates: true,
      });
    }
    if (subIds.size > 0) {
      await prisma.bookSubcategory.createMany({
        data: [...subIds].map((subcategoryId) => ({ bookId: book.id, subcategoryId })),
        skipDuplicates: true,
      });
    }

    const catNames = [...catIds].map((id) => allCategories.find((c) => c.id === id)?.name ?? id);
    console.log(`  ✔ "${book.title.slice(0, 50)}"  →  [${catNames.join(", ")}]`);
    assigned++;
  }

  const totalLinks = await prisma.bookCategory.count();
  console.log(`\n✅  Done! ${assigned} books updated — ${totalLinks} category links total.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

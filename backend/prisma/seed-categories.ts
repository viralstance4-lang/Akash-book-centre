/**
 * seed-categories.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Seeds the 11 UPSC categories and all their subcategories.
 *
 * Run:
 *   npx tsx --env-file=.env prisma/seed-categories.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma  = new PrismaClient({ adapter } as any);

const createSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const CATEGORIES: Array<{ name: string; subs: string[] }> = [
  {
    name: "OPTIONAL NOTES",
    subs: [
      "ANTHROPOLOGY",
      "PSIR",
      "SOCIOLOGY",
      "CHEMISTRY",
      "FORESTRY",
      "GEOLOGY",
      "EVOLUTION BOTANY",
      "BT MANAGEMENT",
      "DAIS CHEMISTRY",
      "DAIS PHYSICS",
      "DAIS MEDICAL SCIENCE",
      "ECONOMY",
      "PARMAR SIR NOTES",
      "ZOOLOGY",
      "GEOGRAPHY",
      "HISTORY",
      "LAW",
      "COMMERCE",
      "PUBLIC ADMINISTRATION",
      "PHILOSOPHY",
      "MATHS",
      "AGRICULTURE",
    ],
  },
  {
    name: "NCERT ORIGINAL BOOKS",
    subs: ["NEW", "OLD"],
  },
  {
    name: "UPSC GS PRE CUM MAINS",
    subs: ["PRELIMS", "MAINS", "CSAT"],
  },
  {
    name: "UPSC PRELIMS TEST SERIES",
    subs: [
      "VISION IAS TEST",
      "FORUM IAS TEST",
      "INSIGHTS TEST",
      "VAJIRAM TEST",
      "GS SCORE TEST",
      "VAJIRAM CURRENT AFFAIRS TEST",
      "NEXTIAS TEST SERIES",
      "ONLY IAS TEST SERIES",
      "VAJIRAM CAMP TEST",
      "IAS BABA TEST",
      "FORUM ALL INDIA OPEN TEST",
      "DRISHTI IAS TEST",
      "Forum IAS SFG TEST L-1",
      "Forum IAS SFG TEST L-2",
      "NEXT IAS ANUBHAV TEST",
      "VAJIRAM ALL INDIA MOCK TEST",
      "DRISHTI IAS ALL INDIA MOCK TEST",
    ],
  },
  {
    name: "UPSC MAINS TEST SERIES",
    subs: [
      "VISION IAS TEST",
      "FORUM IAS TEST",
      "INSIGHTS TEST",
      "VAJIRAM TEST",
      "NEXTIAS TEST SERIES",
      "GS SCORE TEST",
    ],
  },
  {
    name: "UPSC OPTIONAL TEST SERIES",
    subs: [
      "ANTHROPOLOGY",
      "GEOGRAPHY",
      "MATHS",
      "PUBLIC ADMINISTRATION",
      "PSIR",
      "SOCIOLOGY",
    ],
  },
  {
    name: "UPSC CSAT TEST SERIES",
    subs: [
      "VISION CSAT TEST",
      "FORUM CSAT TEST",
      "FORUM CSAT SIMULATOR",
      "IAS SETU",
      "ANUBHAV CSAT",
      "FORUM SFG CSAT",
      "VAJIRAM CAMP CSAT",
    ],
  },
  {
    name: "UPSC CURRENT AFFAIRS",
    subs: [
      "VISION IAS MONTHLY CA",
      "FORUM IAS MONTHLY CA",
      "INSIGHTS MONTHLY CA",
      "VAJIRAM MONTHLY CA",
      "DRISHTI IAS MONTHLY CA",
      "NEXTIAS MONTHLY CA",
      "YEARLY COMPILATION",
    ],
  },
  {
    name: "ALL GS NOTES",
    subs: [
      "GS PAPER 1",
      "GS PAPER 2",
      "GS PAPER 3",
      "GS PAPER 4 ETHICS",
      "VISION IAS GS NOTES",
      "FORUM IAS GS NOTES",
      "VAJIRAM GS NOTES",
      "INSIGHTS GS NOTES",
      "DRISHTI IAS GS NOTES",
    ],
  },
  {
    name: "ALL PYQ",
    subs: [
      "PRELIMS PYQ",
      "MAINS GS PYQ",
      "MAINS ESSAY PYQ",
      "OPTIONAL PYQ",
      "CSAT PYQ",
    ],
  },
  {
    name: "ALL NOTES HINDI MEDIUM",
    subs: [
      "DRISHTI IAS HINDI NOTES",
      "VAJIRAM HINDI NOTES",
      "VISION IAS HINDI NOTES",
      "GS PAPER 1 HINDI",
      "GS PAPER 2 HINDI",
      "GS PAPER 3 HINDI",
      "GS PAPER 4 HINDI",
      "OPTIONAL HINDI NOTES",
    ],
  },
];

async function main() {
  console.log("🌱  Seeding UPSC categories…\n");

  for (let i = 0; i < CATEGORIES.length; i++) {
    const { name, subs } = CATEGORIES[i]!;
    const catSlug = createSlug(name);

    const category = await prisma.category.upsert({
      where:  { slug: catSlug },
      update: { name, order: i },
      create: { name, slug: catSlug, order: i },
    });

    console.log(`  ✔ ${name} (${subs.length} subs)`);

    for (let j = 0; j < subs.length; j++) {
      const subName = subs[j]!;
      const subSlug = `${catSlug}-${createSlug(subName)}`;

      await prisma.subcategory.upsert({
        where:  { slug: subSlug },
        update: { name: subName, order: j },
        create: {
          categoryId: category.id,
          name:       subName,
          slug:       subSlug,
          order:      j,
        },
      });
    }
  }

  const catCount = await prisma.category.count();
  const subCount = await prisma.subcategory.count();

  console.log(`\n✅  Done! ${catCount} categories + ${subCount} subcategories seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * seedBooks.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds UPSC books to reach a minimum of 100 total.
 * NEVER deletes — only appends. Skips duplicates by ISBN.
 *
 * Run:
 *   npx tsx --env-file=.env prisma/seedBooks.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma  = new PrismaClient({ adapter } as any);

const TARGET = 100;

type BookDef = {
  title:         string;
  author:        string;
  isbn:          string;
  description:   string;
  price:         number;
  comparePrice?: number;
  stock:         number;
  language:      string;
  publication:   string;
  coverImageUrl: string;
  subSlug:       string; // subcategory slug — categoryId derived from it
};

// A few reusable cover images (Unsplash, safe for placeholder use)
const C1 = "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=400&fit=crop";
const C2 = "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300&h=400&fit=crop";
const C3 = "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&h=400&fit=crop";
const C4 = "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=300&h=400&fit=crop";
const C5 = "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&h=400&fit=crop";

const BOOKS: BookDef[] = [
  // ── OPTIONAL NOTES (22 subcategories) ──────────────────────────────────────
  { title: "Anthropology Optional Notes 2026",      author: "Vision IAS",      isbn: "9780001000001", description: "Comprehensive anthropology optional notes for UPSC 2026.",         price: 499, comparePrice: 599, stock: 50, language: "English", publication: "Vision IAS",      coverImageUrl: C1, subSlug: "optional-notes-anthropology" },
  { title: "Social Anthropology UPSC Guide",        author: "Parmar Sir",      isbn: "9780001000002", description: "Social and cultural anthropology guide for UPSC optional.",        price: 449,                   stock: 40, language: "English", publication: "Parmar IAS",      coverImageUrl: C2, subSlug: "optional-notes-anthropology" },
  { title: "PSIR Optional Notes Complete 2026",     author: "Forum IAS",       isbn: "9780001000003", description: "Complete Political Science & IR optional notes for UPSC.",        price: 549, comparePrice: 649, stock: 45, language: "English", publication: "Forum IAS",       coverImageUrl: C3, subSlug: "optional-notes-psir" },
  { title: "Sociology Optional Notes 2026",         author: "Insights IAS",    isbn: "9780001000004", description: "Detailed sociology optional notes for UPSC Mains.",              price: 499,                   stock: 35, language: "English", publication: "Insights IAS",    coverImageUrl: C4, subSlug: "optional-notes-sociology" },
  { title: "Chemistry Optional UPSC Notes",         author: "DAIS Faculty",    isbn: "9780001000005", description: "Complete chemistry optional study material for UPSC.",           price: 599, comparePrice: 699, stock: 30, language: "English", publication: "DAIS",            coverImageUrl: C5, subSlug: "optional-notes-chemistry" },
  { title: "Forestry Optional Notes 2026",          author: "IFoS Academy",    isbn: "9780001000006", description: "Forestry optional notes for UPSC civil services.",               price: 449,                   stock: 25, language: "English", publication: "IFoS Academy",    coverImageUrl: C1, subSlug: "optional-notes-forestry" },
  { title: "Geology Optional Notes 2026",           author: "GeoUpsc Faculty", isbn: "9780001000007", description: "Geology optional complete notes for UPSC Mains.",               price: 499,                   stock: 20, language: "English", publication: "GeoUpsc",         coverImageUrl: C2, subSlug: "optional-notes-geology" },
  { title: "Evolution Botany Optional Notes",       author: "BioUpsc Faculty", isbn: "9780001000008", description: "Plant biology and evolution notes for UPSC optional.",           price: 449,                   stock: 22, language: "English", publication: "BioUpsc",         coverImageUrl: C3, subSlug: "optional-notes-evolution-botany" },
  { title: "BT Management Notes UPSC 2026",         author: "Management IAS",  isbn: "9780001000009", description: "Business and Technology Management notes for UPSC.",            price: 399,                   stock: 18, language: "English", publication: "Management IAS",  coverImageUrl: C4, subSlug: "optional-notes-bt-management" },
  { title: "DAIS Chemistry Notes 2026",             author: "DAIS Chemistry",  isbn: "9780001000010", description: "DAIS classroom chemistry notes for UPSC optional.",              price: 599,                   stock: 30, language: "English", publication: "DAIS",            coverImageUrl: C5, subSlug: "optional-notes-dais-chemistry" },
  { title: "DAIS Physics Notes 2026",               author: "DAIS Physics",    isbn: "9780001000011", description: "DAIS classroom physics notes for UPSC optional.",                price: 599,                   stock: 28, language: "English", publication: "DAIS",            coverImageUrl: C1, subSlug: "optional-notes-dais-physics" },
  { title: "DAIS Medical Science Notes 2026",       author: "DAIS Medical",    isbn: "9780001000012", description: "DAIS medical science optional notes for UPSC.",                  price: 699,                   stock: 20, language: "English", publication: "DAIS",            coverImageUrl: C2, subSlug: "optional-notes-dais-medical-science" },
  { title: "Indian Economy Optional Notes 2026",    author: "Vajiram Faculty", isbn: "9780001000013", description: "Indian economy optional subject notes for UPSC Mains.",         price: 499, comparePrice: 599, stock: 50, language: "English", publication: "Vajiram & Ravi",  coverImageUrl: C3, subSlug: "optional-notes-economy" },
  { title: "Parmar Sir Anthropology Notes Vol 1",   author: "Parmar Sir",      isbn: "9780001000014", description: "Famous Parmar Sir anthropology notes, volume 1.",               price: 449,                   stock: 60, language: "English", publication: "Parmar IAS",      coverImageUrl: C4, subSlug: "optional-notes-parmar-sir-notes" },
  { title: "Zoology Optional Notes 2026",           author: "ZooUpsc Faculty", isbn: "9780001000015", description: "Complete zoology optional notes for UPSC Mains.",               price: 499,                   stock: 22, language: "English", publication: "ZooUpsc",         coverImageUrl: C5, subSlug: "optional-notes-zoology" },
  { title: "Geography Optional Notes 2026",         author: "Vajiram Faculty", isbn: "9780001000016", description: "Complete geography optional subject notes for UPSC.",           price: 549, comparePrice: 649, stock: 45, language: "English", publication: "Vajiram & Ravi",  coverImageUrl: C1, subSlug: "optional-notes-geography" },
  { title: "History Optional Notes 2026",           author: "Vision IAS",      isbn: "9780001000017", description: "Comprehensive history optional notes for UPSC Mains.",          price: 549,                   stock: 40, language: "English", publication: "Vision IAS",      coverImageUrl: C2, subSlug: "optional-notes-history" },
  { title: "Law Optional Notes UPSC 2026",          author: "LawUpsc Academy", isbn: "9780001000018", description: "Law optional complete notes for UPSC civil services.",          price: 599,                   stock: 25, language: "English", publication: "LawUpsc",         coverImageUrl: C3, subSlug: "optional-notes-law" },
  { title: "Commerce and Accountancy Notes 2026",   author: "CommerceUpsc",    isbn: "9780001000019", description: "Commerce & accountancy optional notes for UPSC.",               price: 549,                   stock: 20, language: "English", publication: "CommerceUpsc",    coverImageUrl: C4, subSlug: "optional-notes-commerce" },
  { title: "Public Administration Notes 2026",      author: "Forum IAS",       isbn: "9780001000020", description: "Public administration optional complete notes.",                price: 549, comparePrice: 649, stock: 40, language: "English", publication: "Forum IAS",       coverImageUrl: C5, subSlug: "optional-notes-public-administration" },
  { title: "Philosophy Optional Notes 2026",        author: "PhiloUpsc",       isbn: "9780001000021", description: "Philosophy optional subject notes for UPSC Mains.",             price: 499,                   stock: 20, language: "English", publication: "PhiloUpsc",       coverImageUrl: C1, subSlug: "optional-notes-philosophy" },
  { title: "Mathematics Optional Notes 2026",       author: "MathsUpsc",       isbn: "9780001000022", description: "Mathematics optional complete notes for UPSC.",                 price: 599,                   stock: 22, language: "English", publication: "MathsUpsc",       coverImageUrl: C2, subSlug: "optional-notes-maths" },
  { title: "Agriculture Optional Notes 2026",       author: "AgriUpsc",        isbn: "9780001000023", description: "Agriculture optional subject notes for UPSC Mains.",            price: 549,                   stock: 18, language: "English", publication: "AgriUpsc",        coverImageUrl: C3, subSlug: "optional-notes-agriculture" },

  // ── NCERT ORIGINAL BOOKS ────────────────────────────────────────────────────
  { title: "NCERT Class 10 Science New Edition",    author: "NCERT",           isbn: "9780002000001", description: "NCERT Class 10 Science textbook, latest new edition.",           price: 149,                   stock: 200, language: "English", publication: "NCERT",          coverImageUrl: C4, subSlug: "ncert-original-books-new" },
  { title: "NCERT Class 12 History New Edition",    author: "NCERT",           isbn: "9780002000002", description: "NCERT Class 12 Themes in Indian History, new edition.",          price: 149,                   stock: 200, language: "English", publication: "NCERT",          coverImageUrl: C5, subSlug: "ncert-original-books-new" },
  { title: "NCERT Class 11 Geography Old Edition",  author: "NCERT",           isbn: "9780002000003", description: "NCERT Class 11 Geography old edition — preferred for UPSC.",     price: 129,                   stock: 150, language: "English", publication: "NCERT",          coverImageUrl: C1, subSlug: "ncert-original-books-old" },
  { title: "NCERT Class 9 History Old Edition",     author: "NCERT",           isbn: "9780002000004", description: "NCERT Class 9 India and Contemporary World, old edition.",       price: 119,                   stock: 150, language: "English", publication: "NCERT",          coverImageUrl: C2, subSlug: "ncert-original-books-old" },

  // ── UPSC GS PRE CUM MAINS ───────────────────────────────────────────────────
  { title: "GS Prelims Complete Guide 2026",        author: "Vision IAS",      isbn: "9780003000001", description: "Comprehensive GS Prelims study guide for UPSC 2026.",            price: 699, comparePrice: 799, stock: 60, language: "English", publication: "Vision IAS",      coverImageUrl: C3, subSlug: "upsc-gs-pre-cum-mains-prelims" },
  { title: "PT Master 2026 Prelims Book",           author: "Forum IAS",       isbn: "9780003000002", description: "PT Master book for UPSC prelims comprehensive preparation.",     price: 649,                   stock: 50, language: "English", publication: "Forum IAS",       coverImageUrl: C4, subSlug: "upsc-gs-pre-cum-mains-prelims" },
  { title: "GS Mains Answer Writing Guide 2026",    author: "Insights IAS",    isbn: "9780003000003", description: "Answer writing guide for GS mains papers 1 to 4.",              price: 699, comparePrice: 799, stock: 55, language: "English", publication: "Insights IAS",    coverImageUrl: C5, subSlug: "upsc-gs-pre-cum-mains-mains" },
  { title: "Mains Complete Study Pack 2026",        author: "Vajiram & Ravi",  isbn: "9780003000004", description: "Complete study pack for UPSC GS Mains 2026.",                   price: 799,                   stock: 40, language: "English", publication: "Vajiram & Ravi",  coverImageUrl: C1, subSlug: "upsc-gs-pre-cum-mains-mains" },
  { title: "CSAT Comprehensive Guide 2026",         author: "Drishti IAS",     isbn: "9780003000005", description: "CSAT Paper 2 comprehensive guide for UPSC Prelims.",             price: 499, comparePrice: 599, stock: 65, language: "English", publication: "Drishti IAS",     coverImageUrl: C2, subSlug: "upsc-gs-pre-cum-mains-csat" },
  { title: "CSAT Paper 2 Practice Workbook",        author: "Next IAS",        isbn: "9780003000006", description: "Practice workbook with solved exercises for CSAT Paper 2.",      price: 449,                   stock: 55, language: "English", publication: "Next IAS",        coverImageUrl: C3, subSlug: "upsc-gs-pre-cum-mains-csat" },

  // ── UPSC PRELIMS TEST SERIES (17 subcategories) ─────────────────────────────
  { title: "Vision IAS Prelims Test Series 2026",         author: "Vision IAS",     isbn: "9780004000001", description: "Vision IAS complete prelims test series booklet 2026.",          price: 799, comparePrice: 999, stock: 80, language: "English", publication: "Vision IAS",     coverImageUrl: C4, subSlug: "upsc-prelims-test-series-vision-ias-test" },
  { title: "Forum IAS Prelims Test Series 2026",          author: "Forum IAS",      isbn: "9780004000002", description: "Forum IAS comprehensive prelims test series 2026.",               price: 749,                   stock: 75, language: "English", publication: "Forum IAS",      coverImageUrl: C5, subSlug: "upsc-prelims-test-series-forum-ias-test" },
  { title: "Insights IAS Prelims Test Series 2026",       author: "Insights IAS",   isbn: "9780004000003", description: "Insights IAS prelims test series with full solutions.",           price: 699,                   stock: 60, language: "English", publication: "Insights IAS",   coverImageUrl: C1, subSlug: "upsc-prelims-test-series-insights-test" },
  { title: "Vajiram Prelims Test Series 2026",            author: "Vajiram & Ravi", isbn: "9780004000004", description: "Vajiram & Ravi prelims test series booklets 2026.",               price: 799,                   stock: 70, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C2, subSlug: "upsc-prelims-test-series-vajiram-test" },
  { title: "GS Score Prelims Test Series 2026",           author: "GS Score",       isbn: "9780004000005", description: "GS Score prelims mock test series 2026.",                         price: 649,                   stock: 50, language: "English", publication: "GS Score",       coverImageUrl: C3, subSlug: "upsc-prelims-test-series-gs-score-test" },
  { title: "Vajiram Current Affairs Test 2026",           author: "Vajiram & Ravi", isbn: "9780004000006", description: "Vajiram current affairs based prelims test series 2026.",         price: 699,                   stock: 55, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C4, subSlug: "upsc-prelims-test-series-vajiram-current-affairs-test" },
  { title: "Next IAS Prelims Test Series 2026",           author: "Next IAS",       isbn: "9780004000007", description: "Next IAS prelims test series complete booklet.",                  price: 699,                   stock: 45, language: "English", publication: "Next IAS",       coverImageUrl: C5, subSlug: "upsc-prelims-test-series-nextias-test-series" },
  { title: "Only IAS Test Series 2026",                   author: "Only IAS",       isbn: "9780004000008", description: "Only IAS prelims test series booklet 2026.",                      price: 649,                   stock: 40, language: "English", publication: "Only IAS",       coverImageUrl: C1, subSlug: "upsc-prelims-test-series-only-ias-test-series" },
  { title: "Vajiram Camp Test Series 2026",               author: "Vajiram & Ravi", isbn: "9780004000009", description: "Vajiram offline camp test series for UPSC prelims.",              price: 749,                   stock: 35, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C2, subSlug: "upsc-prelims-test-series-vajiram-camp-test" },
  { title: "IAS Baba Prelims Test Series 2026",           author: "IAS Baba",       isbn: "9780004000010", description: "IAS Baba popular prelims test series 2026.",                      price: 699,                   stock: 60, language: "English", publication: "IAS Baba",       coverImageUrl: C3, subSlug: "upsc-prelims-test-series-ias-baba-test" },
  { title: "Forum All India Open Test 2026",              author: "Forum IAS",      isbn: "9780004000011", description: "Forum IAS all India open prelims test series.",                   price: 599,                   stock: 55, language: "English", publication: "Forum IAS",      coverImageUrl: C4, subSlug: "upsc-prelims-test-series-forum-all-india-open-test" },
  { title: "Drishti IAS Prelims Test Series 2026",        author: "Drishti IAS",    isbn: "9780004000012", description: "Drishti IAS prelims mock test series 2026.",                      price: 699,                   stock: 65, language: "English", publication: "Drishti IAS",    coverImageUrl: C5, subSlug: "upsc-prelims-test-series-drishti-ias-test" },
  { title: "Forum IAS SFG Test Level 1",                  author: "Forum IAS",      isbn: "9780004000013", description: "Forum IAS Stay Focused Group Test Level 1.",                      price: 649,                   stock: 50, language: "English", publication: "Forum IAS",      coverImageUrl: C1, subSlug: "upsc-prelims-test-series-forum-ias-sfg-test-l-1" },
  { title: "Forum IAS SFG Test Level 2",                  author: "Forum IAS",      isbn: "9780004000014", description: "Forum IAS Stay Focused Group Test Level 2.",                      price: 649,                   stock: 50, language: "English", publication: "Forum IAS",      coverImageUrl: C2, subSlug: "upsc-prelims-test-series-forum-ias-sfg-test-l-2" },
  { title: "Next IAS Anubhav Test Series 2026",           author: "Next IAS",       isbn: "9780004000015", description: "Next IAS Anubhav test series for UPSC prelims.",                 price: 699,                   stock: 45, language: "English", publication: "Next IAS",       coverImageUrl: C3, subSlug: "upsc-prelims-test-series-next-ias-anubhav-test" },
  { title: "Vajiram All India Mock Test 2026",            author: "Vajiram & Ravi", isbn: "9780004000016", description: "Vajiram all India mock test series for UPSC prelims.",            price: 749,                   stock: 55, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C4, subSlug: "upsc-prelims-test-series-vajiram-all-india-mock-test" },
  { title: "Drishti All India Mock Test 2026",            author: "Drishti IAS",    isbn: "9780004000017", description: "Drishti IAS all India mock test for UPSC prelims.",               price: 699,                   stock: 60, language: "English", publication: "Drishti IAS",    coverImageUrl: C5, subSlug: "upsc-prelims-test-series-drishti-ias-all-india-mock-test" },

  // ── UPSC MAINS TEST SERIES ──────────────────────────────────────────────────
  { title: "Vision IAS Mains Test Series 2026",    author: "Vision IAS",     isbn: "9780005000001", description: "Vision IAS GS mains test series complete booklet 2026.",          price: 899, comparePrice: 999, stock: 70, language: "English", publication: "Vision IAS",     coverImageUrl: C1, subSlug: "upsc-mains-test-series-vision-ias-test" },
  { title: "Forum IAS Mains Test Series 2026",     author: "Forum IAS",      isbn: "9780005000002", description: "Forum IAS GS mains test series 2026.",                            price: 849,                   stock: 60, language: "English", publication: "Forum IAS",      coverImageUrl: C2, subSlug: "upsc-mains-test-series-forum-ias-test" },
  { title: "Insights Mains Test Series 2026",      author: "Insights IAS",   isbn: "9780005000003", description: "Insights IAS mains test series with model answers.",              price: 799,                   stock: 55, language: "English", publication: "Insights IAS",   coverImageUrl: C3, subSlug: "upsc-mains-test-series-insights-test" },
  { title: "Vajiram Mains Test Series 2026",       author: "Vajiram & Ravi", isbn: "9780005000004", description: "Vajiram & Ravi GS mains test series 2026.",                       price: 899,                   stock: 65, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C4, subSlug: "upsc-mains-test-series-vajiram-test" },
  { title: "Next IAS Mains Test Series 2026",      author: "Next IAS",       isbn: "9780005000005", description: "Next IAS GS mains test series booklet 2026.",                     price: 799,                   stock: 50, language: "English", publication: "Next IAS",       coverImageUrl: C5, subSlug: "upsc-mains-test-series-nextias-test-series" },
  { title: "GS Score Mains Test Series 2026",      author: "GS Score",       isbn: "9780005000006", description: "GS Score GS mains test series 2026.",                            price: 799,                   stock: 45, language: "English", publication: "GS Score",       coverImageUrl: C1, subSlug: "upsc-mains-test-series-gs-score-test" },

  // ── UPSC OPTIONAL TEST SERIES ───────────────────────────────────────────────
  { title: "Anthropology Optional Test Series 2026", author: "Vision IAS",     isbn: "9780006000001", description: "Anthropology optional test series for UPSC Mains.",           price: 699, stock: 40, language: "English", publication: "Vision IAS",     coverImageUrl: C2, subSlug: "upsc-optional-test-series-anthropology" },
  { title: "Geography Optional Test Series 2026",    author: "Forum IAS",      isbn: "9780006000002", description: "Geography optional test series with model answers.",          price: 699, stock: 35, language: "English", publication: "Forum IAS",      coverImageUrl: C3, subSlug: "upsc-optional-test-series-geography" },
  { title: "Mathematics Optional Test Series 2026",  author: "MathsUpsc",      isbn: "9780006000003", description: "Mathematics optional test series for UPSC Mains.",           price: 749, stock: 25, language: "English", publication: "MathsUpsc",      coverImageUrl: C4, subSlug: "upsc-optional-test-series-maths" },
  { title: "Public Admin Optional Test Series 2026", author: "Insights IAS",   isbn: "9780006000004", description: "Public administration optional test series 2026.",           price: 699, stock: 30, language: "English", publication: "Insights IAS",   coverImageUrl: C5, subSlug: "upsc-optional-test-series-public-administration" },
  { title: "PSIR Optional Test Series 2026",         author: "Vajiram & Ravi", isbn: "9780006000005", description: "PSIR optional test series for UPSC Mains 2026.",             price: 699, stock: 35, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C1, subSlug: "upsc-optional-test-series-psir" },
  { title: "Sociology Optional Test Series 2026",    author: "Drishti IAS",    isbn: "9780006000006", description: "Sociology optional test series for UPSC Mains.",             price: 699, stock: 30, language: "English", publication: "Drishti IAS",    coverImageUrl: C2, subSlug: "upsc-optional-test-series-sociology" },

  // ── UPSC CSAT TEST SERIES ───────────────────────────────────────────────────
  { title: "Vision IAS CSAT Test Series 2026",  author: "Vision IAS",     isbn: "9780007000001", description: "Vision IAS CSAT Paper 2 test series 2026.",                price: 599, stock: 60, language: "English", publication: "Vision IAS",     coverImageUrl: C3, subSlug: "upsc-csat-test-series-vision-csat-test" },
  { title: "Forum IAS CSAT Test Series 2026",   author: "Forum IAS",      isbn: "9780007000002", description: "Forum IAS CSAT test series with detailed solutions.",        price: 549, stock: 55, language: "English", publication: "Forum IAS",      coverImageUrl: C4, subSlug: "upsc-csat-test-series-forum-csat-test" },
  { title: "Forum CSAT Simulator 2026",         author: "Forum IAS",      isbn: "9780007000003", description: "Forum IAS CSAT simulator test series 2026.",                price: 599, stock: 50, language: "English", publication: "Forum IAS",      coverImageUrl: C5, subSlug: "upsc-csat-test-series-forum-csat-simulator" },
  { title: "IAS Setu CSAT Practice Book 2026",  author: "IAS Setu",       isbn: "9780007000004", description: "IAS Setu CSAT practice and test book 2026.",                price: 499, stock: 40, language: "English", publication: "IAS Setu",       coverImageUrl: C1, subSlug: "upsc-csat-test-series-ias-setu" },
  { title: "Anubhav CSAT Test Series 2026",     author: "Next IAS",       isbn: "9780007000005", description: "Next IAS Anubhav CSAT test series 2026.",                  price: 549, stock: 45, language: "English", publication: "Next IAS",       coverImageUrl: C2, subSlug: "upsc-csat-test-series-anubhav-csat" },
  { title: "Forum SFG CSAT Series 2026",        author: "Forum IAS",      isbn: "9780007000006", description: "Forum IAS SFG CSAT test series 2026.",                     price: 549, stock: 40, language: "English", publication: "Forum IAS",      coverImageUrl: C3, subSlug: "upsc-csat-test-series-forum-sfg-csat" },
  { title: "Vajiram Camp CSAT Test 2026",       author: "Vajiram & Ravi", isbn: "9780007000007", description: "Vajiram camp CSAT test series booklet 2026.",              price: 599, stock: 35, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C4, subSlug: "upsc-csat-test-series-vajiram-camp-csat" },

  // ── UPSC CURRENT AFFAIRS ────────────────────────────────────────────────────
  { title: "Vision IAS Monthly CA January 2026",    author: "Vision IAS",     isbn: "9780008000001", description: "Vision IAS monthly current affairs magazine January 2026.",  price: 149, stock: 100, language: "English", publication: "Vision IAS",     coverImageUrl: C5, subSlug: "upsc-current-affairs-vision-ias-monthly-ca" },
  { title: "Vision IAS Monthly CA February 2026",   author: "Vision IAS",     isbn: "9780008000002", description: "Vision IAS monthly current affairs magazine February 2026.", price: 149, stock: 100, language: "English", publication: "Vision IAS",     coverImageUrl: C1, subSlug: "upsc-current-affairs-vision-ias-monthly-ca" },
  { title: "Forum IAS Monthly Current Affairs 2026",author: "Forum IAS",      isbn: "9780008000003", description: "Forum IAS monthly current affairs compilation 2026.",       price: 149, stock: 90,  language: "English", publication: "Forum IAS",      coverImageUrl: C2, subSlug: "upsc-current-affairs-forum-ias-monthly-ca" },
  { title: "Insights Monthly Current Affairs 2026", author: "Insights IAS",   isbn: "9780008000004", description: "Insights IAS monthly current affairs 2026.",                price: 129, stock: 85,  language: "English", publication: "Insights IAS",   coverImageUrl: C3, subSlug: "upsc-current-affairs-insights-monthly-ca" },
  { title: "Vajiram Monthly Current Affairs 2026",  author: "Vajiram & Ravi", isbn: "9780008000005", description: "Vajiram & Ravi monthly current affairs booklet 2026.",      price: 149, stock: 95,  language: "English", publication: "Vajiram & Ravi", coverImageUrl: C4, subSlug: "upsc-current-affairs-vajiram-monthly-ca" },
  { title: "Drishti IAS Monthly CA 2026",           author: "Drishti IAS",    isbn: "9780008000006", description: "Drishti IAS monthly current affairs magazine 2026.",        price: 149, stock: 90,  language: "English", publication: "Drishti IAS",    coverImageUrl: C5, subSlug: "upsc-current-affairs-drishti-ias-monthly-ca" },
  { title: "Next IAS Monthly Current Affairs 2026", author: "Next IAS",       isbn: "9780008000007", description: "Next IAS monthly current affairs 2026.",                    price: 129, stock: 75,  language: "English", publication: "Next IAS",       coverImageUrl: C1, subSlug: "upsc-current-affairs-nextias-monthly-ca" },
  { title: "PT 365 Current Affairs 2026",           author: "Vision IAS",     isbn: "9780008000008", description: "PT 365 yearly current affairs compilation for UPSC prelims.",price: 399, comparePrice: 499, stock: 120, language: "English", publication: "Vision IAS", coverImageUrl: C2, subSlug: "upsc-current-affairs-yearly-compilation" },
  { title: "Vision IAS Yearly CA Compilation 2026", author: "Vision IAS",     isbn: "9780008000009", description: "Vision IAS annual current affairs compilation 2025-26.",    price: 349, stock: 110, language: "English", publication: "Vision IAS",     coverImageUrl: C3, subSlug: "upsc-current-affairs-yearly-compilation" },

  // ── ALL GS NOTES ────────────────────────────────────────────────────────────
  { title: "GS Paper 1 Complete Notes 2026",      author: "Vajiram & Ravi", isbn: "9780009000001", description: "GS Paper 1 History, Geography, Society complete notes.",     price: 599, comparePrice: 699, stock: 70, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C4, subSlug: "all-gs-notes-gs-paper-1" },
  { title: "GS Paper 2 Governance Notes 2026",    author: "Forum IAS",      isbn: "9780009000002", description: "GS Paper 2 Governance, Polity, IR complete notes.",           price: 599,                   stock: 65, language: "English", publication: "Forum IAS",      coverImageUrl: C5, subSlug: "all-gs-notes-gs-paper-2" },
  { title: "GS Paper 3 Economy and Tech Notes",   author: "Vision IAS",     isbn: "9780009000003", description: "GS Paper 3 Economy, Environment, Technology complete notes.", price: 599,                   stock: 60, language: "English", publication: "Vision IAS",     coverImageUrl: C1, subSlug: "all-gs-notes-gs-paper-3" },
  { title: "GS Paper 4 Ethics Notes 2026",        author: "Insights IAS",   isbn: "9780009000004", description: "GS Paper 4 Ethics, Integrity and Aptitude complete notes.",  price: 549,                   stock: 55, language: "English", publication: "Insights IAS",   coverImageUrl: C2, subSlug: "all-gs-notes-gs-paper-4-ethics" },
  { title: "Vision IAS GS Notes Complete 2026",   author: "Vision IAS",     isbn: "9780009000005", description: "Vision IAS GS notes all papers combined 2026.",              price: 1299, comparePrice: 1499, stock: 80, language: "English", publication: "Vision IAS",   coverImageUrl: C3, subSlug: "all-gs-notes-vision-ias-gs-notes" },
  { title: "Forum IAS GS Notes 2026",             author: "Forum IAS",      isbn: "9780009000006", description: "Forum IAS comprehensive GS notes 2026.",                     price: 1199,                  stock: 70, language: "English", publication: "Forum IAS",      coverImageUrl: C4, subSlug: "all-gs-notes-forum-ias-gs-notes" },
  { title: "Vajiram Yellow Books GS 2026",        author: "Vajiram & Ravi", isbn: "9780009000007", description: "Vajiram famous yellow books for all GS papers 2026.",        price: 1399, comparePrice: 1599, stock: 90, language: "English", publication: "Vajiram & Ravi", coverImageUrl: C5, subSlug: "all-gs-notes-vajiram-gs-notes" },
  { title: "Insights GS Notes 2026",              author: "Insights IAS",   isbn: "9780009000008", description: "Insights IAS GS comprehensive notes 2026.",                  price: 1099,                  stock: 60, language: "English", publication: "Insights IAS",   coverImageUrl: C1, subSlug: "all-gs-notes-insights-gs-notes" },
  { title: "Drishti IAS GS Notes 2026",           author: "Drishti IAS",    isbn: "9780009000009", description: "Drishti IAS GS complete notes for all papers.",              price: 1099,                  stock: 65, language: "English", publication: "Drishti IAS",    coverImageUrl: C2, subSlug: "all-gs-notes-drishti-ias-gs-notes" },

  // ── ALL PYQ ─────────────────────────────────────────────────────────────────
  { title: "UPSC Prelims PYQ 25 Years Solved",    author: "Drishti IAS",  isbn: "9780010000001", description: "25 years UPSC prelims previous year questions with solutions.", price: 599, comparePrice: 699, stock: 100, language: "English", publication: "Drishti IAS",  coverImageUrl: C3, subSlug: "all-pyq-prelims-pyq" },
  { title: "Prelims GS PYQ 2016-2026 Solved",     author: "Vision IAS",   isbn: "9780010000002", description: "UPSC prelims GS previous year questions 2016-2026.",           price: 549,                   stock: 90,  language: "English", publication: "Vision IAS",   coverImageUrl: C4, subSlug: "all-pyq-prelims-pyq" },
  { title: "UPSC Mains GS PYQ Solved Papers",     author: "Forum IAS",    isbn: "9780010000003", description: "UPSC mains GS previous year question papers with answers.",    price: 649,                   stock: 75,  language: "English", publication: "Forum IAS",    coverImageUrl: C5, subSlug: "all-pyq-mains-gs-pyq" },
  { title: "UPSC Mains Essay PYQ Book",           author: "Insights IAS", isbn: "9780010000004", description: "UPSC mains essay PYQ with model answers.",                    price: 449,                   stock: 60,  language: "English", publication: "Insights IAS", coverImageUrl: C1, subSlug: "all-pyq-mains-essay-pyq" },
  { title: "UPSC Optional PYQ Collection",        author: "Vajiram & Ravi",isbn: "9780010000005", description: "UPSC optional subject PYQ collection for all optionals.",    price: 499,                   stock: 55,  language: "English", publication: "Vajiram & Ravi",coverImageUrl: C2, subSlug: "all-pyq-optional-pyq" },
  { title: "UPSC CSAT PYQ Solved Papers",         author: "Next IAS",     isbn: "9780010000006", description: "UPSC CSAT previous year question papers with solutions.",     price: 449,                   stock: 70,  language: "English", publication: "Next IAS",     coverImageUrl: C3, subSlug: "all-pyq-csat-pyq" },

  // ── ALL NOTES HINDI MEDIUM ──────────────────────────────────────────────────
  { title: "Drishti IAS Hindi GS Notes 2026",      author: "Drishti IAS",    isbn: "9780011000001", description: "Drishti IAS Hindi medium GS notes for UPSC 2026.",         price: 699, comparePrice: 799, stock: 80, language: "Hindi", publication: "Drishti IAS",    coverImageUrl: C4, subSlug: "all-notes-hindi-medium-drishti-ias-hindi-notes" },
  { title: "Vajiram Hindi Medium Notes 2026",      author: "Vajiram & Ravi", isbn: "9780011000002", description: "Vajiram & Ravi Hindi medium GS notes 2026.",               price: 799,                   stock: 65, language: "Hindi", publication: "Vajiram & Ravi", coverImageUrl: C5, subSlug: "all-notes-hindi-medium-vajiram-hindi-notes" },
  { title: "Vision IAS Hindi Notes 2026",          author: "Vision IAS",     isbn: "9780011000003", description: "Vision IAS Hindi medium comprehensive notes 2026.",        price: 799,                   stock: 70, language: "Hindi", publication: "Vision IAS",     coverImageUrl: C1, subSlug: "all-notes-hindi-medium-vision-ias-hindi-notes" },
  { title: "GS Paper 1 Hindi Medium Notes",        author: "Drishti IAS",    isbn: "9780011000004", description: "GS Paper 1 complete notes in Hindi medium.",               price: 599,                   stock: 75, language: "Hindi", publication: "Drishti IAS",    coverImageUrl: C2, subSlug: "all-notes-hindi-medium-gs-paper-1-hindi" },
  { title: "GS Paper 2 Hindi Medium Notes",        author: "Vajiram & Ravi", isbn: "9780011000005", description: "GS Paper 2 governance notes in Hindi medium.",             price: 599,                   stock: 70, language: "Hindi", publication: "Vajiram & Ravi", coverImageUrl: C3, subSlug: "all-notes-hindi-medium-gs-paper-2-hindi" },
  { title: "GS Paper 3 Hindi Medium Notes",        author: "Vision IAS",     isbn: "9780011000006", description: "GS Paper 3 economy and environment notes in Hindi.",       price: 599,                   stock: 65, language: "Hindi", publication: "Vision IAS",     coverImageUrl: C4, subSlug: "all-notes-hindi-medium-gs-paper-3-hindi" },
  { title: "GS Paper 4 Ethics Hindi Notes 2026",   author: "Insights IAS",   isbn: "9780011000007", description: "GS Paper 4 Ethics notes in Hindi medium for UPSC.",       price: 549,                   stock: 60, language: "Hindi", publication: "Insights IAS",   coverImageUrl: C5, subSlug: "all-notes-hindi-medium-gs-paper-4-hindi" },
  { title: "Optional Subject Hindi Medium Notes",  author: "Drishti IAS",    isbn: "9780011000008", description: "Optional subject notes in Hindi medium for UPSC.",        price: 649,                   stock: 45, language: "Hindi", publication: "Drishti IAS",    coverImageUrl: C1, subSlug: "all-notes-hindi-medium-optional-hindi-notes" },
];

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  seedBooks.ts — safe seeder (no deletions)\n");

  const existingCount = await prisma.book.count();
  console.log(`  Current book count: ${existingCount}`);

  if (existingCount >= TARGET) {
    console.log(`  ✅  Already at or above ${TARGET} books. Nothing to do.`);
    return;
  }

  const needed = TARGET - existingCount;
  console.log(`  Need ${needed} more books to reach ${TARGET}.\n`);

  // Build subcategory slug → { id, categoryId } map
  const subcategories = await prisma.subcategory.findMany({
    select: { id: true, slug: true, categoryId: true },
  });
  const subMap = new Map(subcategories.map((s) => [s.slug, s]));

  if (subMap.size === 0) {
    console.error("  ❌  No subcategories found. Run seed-categories.ts first.");
    process.exit(1);
  }

  // Collect existing ISBNs to skip duplicates
  const existingIsbns = new Set(
    (await prisma.book.findMany({ select: { isbn: true } })).map((b) => b.isbn)
  );

  let added   = 0;
  let skipped = 0;
  let missing = 0;

  for (const book of BOOKS) {
    if (existingCount + added >= TARGET) break;

    if (existingIsbns.has(book.isbn)) {
      skipped++;
      continue;
    }

    const sub = subMap.get(book.subSlug);
    if (!sub) {
      console.warn(`  ⚠  Subcategory not found: "${book.subSlug}" — skipping "${book.title}"`);
      missing++;
      continue;
    }

    await prisma.book.create({
      data: {
        title:         book.title,
        author:        book.author,
        isbn:          book.isbn,
        description:   book.description,
        price:         book.price,
        comparePrice:  book.comparePrice ?? null,
        coverImageUrl: book.coverImageUrl,
        coverPublicId: `seed_${book.isbn}`,
        stock:         book.stock,
        language:      book.language,
        publication:   book.publication,
        categoryId:    sub.categoryId,
        subcategoryId: sub.id,
      },
    });

    added++;
    console.log(`  ✔ [${String(existingCount + added).padStart(3, "0")}] ${book.title}`);
  }

  const finalCount = await prisma.book.count();
  console.log(`\n✅  Done!`);
  console.log(`  Added  : ${added}`);
  console.log(`  Skipped: ${skipped} (ISBN already exists)`);
  console.log(`  Missing: ${missing} (subcategory slug not in DB)`);
  console.log(`  Total  : ${finalCount} books`);

  if (finalCount < TARGET) {
    console.warn(`\n  ⚠  Still below ${TARGET}. Run seed-categories.ts first if subcategories are missing, then re-run this script.`);
  }
}

main()
  .catch((e) => { console.error("❌  Seeder failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * Prisma Seed — 10 Categories + 50 Books
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"]!,
});
const prisma = new PrismaClient({ adapter } as any);

// ── 10 Categories (Genres) ────────────────────────────────────────────────────

const GENRES = [
  {
    name: "Fiction",
    slug: "fiction",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop",
  },
  {
    name: "Non-Fiction",
    slug: "non-fiction",
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&fit=crop",
  },
  {
    name: "Science",
    slug: "science",
    imageUrl: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&h=400&fit=crop",
  },
  {
    name: "History",
    slug: "history",
    imageUrl: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&h=400&fit=crop",
  },
  {
    name: "Biography",
    slug: "biography",
    imageUrl: "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=400&h=400&fit=crop",
  },
  {
    name: "Technology",
    slug: "technology",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop",
  },
  {
    name: "Self Help",
    slug: "self-help",
    imageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=400&fit=crop",
  },
  {
    name: "Romance",
    slug: "romance",
    imageUrl: "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=400&h=400&fit=crop",
  },
  {
    name: "Mystery",
    slug: "mystery",
    imageUrl: "https://images.unsplash.com/photo-1509266272358-7701da638078?w=400&h=400&fit=crop",
  },
  {
    name: "Children",
    slug: "children",
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop",
  },
];

// ── 50 Books (5 per genre) ────────────────────────────────────────────────────

const BOOKS_BY_GENRE: Record<string, Array<{
  title: string; author: string; isbn: string;
  description: string; price: number; comparePrice?: number;
  coverImageUrl: string; stock: number; language: string; publication: string;
}>> = {
  fiction: [
    {
      title: "The Great Horizon",
      author: "Arjun Mehta",
      isbn: "9781001001001",
      description: "A sweeping tale of love and loss set against the backdrop of modern India.",
      price: 299, comparePrice: 399,
      coverImageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop",
      stock: 45, language: "English", publication: "Rupa Publications",
    },
    {
      title: "Whispers in the Rain",
      author: "Priya Sharma",
      isbn: "9781001001002",
      description: "A mystery unfolds when a stranger arrives in a small hill town during monsoon.",
      price: 249, comparePrice: 349,
      coverImageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=400&fit=crop",
      stock: 32, language: "English", publication: "Penguin India",
    },
    {
      title: "City of Shadows",
      author: "Rahul Verma",
      isbn: "9781001001003",
      description: "Mumbai's underworld through the eyes of a young journalist chasing his first big story.",
      price: 349,
      coverImageUrl: "https://images.unsplash.com/photo-1495640452828-3df6795cf69b?w=300&h=400&fit=crop",
      stock: 20, language: "English", publication: "HarperCollins India",
    },
    {
      title: "Letters Never Sent",
      author: "Nandita Roy",
      isbn: "9781001001004",
      description: "An epistolary novel about two strangers whose letters cross paths by accident.",
      price: 199, comparePrice: 279,
      coverImageUrl: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=300&h=400&fit=crop",
      stock: 60, language: "English", publication: "Scholastic India",
    },
    {
      title: "Beyond the Blue Mountains",
      author: "Vikram Das",
      isbn: "9781001001005",
      description: "A coming-of-age story set in the tea gardens of Darjeeling.",
      price: 279,
      coverImageUrl: "https://images.unsplash.com/photo-1476275466078-4cdc8d9d6fcd?w=300&h=400&fit=crop",
      stock: 15, language: "English", publication: "Speaking Tiger",
    },
  ],

  "non-fiction": [
    {
      title: "India Unbound",
      author: "Gurcharan Das",
      isbn: "9781002001001",
      description: "A personal and political history of India from independence to the information age.",
      price: 399, comparePrice: 499,
      coverImageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=400&fit=crop",
      stock: 55, language: "English", publication: "Penguin India",
    },
    {
      title: "The Art of Thinking Clearly",
      author: "Rolf Dobelli",
      isbn: "9781002001002",
      description: "99 ways to be more correct and less deluded in your everyday thinking.",
      price: 349,
      coverImageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&h=400&fit=crop",
      stock: 40, language: "English", publication: "Sceptre",
    },
    {
      title: "Sapiens: A Brief History",
      author: "Yuval Noah Harari",
      isbn: "9781002001003",
      description: "How Homo sapiens came to rule the world — and what that means for our future.",
      price: 499, comparePrice: 599,
      coverImageUrl: "https://images.unsplash.com/photo-1559666126-84f389727b9a?w=300&h=400&fit=crop",
      stock: 80, language: "English", publication: "Harvill Secker",
    },
    {
      title: "The Lean Startup",
      author: "Eric Ries",
      isbn: "9781002001004",
      description: "How today's entrepreneurs use continuous innovation to create radically successful businesses.",
      price: 429,
      coverImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop",
      stock: 35, language: "English", publication: "Crown Business",
    },
    {
      title: "Atomic Habits",
      author: "James Clear",
      isbn: "9781002001005",
      description: "An easy and proven way to build good habits and break bad ones.",
      price: 449, comparePrice: 550,
      coverImageUrl: "https://images.unsplash.com/photo-1550399105-c4db5fb85c18?w=300&h=400&fit=crop",
      stock: 100, language: "English", publication: "Avery",
    },
  ],

  science: [
    {
      title: "A Brief History of Time",
      author: "Stephen Hawking",
      isbn: "9781003001001",
      description: "From the Big Bang to black holes — the universe explained for everyone.",
      price: 399, comparePrice: 499,
      coverImageUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=300&h=400&fit=crop",
      stock: 50, language: "English", publication: "Bantam Books",
    },
    {
      title: "The Gene: An Intimate History",
      author: "Siddhartha Mukherjee",
      isbn: "9781003001002",
      description: "A landmark history of the gene and a riveting exploration of what it means to be human.",
      price: 549,
      coverImageUrl: "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=300&h=400&fit=crop",
      stock: 28, language: "English", publication: "Scribner",
    },
    {
      title: "The Selfish Gene",
      author: "Richard Dawkins",
      isbn: "9781003001003",
      description: "A revolutionary work that rewrote our understanding of evolution.",
      price: 349,
      coverImageUrl: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=300&h=400&fit=crop",
      stock: 42, language: "English", publication: "Oxford University Press",
    },
    {
      title: "Cosmos",
      author: "Carl Sagan",
      isbn: "9781003001004",
      description: "A personal voyage through the universe with Carl Sagan as your guide.",
      price: 499, comparePrice: 599,
      coverImageUrl: "https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=300&h=400&fit=crop",
      stock: 60, language: "English", publication: "Random House",
    },
    {
      title: "Astrophysics for People in a Hurry",
      author: "Neil deGrasse Tyson",
      isbn: "9781003001005",
      description: "The essential universe from the Big Bang to dark energy, concisely explained.",
      price: 299,
      coverImageUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=300&h=400&fit=crop",
      stock: 75, language: "English", publication: "W. W. Norton",
    },
  ],

  history: [
    {
      title: "The Discovery of India",
      author: "Jawaharlal Nehru",
      isbn: "9781004001001",
      description: "Written in prison, a sweeping account of India's civilisation and culture.",
      price: 449,
      coverImageUrl: "https://images.unsplash.com/photo-1603796846097-bee99e4a601f?w=300&h=400&fit=crop",
      stock: 38, language: "English", publication: "Oxford University Press",
    },
    {
      title: "The Rise and Fall of the Third Reich",
      author: "William L. Shirer",
      isbn: "9781004001002",
      description: "A definitive chronicle of Nazi Germany by a journalist who witnessed it firsthand.",
      price: 699, comparePrice: 799,
      coverImageUrl: "https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=300&h=400&fit=crop",
      stock: 18, language: "English", publication: "Simon & Schuster",
    },
    {
      title: "Guns, Germs, and Steel",
      author: "Jared Diamond",
      isbn: "9781004001003",
      description: "Why history unfolded differently on different continents over the last 13,000 years.",
      price: 499,
      coverImageUrl: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=300&h=400&fit=crop",
      stock: 30, language: "English", publication: "W. W. Norton",
    },
    {
      title: "The Mughal Empire",
      author: "John F. Richards",
      isbn: "9781004001004",
      description: "A comprehensive history of one of the greatest empires of the early modern world.",
      price: 399,
      coverImageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=400&fit=crop",
      stock: 22, language: "English", publication: "Cambridge University Press",
    },
    {
      title: "Freedom at Midnight",
      author: "Larry Collins & Dominique Lapierre",
      isbn: "9781004001005",
      description: "The gripping story of India's independence and the partition of 1947.",
      price: 349, comparePrice: 449,
      coverImageUrl: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300&h=400&fit=crop",
      stock: 65, language: "English", publication: "Vikas Publishing",
    },
  ],

  biography: [
    {
      title: "Wings of Fire",
      author: "A. P. J. Abdul Kalam",
      isbn: "9781005001001",
      description: "The autobiography of India's beloved Missile Man and former President.",
      price: 249, comparePrice: 299,
      coverImageUrl: "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=300&h=400&fit=crop",
      stock: 120, language: "English", publication: "Universities Press",
    },
    {
      title: "Steve Jobs",
      author: "Walter Isaacson",
      isbn: "9781005001002",
      description: "The exclusive biography of the visionary co-founder of Apple.",
      price: 599, comparePrice: 699,
      coverImageUrl: "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=300&h=400&fit=crop",
      stock: 45, language: "English", publication: "Simon & Schuster",
    },
    {
      title: "Long Walk to Freedom",
      author: "Nelson Mandela",
      isbn: "9781005001003",
      description: "The autobiography of Nelson Mandela, from childhood to the presidency of South Africa.",
      price: 499,
      coverImageUrl: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=300&h=400&fit=crop",
      stock: 33, language: "English", publication: "Little, Brown",
    },
    {
      title: "The Diary of a Young Girl",
      author: "Anne Frank",
      isbn: "9781005001004",
      description: "The famous diary of Anne Frank, written in hiding during the Nazi occupation.",
      price: 199, comparePrice: 249,
      coverImageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop",
      stock: 88, language: "English", publication: "Doubleday",
    },
    {
      title: "My Experiments with Truth",
      author: "Mahatma Gandhi",
      isbn: "9781005001005",
      description: "The autobiography of the Father of the Nation, his life and philosophy of non-violence.",
      price: 179,
      coverImageUrl: "https://images.unsplash.com/photo-1583468982228-19f19164aee2?w=300&h=400&fit=crop",
      stock: 70, language: "English", publication: "Navajivan Publishing",
    },
  ],

  technology: [
    {
      title: "Clean Code",
      author: "Robert C. Martin",
      isbn: "9781006001001",
      description: "A handbook of agile software craftsmanship — how to write code that works and reads well.",
      price: 699, comparePrice: 799,
      coverImageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300&h=400&fit=crop",
      stock: 40, language: "English", publication: "Prentice Hall",
    },
    {
      title: "The Pragmatic Programmer",
      author: "Andrew Hunt & David Thomas",
      isbn: "9781006001002",
      description: "Your journey to mastery — timeless advice for every software developer.",
      price: 749,
      coverImageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=400&fit=crop",
      stock: 35, language: "English", publication: "Addison-Wesley",
    },
    {
      title: "Introduction to Algorithms",
      author: "Thomas H. Cormen",
      isbn: "9781006001003",
      description: "The definitive reference on algorithms, used in universities worldwide.",
      price: 999, comparePrice: 1199,
      coverImageUrl: "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?w=300&h=400&fit=crop",
      stock: 25, language: "English", publication: "MIT Press",
    },
    {
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
      isbn: "9781006001004",
      description: "The big ideas behind reliable, scalable, and maintainable systems.",
      price: 849,
      coverImageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=400&fit=crop",
      stock: 20, language: "English", publication: "O'Reilly Media",
    },
    {
      title: "Python Crash Course",
      author: "Eric Matthes",
      isbn: "9781006001005",
      description: "A hands-on, project-based introduction to Python programming for beginners.",
      price: 549, comparePrice: 649,
      coverImageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&h=400&fit=crop",
      stock: 55, language: "English", publication: "No Starch Press",
    },
  ],

  "self-help": [
    {
      title: "The Power of Now",
      author: "Eckhart Tolle",
      isbn: "9781007001001",
      description: "A guide to spiritual enlightenment and living fully in the present moment.",
      price: 299, comparePrice: 399,
      coverImageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=400&fit=crop",
      stock: 90, language: "English", publication: "New World Library",
    },
    {
      title: "Think and Grow Rich",
      author: "Napoleon Hill",
      isbn: "9781007001002",
      description: "The timeless classic on the 13 principles of success and wealth creation.",
      price: 199,
      coverImageUrl: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=300&h=400&fit=crop",
      stock: 110, language: "English", publication: "Sound Wisdom",
    },
    {
      title: "The 7 Habits of Highly Effective People",
      author: "Stephen R. Covey",
      isbn: "9781007001003",
      description: "Powerful lessons in personal change that have transformed millions of lives.",
      price: 399, comparePrice: 499,
      coverImageUrl: "https://images.unsplash.com/photo-1505682634904-d7c8d95cdc50?w=300&h=400&fit=crop",
      stock: 75, language: "English", publication: "Free Press",
    },
    {
      title: "Rich Dad Poor Dad",
      author: "Robert T. Kiyosaki",
      isbn: "9781007001004",
      description: "What the rich teach their kids about money that the poor and middle class do not.",
      price: 299,
      coverImageUrl: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=300&h=400&fit=crop",
      stock: 95, language: "English", publication: "Plata Publishing",
    },
    {
      title: "Deep Work",
      author: "Cal Newport",
      isbn: "9781007001005",
      description: "Rules for focused success in a distracted world — how to do your best work.",
      price: 349,
      coverImageUrl: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=300&h=400&fit=crop",
      stock: 60, language: "English", publication: "Grand Central Publishing",
    },
  ],

  romance: [
    {
      title: "Two States",
      author: "Chetan Bhagat",
      isbn: "9781008001001",
      description: "The story of a boy and a girl from two different states who fall in love.",
      price: 199, comparePrice: 250,
      coverImageUrl: "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=300&h=400&fit=crop",
      stock: 85, language: "English", publication: "Rupa Publications",
    },
    {
      title: "The Notebook",
      author: "Nicholas Sparks",
      isbn: "9781008001002",
      description: "A love story for the ages — a young couple separated by war and reunited by fate.",
      price: 249,
      coverImageUrl: "https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=300&h=400&fit=crop",
      stock: 50, language: "English", publication: "Warner Books",
    },
    {
      title: "Pride and Prejudice",
      author: "Jane Austen",
      isbn: "9781008001003",
      description: "The classic tale of love, class, and marriage in Regency-era England.",
      price: 149, comparePrice: 199,
      coverImageUrl: "https://images.unsplash.com/photo-1455885661740-29cbf08a42fa?w=300&h=400&fit=crop",
      stock: 120, language: "English", publication: "Wordsworth Classics",
    },
    {
      title: "Me Before You",
      author: "Jojo Moyes",
      isbn: "9781008001004",
      description: "An unlikely romance between a small-town girl and a paralysed young man.",
      price: 299,
      coverImageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&h=400&fit=crop",
      stock: 45, language: "English", publication: "Penguin Books",
    },
    {
      title: "Can You Keep a Secret?",
      author: "Sophie Kinsella",
      isbn: "9781008001005",
      description: "A hilarious romantic comedy about a woman who accidentally spills her deepest secrets.",
      price: 279,
      coverImageUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=300&h=400&fit=crop",
      stock: 38, language: "English", publication: "Dell",
    },
  ],

  mystery: [
    {
      title: "The Girl with the Dragon Tattoo",
      author: "Stieg Larsson",
      isbn: "9781009001001",
      description: "A journalist and a hacker investigate a 40-year-old disappearance in Sweden.",
      price: 349, comparePrice: 449,
      coverImageUrl: "https://images.unsplash.com/photo-1509266272358-7701da638078?w=300&h=400&fit=crop",
      stock: 40, language: "English", publication: "Norstedts Förlag",
    },
    {
      title: "Gone Girl",
      author: "Gillian Flynn",
      isbn: "9781009001002",
      description: "On the morning of his fifth wedding anniversary, Nick Dunne's wife disappears.",
      price: 299,
      coverImageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=400&fit=crop",
      stock: 55, language: "English", publication: "Crown Publishing",
    },
    {
      title: "And Then There Were None",
      author: "Agatha Christie",
      isbn: "9781009001003",
      description: "Ten strangers are lured to an island — and one by one they begin to die.",
      price: 199, comparePrice: 249,
      coverImageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&h=400&fit=crop",
      stock: 100, language: "English", publication: "Collins Crime Club",
    },
    {
      title: "The Da Vinci Code",
      author: "Dan Brown",
      isbn: "9781009001004",
      description: "A murder in the Louvre leads to a trail of clues hidden in Da Vinci's art.",
      price: 279,
      coverImageUrl: "https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=300&h=400&fit=crop",
      stock: 70, language: "English", publication: "Doubleday",
    },
    {
      title: "Big Little Lies",
      author: "Liane Moriarty",
      isbn: "9781009001005",
      description: "Three women, three dark secrets, and a murder at a school trivia night.",
      price: 319,
      coverImageUrl: "https://images.unsplash.com/photo-1546521343-4eb2c01aa44b?w=300&h=400&fit=crop",
      stock: 35, language: "English", publication: "Penguin Books",
    },
  ],

  children: [
    {
      title: "The Jungle Book",
      author: "Rudyard Kipling",
      isbn: "9781010001001",
      description: "The classic adventures of Mowgli, raised by wolves in the jungles of India.",
      price: 149, comparePrice: 199,
      coverImageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=300&h=400&fit=crop",
      stock: 150, language: "English", publication: "Macmillan",
    },
    {
      title: "Charlotte's Web",
      author: "E. B. White",
      isbn: "9781010001002",
      description: "The heartwarming story of a pig named Wilbur and his spider friend Charlotte.",
      price: 179,
      coverImageUrl: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=300&h=400&fit=crop",
      stock: 80, language: "English", publication: "Harper & Brothers",
    },
    {
      title: "Matilda",
      author: "Roald Dahl",
      isbn: "9781010001003",
      description: "A little girl with extraordinary powers faces her horrible parents and a terrifying headmistress.",
      price: 199,
      coverImageUrl: "https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=300&h=400&fit=crop",
      stock: 95, language: "English", publication: "Jonathan Cape",
    },
    {
      title: "The Little Prince",
      author: "Antoine de Saint-Exupéry",
      isbn: "9781010001004",
      description: "A pilot stranded in the desert meets a little prince visiting Earth from a tiny asteroid.",
      price: 149, comparePrice: 199,
      coverImageUrl: "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=300&h=400&fit=crop",
      stock: 110, language: "English", publication: "Reynal & Hitchcock",
    },
    {
      title: "Panchatantra Stories",
      author: "Vishnu Sharma",
      isbn: "9781010001005",
      description: "Ancient Indian fables of wisdom, friendship, and cunning — retold for young readers.",
      price: 129,
      coverImageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&h=400&fit=crop",
      stock: 140, language: "English", publication: "Amar Chitra Katha",
    },
  ],
};

// ── Seed function ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Starting seed...\n");

  // ── 1. Upsert genres ──────────────────────────────────────────────────────
  console.log("📂  Seeding 10 categories...");
  const genreMap: Record<string, string> = {}; // slug → id

  for (const g of GENRES) {
    const genre = await prisma.genre.upsert({
      where: { slug: g.slug },
      update: { imageUrl: g.imageUrl },
      create: { name: g.name, slug: g.slug, imageUrl: g.imageUrl },
    });
    genreMap[g.slug] = genre.id;
    console.log(`  ✓ ${genre.name}`);
  }

  // ── 2. Upsert books ───────────────────────────────────────────────────────
  console.log("\n📚  Seeding 50 books...");
  let count = 0;

  for (const [slug, books] of Object.entries(BOOKS_BY_GENRE)) {
    const genreId = genreMap[slug];
    if (!genreId) { console.warn(`  ⚠ Genre not found for slug "${slug}"`); continue; }

    for (const b of books) {
      await prisma.book.upsert({
        where: { isbn: b.isbn },
        update: {
          title:        b.title,
          author:       b.author,
          description:  b.description,
          price:        b.price,
          comparePrice: b.comparePrice ?? null,
          coverImageUrl: b.coverImageUrl,
          coverPublicId: `seed_${b.isbn}`,
          stock:        b.stock,
          language:     b.language,
          publication:  b.publication,
          genreId,
        },
        create: {
          title:        b.title,
          author:       b.author,
          isbn:         b.isbn,
          description:  b.description,
          price:        b.price,
          comparePrice: b.comparePrice ?? null,
          coverImageUrl: b.coverImageUrl,
          coverPublicId: `seed_${b.isbn}`,
          stock:        b.stock,
          language:     b.language,
          publication:  b.publication,
          genreId,
        },
      });
      count++;
      console.log(`  ✓ [${slug}] ${b.title}`);
    }
  }

  console.log(`\n✅  Done! ${GENRES.length} categories + ${count} books seeded.`);
}

main()
  .catch((e) => { console.error("❌  Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());

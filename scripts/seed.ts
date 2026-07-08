/**
 * Seeds the database with example proposals so the site isn't empty
 * on first deploy. Run: npm run seed
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { proposals, statusUpdates, submissions } from "../src/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

const SEED_PROPOSALS = [
  {
    slug: "neosvijetljena-dionica-puta-kroz-dracevac",
    title: "Neosvijetljena dionica puta kroz Dračevac",
    description:
      "Dio glavne ulice kroz Dračevac nema javnu rasvjetu u dužini od otprilike 300 metara. Djeca koja se vraćaju s treninga i stariji susjedi hodaju po mraku uz cestu bez nogostupa.\n\nPredlažemo da se Gradu Splitu uputi zahtjev za postavljanje rasvjetnih tijela na postojeće stupove.",
    neighborhood: "dracevac" as const,
    category: "rasvjeta" as const,
    status: "poslano_gradu" as const,
    updates: [
      { status: "objavljeno" as const, note: "Prijedlog objavljen na stranici." },
      {
        status: "poslano_gradu" as const,
        note: "Zahtjev poslan Službi za komunalno gospodarstvo Grada Splita.",
      },
    ],
  },
  {
    slug: "divlji-deponij-uz-put-u-bilicama",
    title: "Divlji deponij uz put u Bilicama",
    description:
      "Na zelenoj površini uz put u Bilicama već mjesecima raste divlji deponij građevinskog otpada. Osim što nagrđuje kvart, privlači glodavce i opasan je za djecu koja se igraju u blizini.\n\nTražimo čišćenje deponija i postavljanje znaka zabrane odlaganja otpada.",
    neighborhood: "bilice" as const,
    category: "otpad" as const,
    status: "u_tijeku" as const,
    updates: [
      { status: "objavljeno" as const, note: "Prijedlog objavljen na stranici." },
      { status: "poslano_gradu" as const, note: "Prijava poslana komunalnom redarstvu." },
      {
        status: "u_tijeku" as const,
        note: "Komunalno redarstvo potvrdilo izlazak na teren i najavilo čišćenje.",
      },
    ],
  },
  {
    slug: "pjesacki-prijelaz-kod-autobusne-stanice",
    title: "Pješački prijelaz kod autobusne stanice",
    description:
      "Kod autobusne stanice ne postoji obilježen pješački prijelaz, a cestu svakodnevno prelaze školarci i stariji stanovnici. Vozila se na tom dijelu kreću velikom brzinom.\n\nPredlažemo ucrtavanje pješačkog prijelaza i postavljanje prometnog znaka, a dugoročno i uspornika prometa.",
    neighborhood: "dracevac" as const,
    category: "promet" as const,
    status: "objavljeno" as const,
    updates: [
      { status: "objavljeno" as const, note: "Prijedlog objavljen na stranici." },
    ],
  },
  {
    slug: "uredenje-djecjeg-igralista-bilice",
    title: "Uređenje dječjeg igrališta u Bilicama",
    description:
      "Jedino dječje igralište u Bilicama godinama nije održavano: sprave su zahrđale, ograda je srušena, a podloga puna stakla. Roditelji djecu voze u druge kvartove.\n\nPredlažemo obnovu igrališta — nove sprave, gumenu podlogu i klupe. Ovo je prilika i za prijavu na gradski natječaj za male komunalne akcije.",
    neighborhood: "bilice" as const,
    category: "zelenilo" as const,
    status: "rijeseno" as const,
    updates: [
      { status: "objavljeno" as const, note: "Prijedlog objavljen na stranici." },
      { status: "poslano_gradu" as const, note: "Prijedlog uvršten u zahtjev mjesnog odbora." },
      { status: "u_tijeku" as const, note: "Grad odobrio sredstva, radovi započeli." },
      { status: "rijeseno" as const, note: "Igralište obnovljeno i otvoreno. 🎉" },
    ],
  },
];

async function seed(): Promise<void> {
  const existing = await db.select({ id: proposals.id }).from(proposals).limit(1);
  if (existing.length > 0) {
    console.log("Database already has proposals — skipping seed.");
    await client.end();
    return;
  }

  for (const item of SEED_PROPOSALS) {
    const { updates, ...proposal } = item;
    const [inserted] = await db.insert(proposals).values(proposal).returning();
    for (const update of updates) {
      await db.insert(statusUpdates).values({
        proposalId: inserted.id,
        ...update,
      });
      // Spread timestamps so the timeline reads naturally.
      await new Promise((r) => setTimeout(r, 30));
    }
    console.log(`Seeded: ${proposal.title}`);
  }

  await db.insert(submissions).values({
    title: "Oborinska voda plavi dvorišta nakon svake kiše",
    description:
      "Nakon svake jače kiše voda s ceste slijeva se u dvorišta jer nema oborinske odvodnje. Molimo da se ovo uvrsti u prioritete.",
    neighborhood: "dracevac",
    category: "voda",
    submitterName: "Ante iz Dračevca",
  });
  console.log("Seeded: 1 pending submission (za demo moderacije)");

  await client.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

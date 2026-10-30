import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Backblasts are shared: every signed-in user can read them, only the author can edit. */
export const backblast = pgTable(
  "backblast",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    date: date("date").notNull(),
    ao: text("ao").notNull(),
    q: text("q").notNull(),
    pax: text("pax").array().notNull().default([]),
    fngs: text("fngs").array().notNull().default([]),
    warmup: text("warmup"),
    thang: text("thang"),
    moleskin: text("moleskin"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("backblast_date_idx").on(t.date),
    index("backblast_author_idx").on(t.authorId),
  ],
);

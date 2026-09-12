import { connect } from "../src/db/connection";
import { pruneExpired } from "../src/server/maintenance";
const database = connect(process.env.DATABASE_URL ?? "", 1);
try {
  console.info(JSON.stringify(await pruneExpired(database)));
} finally {
  await database.client.end({ timeout: 5 });
}

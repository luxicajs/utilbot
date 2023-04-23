import fetch from "node-fetch";
import { QuickDB } from "quick.db";

const db = new QuickDB({ filePath: "./levels.db" });

async function importPages(num) {
    for (let i = 0; i < num; i++) {
        const dataFetch = await fetch(`https://mee6.xyz/api/plugins/levels/leaderboard/SERVER ID?page=${i}`);
        const data = await dataFetch.json();
        for await (const player of data.players) {
            await db.set(player.id, { xp: player.detailed_xp[0], allXp: player.xp, level: player.level });
            console.log(`Imported for ${player.username}#${player.discriminator}`);
        }
    }
}

importPages(15);

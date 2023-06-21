import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { GreatDB, Schema, DataType } from "great.db";
import canvacord from "canvacord";
import fs from "node:fs";
import isNumber from "is-number";

const bot = new Client({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
  ],
});

const db = new GreatDB.Database({
  type: GreatDB.Type.Disk,
  name: "levels",
});

const userSchema = Schema.Create({
  id: DataType.String,
  level: DataType.Number,
  xp: DataType.Number,
  allXp: DataType.BigInt,
});

const table = db.table("levels", userSchema);

const recentChatters = new Set();
const prefix = ".";

bot.on("ready", async () => {
  console.log(`Bot ready as ${bot.user.username}`);
});

const minXp = 15;
const maxXp = 25;

function xpNeeded(lvl) {
  let xp = 100;
  for (let i = 0; i < lvl; i++) {
    xp += 55 + 10 * i;
  }
  return xp;
}

bot.on("messageCreate", async (message) => {
  if (message.channel.type === "dm") return;
  if (message.author.bot) return;

  const authorId = message.author.id;

  if (!recentChatters.has(authorId)) {
    const xpToAdd = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

    const userExists = await table.has("id", authorId);

    if (userExists) {
      const user = await table.get("id", authorId);
      await table.set({
        id: authorId,
        xp: user.xp + xpToAdd,
        allXp: user.allXp + xpToAdd,
      });
      if (user.xp + xpToAdd > xpNeeded(user.level)) {
        const setXp = user.xp + xpToAdd - xpNeeded(user.level);
        await table.set({
          id: authorId,
          xp: setXp,
          level: user.level + 1,
          allXp: user.allXp + xpToAdd,
        });
      }
    } else {
      await table.set({ id: authorId, level: 0, xp: xpToAdd, allXp: xpToAdd });
    }

    recentChatters.add(authorId);

    setTimeout(() => {
      recentChatters.delete(authorId);
    }, 1000 * 60);
  }

  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/g);

    const command = args.shift().toLowerCase();

    switch (command) {
      case "leaderboard":
      case "lb":
      case "ld":
        const lbLength = await db.executeQuery(
          `SELECT count(id) as lbLength FROM levels;`
        );

        const rank = await db.executeQuery(`SELECT COUNT(*) + 1 AS rank
                FROM levels
                WHERE allXp > (SELECT allXp FROM levels WHERE id = '${message.author.id}');`);

        const page = Math.min(
          args[0] && isNumber(args[0]) ? args[0] - 1 : 0,
          Math.ceil(lbLength[0].lbLength / 10) - 1
        );

        const q1 = await db.executeQuery(
          `SELECT * FROM levels ORDER BY allXp DESC LIMIT 10 OFFSET ${
            page * 10
          }`
        );

        const lbEmbed = new EmbedBuilder()
          .setTitle(`Leaderboard Page ${page + 1}`)
          .setDescription(
            q1
              .map((e, i) => {
                return `${i + 1 + page * 10}. ${
                  message.guild.members.cache.get(e.id) || `<@${e.id}>`
                } - Level ${e.level} | ${e.xp.toLocaleString()} XP`;
              })
              .join("\n")
          )
          .setFooter({
            text: `Page ${page + 1} of ${
              Math.ceil(lbLength[0].lbLength / 10) - 1
            } | Your rank: ${rank[0]["rank"]}/${lbLength[0].lbLength}`,
          });

        message.channel.send({ embeds: [lbEmbed] });
        break;

      case "rank":
      case "r":
        // TODO. DOESN'T WORK. SCRAPPED FOR NOW
        // const rankUser = message.guild.members.cache.get(
        //   args[0] && isNumber(args[0])
        // ).user || message.author;

        const rankUser = message.author;

        const userInfo = await table.get("id", rankUser.id);

        const placement = await db.executeQuery(`SELECT COUNT(*) + 1 AS rank
                FROM levels
                WHERE allXp > (SELECT allXp FROM levels WHERE id = '${rankUser.id}');`);

        const card = new canvacord.Rank()
          .setAvatar(
            rankUser.displayAvatarURL({
              format: "png",
              size: 256,
            })
          )
          .setOverlay("transparent")
          .setCurrentXP(userInfo.xp)
          .setLevel(userInfo.level)
          .setRequiredXP(xpNeeded(userInfo.level), "#AAA")
          .setProgressBar("#0074D9")
          .setBackground("IMAGE", fs.readFileSync("./final.png"))
          .setUsername(rankUser.username)
          .setRank(placement[0].rank);
        card.build().then((data) => {
          const attachment = new AttachmentBuilder(Buffer.from(data), {
            name: "unknown.png",
          });
          message.channel.send({ files: [attachment] });
        });

        break;

      case "help":
        message.reply(
          "`.leaderboard/.ld/.lb` - Leaderboard | `.rank/.r` - Rank\nRunning 2.0.0-rc1v"
        );
        break;
    }
  }
});

bot.login(process.env.token);

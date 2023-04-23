import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { QuickDB } from "quick.db";
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

const db = new QuickDB({ filePath: "./levels.db" });

let recentChatters = new Set();
const prefix = ".";

const minXp = 15;
const maxXp = 25;

bot.on("ready", async () => {
    console.log("Bot ready");
});

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
    const user = await db.get(authorId);

    if (user) {
      await db.set(`${authorId}.xp`, user.xp + xpToAdd);
      await db.set(`${authorId}.allXp`, user.allXp + xpToAdd);
      if (user.xp + xpToAdd > xpNeeded(user.level)) {
        await db.set(authorId, {
          xp: user.xp + xpToAdd - xpNeeded(user.level),
          level: user.level + 1,
          allXp: user.allXp + xpToAdd,
        });
      }
    } else {
      await db.set(authorId, { level: 0, xp: xpToAdd, allXp: xpToAdd });
    }

    recentChatters.add(authorId);

    setTimeout(() => {
      delete recentChatters[authorId];
    }, 1000 * 60);
  }

  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/g);

    const command = args.shift().toLowerCase();

    switch (command) {
      case "leaderboard":
        let page = isNumber(args[0]) ? Number(args[0]) - 1 : 0;
        const all = await db.all();
        const numberOfPages = Math.ceil(all.length / 10);
        if (page >= numberOfPages) {
          page = numberOfPages - 1;
        }
        const sorted = all
          .sort((a, b) => b["value"]["allXp"] - a["value"]["allXp"])
          .slice(page * 10, page * 10 + 10);
        const placement = all.findIndex((e) => e.id == message.author.id) + 1;

        let lbString = "";

        sorted.forEach((e, i) => {
          const did = message.guild.members.cache.get(e.id);
          const username = did
            ? `${did.user.username}#${did.user.discriminator}`
            : `<@${e.id}>`;
          lbString += `**${i + 1 + page * 10}**. ${username} - Level ${
            e.value.level
          } | ${e.value.xp.toLocaleString()} XP\n`;
        });

        const lbEmbed = new EmbedBuilder()
          .setTitle(`Leaderboard Page ${page + 1}`)
          .setDescription(lbString)
          .setFooter({
            text: `Page ${
              page + 1
            } of ${numberOfPages} | Your rank: ${placement}/${all.length}`,
          });

        message.channel.send({ embeds: [lbEmbed] });
        break;
      case "rank":
        if (args[0])
          return message.channel.send(
            "You can't view someone's rank yet... It's still a work in progress."
          );
        const player = await db.get(authorId);
        const dat = await db.all();
        const rank =
          dat
            .sort((a, b) => b["value"]["allXp"] - a["value"]["allXp"])
            .findIndex((e) => e.id == message.author.id) + 1;

        const card = new canvacord.Rank()
          .setAvatar(
            message.author.displayAvatarURL({
              format: "png",
              size: 256,
            })
          )
          .setOverlay("transparent")
          .setCurrentXP(player.xp)
          .setLevel(player.level)
          .setRequiredXP(xpNeeded(player.level), "#AAA")
          .setProgressBar("#0074D9")
          .setBackground("IMAGE", fs.readFileSync("./final.png"))
          .setUsername(message.author.username)
          .setDiscriminator(message.author.discriminator)
          .setRank(rank);
        card.build().then((data) => {
          const attachment = new AttachmentBuilder(Buffer.from(data), {
            name: "unknown.png",
          });
          message.channel.send({ files: [attachment] });
        });
        break;
    }
  }
});

bot.login(process.env.token);

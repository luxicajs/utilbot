import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { QuickDB } from "quick.db";
import canvacord from "canvacord";
// import fs from "node:fs";
import isNumber from "is-number";

const bot = new Client({ intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildPresences] });

const db = new QuickDB({ filePath: "./levels.db" });

let recentChatters = [];
let prefix = ".";

bot.on("ready", async () => {
    console.log("Bot ready");
});

let minXp = 15;
let maxXp = 25;

function xpNeeded(lvl) {
    let xp = 100;
    for (let i = 0; i < lvl; i++) {
        xp += 55 + (10 * i);
    }
    return xp;
}

bot.on("messageCreate", async message => {
    if (message.channel.type === "dm") return;
    if (message.author.bot) return;

    let authorId = message.author.id;

    if (!recentChatters[authorId]) {
        let xpToAdd = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

        let user = await db.get(authorId);

        if (user) {
            await db.set(`${authorId}.xp`, user.xp + xpToAdd);
            await db.set(`${authorId}.allXp`, user.allXp + xpToAdd);
            if (user.xp + xpToAdd > xpNeeded(user.level)) {
                let setXp = (user.xp + xpToAdd) - xpNeeded(user.level);
                await db.set(authorId, { xp: setXp, level: user.level + 1, allXp: user.allXp + xpToAdd });
            }
        } else {
            await db.set(authorId, { level: 0, xp: xpToAdd, allXp: xpToAdd, username: `${message.author.username}#${message.author.discriminator}` });
        }

        recentChatters[authorId] = 1;

        setTimeout(() => {
            delete recentChatters[authorId];
        }, 1000 * 60);
    }

    if (message.content.startsWith(prefix)) {

        const args = message.content.slice(prefix.length).trim().split(/ +/g);

        const command = args.shift().toLowerCase();

        switch (command) {
            case "help":
                message.reply("This is a level and a logging bot. This bot is currently in its alpha stage. The following commands are available for now: `.rank` `.leaderboard` `.help`. If you have any questions, please contact Luxica#0001."
                    + "\nRole rewards and level up messages are not yet enabled on this bot to avoid conflict with the current leveling bot.");
                break;
            case "leaderboard":
                let page = isNumber(args[0]) ? Number(args[0]) - 1 : 0;
                let all = await db.all();
                let numberOfPages = Math.ceil(all.length / 10);
                if (page >= numberOfPages) { page = numberOfPages - 1; }
                let sorted = all.sort((a, b) => { return a["allXp"] - b["allXp"] }).slice(page * 10, (page * 10) + 10);

                let lbString = "";

                let placement = all.findIndex(e => e.id == message.author.id) + 1;

                sorted.forEach((e, i) => {
                    let did = message.guild.members.cache.get(e.id);
                    let username = did ? `${did.user.username}#${did.user.discriminator}` : `<@${e.id}>`;
                    lbString += `**${i + 1 + (page * 10)}**. ${username} - Level ${e.value.level} | ${e.value.xp.toLocaleString()} XP\n`;
                });

                const lbEmbed = new EmbedBuilder()
                    .setTitle(`Leaderboard Page ${page + 1}`)
                    .setDescription(lbString)
                    .setFooter({ text: `Page ${page + 1} of ${numberOfPages} | Your rank: ${placement}/${all.length}` });

                message.channel.send({ embeds: [lbEmbed] });
                break;
            case "rank":
                if (args[0]) return message.channel.send("You can't view someone's rank yet... It's still a work in progress.");
                let player = await db.get(authorId);

                let alldb = await db.all();
                let rank = alldb.findIndex(e => e.id == message.author.id) + 1;

                const card = new canvacord.Rank()
                    .setAvatar(message.author.displayAvatarURL({
                        format: "png",
                        size: 256
                    }))
                    .setOverlay("transparent")
                    .setCurrentXP(player.xp)
                    .setLevel(player.level)
                    .setRequiredXP(xpNeeded(player.level), "#AAA")
                    .setProgressBar("#0074D9")
                    //.setBackground("IMAGE", fs.readFileSync("./final.png")) You probably don't have this image
                    .setUsername(message.author.username)
                    .setDiscriminator(message.author.discriminator)
                    .setRank(rank)
                card.build()
                    .then(data => {
                        const attachment = new AttachmentBuilder(Buffer.from(data), { name: "unknown.png" });
                        message.channel.send({ files: [attachment] });
                    });
                break;
        }
    }
});

bot.login(process.env.token);

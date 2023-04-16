import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder, ActivityType, AuditLogEvent, Events, AttachmentBuilder } from "discord.js";
import * as Diff from "diff";
import humanizeDuration from "humanize-duration";

const bot = new Client({ intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildPresences] });
const log = console.log;

let logChannel;
let devlogChannel;

bot.on("ready", function () {
    log("Bot ready");
    logChannel = bot.channels.cache.get(process.env.logChannelID);
});

bot.on("messageDelete", message => {
    if (message.channel.type === "dm") return;
    if (message.author.bot) return;
    let messageAttachments = Array.from(message.attachments.values());

    const deleteEmbed = new EmbedBuilder()
        .setAuthor({ name: `${message.author.username}#${message.author.discriminator}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(`**Message sent by <@${message.author.id}> deleted in <#${message.channelId}>**\n${message.content}`)
        .setTimestamp()
        .setFooter({ text: `Author: ${message.author.id}` })
        .setColor(0xFF4136);

    if (messageAttachments.length == 1) {
        deleteEmbed.setImage(messageAttachments[0].proxyURL);
    } else if (messageAttachments.length > 1) {
        let attachmentsString = ``;
        messageAttachments.forEach(function (e, i) {
            attachmentsString += `[Attachment ${i + 1}](${e.proxyURL})\n`
        });
        deleteEmbed.addFields([{ name: "Attachments", value: attachmentsString }])
    }

    logChannel.send({ embeds: [deleteEmbed] });
});

bot.on("messageUpdate", (message, newMessage) => {
    if (message.channel.type === "dm") return;
    if (message.author.bot) return;
    if (message.content == newMessage.content) return;

    let toWrite = ``;
    const diff = Diff.diffChars(message.content, newMessage.content);
    diff.forEach(function (part) {
        const md = part.added ? "**" : part.removed ? "~~" : "";
        toWrite += `${md} ${part.value} ${md}`;
    });

    const updateEmbed = new EmbedBuilder()
        .setAuthor({ name: `${message.author.username}#${message.author.discriminator}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(`Message edited in <#${message.channelId}> [Jump to Message](https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id})`)
        .addFields([{ name: "Before", value: message.content }, { name: "After", value: newMessage.content }, { name: "Difference", value: toWrite }])
        .setTimestamp()
        .setFooter({ text: `Author: ${message.author.id}` })
        .setColor(0x0074D9);
    logChannel.send({ embeds: [updateEmbed] });
});

bot.on("guildMemberAdd", guild => {
    const memberEmbed = new EmbedBuilder()
        .setAuthor({ name: "Member Joined", iconURL: guild.user.displayAvatarURL() })
        .setDescription(`<@${guild.user.id}> ${guild.user.username}#${guild.user.discriminator}`)
        .addFields({ name: "Account Age", value: humanizeDuration(new Date().getTime() - guild.user.createdAt, { largest: 3 }) })
        .setFooter({ text: `ID: ${guild.user.id}` })
        .setTimestamp()
        .setColor(0x01FF70)

    logChannel.send({ embeds: [memberEmbed] });
});

bot.on("guildMemberRemove", guild => {
    const memberEmbed = new EmbedBuilder()
        .setAuthor({ name: "Member Left", iconURL: guild.user.displayAvatarURL() })
        .setDescription(`<@${guild.user.id}> ${guild.user.username}#${guild.user.discriminator}`)
        .setFooter({ text: `ID: ${guild.user.id}` })
        .setTimestamp()
        .setColor(0xFF4136);

    if (guild._roles.length >= 1) {
        memberEmbed.addFields({ name: "Roles", value: guild._roles.map(n => `<@&${n}>`).join(", ") });
    }

    logChannel.send({ embeds: [memberEmbed] });
});

// Discord does not offer a event for kicks, we have to rely on audit log events instead.
// oh yeah and about bans, don't use guildBanAdd, just use rely on this instead.

bot.on(Events.GuildAuditLogEntryCreate, async auditLog => {
    switch (auditLog.action) {
        case AuditLogEvent.MemberKick:
            const kickEmbed = new EmbedBuilder()
                .setAuthor({ name: "Member Kicked", iconURL: auditLog.target.displayAvatarURL() })
                .setDescription(`<@${auditLog.target.id}> ${auditLog.target.username}#${auditLog.target.discriminator}`)
                .addFields([{ name: "Executioner", value: `<@${auditLog.executorId}>` }, { name: "Reason", value: auditLog.reason || "No reason given." }])
                .setThumbnail(auditLog.target.displayAvatarURL())
                .setFooter({ text: `ID: ${auditLog.target.id}` })
                .setTimestamp()
                .setColor(0xFF4136);

            logChannel.send({ embeds: [kickEmbed] });
            break;
        case AuditLogEvent.MemberBanAdd:
            const banEmbed = new EmbedBuilder()
                .setAuthor({ name: "Member Banned", iconURL: auditLog.target.displayAvatarURL() })
                .setDescription(`<@${auditLog.target.id}> ${auditLog.target.username}#${auditLog.target.discriminator}`)
                .addFields([{ name: "Executioner", value: `<@${auditLog.executorId}>` }, { name: "Reason", value: auditLog.reason || "No reason given." }])
                .setThumbnail(auditLog.target.displayAvatarURL())
                .setFooter({ text: `ID: ${auditLog.target.id}` })
                .setTimestamp()
                .setColor(0xFF4136);

            logChannel.send({ embeds: [banEmbed] });
            break;
        case AuditLogEvent.MemberBanRemove:
            const unbanEmbed = new EmbedBuilder()
                .setAuthor({ name: "Member Unbanned", iconURL: auditLog.target.displayAvatarURL() })
                .setDescription(`<@${auditLog.target.id}> ${auditLog.target.username}#${auditLog.target.discriminator}`)
                .addFields([{ name: "Executioner", value: `<@${auditLog.executorId}>` }, { name: "Reason", value: auditLog.reason || "No reason given." }])
                .setThumbnail(auditLog.target.displayAvatarURL())
                .setFooter({ text: `ID: ${auditLog.target.id}` })
                .setTimestamp()
                .setColor(0x01FF70);

            logChannel.send({ embeds: [unbanEmbed] });
            break;
    }
});

bot.on("userUpdate", (oldUser, newUser) => {
    if (`${oldUser.username}#${oldUser.discriminator}` !== `${newUser.username}#${newUser.discriminator}`) {
        const updateEmbed = new EmbedBuilder()
            .setAuthor({ name: `${newUser.username}#${newUser.discriminator}`, iconURL: newUser.displayAvatarURL() })
            .setDescription(`<@${newUser.id}> ${newUser.username}#${newUser.discriminator} updated their username`)
            .setFields([{ name: "Before", value: `${oldUser.username}#${oldUser.discriminator}` }, { name: "After", value: `${newUser.username}#${newUser.discriminator}` }])
            .setFooter({ text: `ID: ${newUser.id}` })
            .setTimestamp()
            .setColor(0x01FF70);

            logChannel.send({embeds: [updateEmbed]});
    }
});

bot.on('messageDeleteBulk', messages => {
    if (message.channel.type === "dm") return;
    let message = messages.first();
    let deleted = Array.from(messages.values());
    const bulkEmbed = new EmbedBuilder()
    .setAuthor({name: message.guild.name, iconURL: message.guild.iconURL()}) //add a default one later idc
    .setTitle(`Bulk delete in <#${message.channel.id}>, ${deleted.length} ${deleted.length == 1 ? "message" : "messages"} deleted`)
    .setTimestamp()
    .setColor(0xFF851B);

    let bulkdata = ``; // this would be better with a map but nahhh
    deleted.reverse().forEach(n => {
        if (n.author.bot) return;
        bulkdata += `[${n.author.username}#${n.author.discriminator}]${n.content.length >= 1 ? " - " + n.content + "\n" : "\n"}`;
        n.attachments.forEach((e) => {
            bulkdata += `Attachment: ${e.proxyURL}\n`;
        });
    });

    logChannel.send({embeds: [bulkEmbed]});

    if (bulkdata.length >= 1) {
        let textFile = new AttachmentBuilder(Buffer.from(bulkdata), {name: "messages.txt"});
        logChannel.send({files: [textFile]});
    }
});



bot.login(process.env.token);

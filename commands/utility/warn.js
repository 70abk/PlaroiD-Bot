const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('path');
const filePath = require(path.join(__dirname, '../../config.json')).warnFilePath;

module.exports = {
    data: new SlashCommandBuilder()
      .setName('경고')
      .setDescription('서버 멤버에게 경고를 지급합니다.')
      .addUserOption(option =>
        option.setName('이름')
          .setDescription('경고를 지급할 멤버')
          .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('개수')
                .setDescription('부여할 경고의 수')
                .setRequired(true)
            )
        .addStringOption(option =>
            option.setName('사유')
                .setDescription('경고를 부여한 이유')
                .setRequired(true)),

    async execute(interaction) {
        const allRoleIDs = [
            '1152216050478350416',
            '1220243484779352064',
            '1286693691968192622',
        ];
        const adminID = interaction.user.id;
        const admin = interaction.guild.members.cache.get(adminID);
        const adminRoles = admin.roles.cache.filter(role => allRoleIDs.includes(role.id));
        if (adminRoles.size === 0) {
            await interaction.editReply('이 명령어는 Staff 이상의 권한이 필요합니다.');
            return;
        }
        const targetUser = interaction.options.getUser('이름');
        const userNameData = await interaction.guild.members.fetch(targetUser.id);
        if (targetUser.bot) {
            await interaction.editReply('올바른 서버 멤버가 아닙니다.');
            return;
        }
        for (const item of allRoleIDs) {
            if (userNameData.roles.cache.has(item)) {
                await interaction.editReply('관리자는 대상으로 지정할 수 없습니다.');
                return;
            }
        }
        const userID = targetUser.id;
        const userNick = targetUser.globalName;
        const number = Math.abs(interaction.options.getInteger('개수'));
        const warned = loadWarnData();
        const targetWarns = warned.get(userID);
        const warnReason = interaction.options.getString('사유') || '없음';
        if (targetWarns > 0) {
            finalWarn = targetWarns + number
        } else {
            finalWarn = number
        }
        warned.set(userID, finalWarn);
        const avatarURL = targetUser.displayAvatarURL();
        const warnedTime = Math.floor(Date.now() / 1000);
        const warnEmbed = new EmbedBuilder()
            .setColor('#992600')
            .setTitle('경고')
            .setAuthor({
                name: `${userNick}`,
                iconURL: `${avatarURL}`
            })
            .addFields(
                { name: '시간', value: `<t:${warnedTime}:f>`, inline: true },
                { name: '멤버', value: `<@${userID}>`, inline: true },
                { name: '관리자', value: `<@${adminID}>`, inline: true }
            )
            .addFields(
                { name: '사유', value: `${warnReason}`},
                { name: '경고 개수', value: `${finalWarn}/10 (+${number})`, inline: true },
            )
        const channel = interaction.guild.channels.cache.get('1228984653994659931');
        whetherBan = ""
        await channel.send({ embeds: [warnEmbed] });
        if (finalWarn >= 10) {
            await interaction.guild.members.ban(userNameData, { reason: '경고 누적' });
            whetherBan = " 경고 개수가 10개를 초과해 밴 처리 되었습니다."
            warned.delete(userID);
        } else if (finalWarn >= 7) {
            await userNameData.roles.add('1220326194231119974');
            const saEmbed = new EmbedBuilder()
            .setColor('#330804')
            .setTitle('활동 정지')
            .setAuthor({
                name: `${userNick}`,
                iconURL: `${avatarURL}`
            })
            .addFields(
                { name: '시간', value: `<t:${warnedTime}:f>`, inline: true },
                { name: '멤버', value: `<@${userID}>`, inline: true },
                { name: '관리자', value: `*자동 부여*`, inline: true }
            )
            .addFields(
                { name: '사유', value: `경고 누적`},
                { name: '기한', value: `7일`, inline: true },
            )
            await channel.send({ embeds: [saEmbed] });
        }
        await interaction.editReply(`${userNick}에게 경고 ${number}개를 부여했습니다. 현재 해당 멤버의 경고 개수는 ${finalWarn}개입니다.${whetherBan}`);
        try {
            await targetUser.send(`<@${userID}> "${warnReason}" 사유로 경고 ${number}개를 부여받았습니다. 현재 ${userNick}님의 경고 갯수는 ${finalWarn}개 입니다.`); 
        } catch (error) {
            switch (error.code) {
                case 50007:
                    await interaction.followUp({ content: '해당 유저의 DM이 허용되지 않아 알림을 전송할 수 없었습니다.', ephemeral: true });
                    break;
                default:
                    throw error;
            }
        }
        fs.promises.writeFile('userWarn.json', JSON.stringify(Object.fromEntries(warned)));
    },
};

function loadWarnData() {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        const userMap = new Map(Object.entries(jsonData));
        return userMap;
    } catch (error) {
        return new Map();
    }
}
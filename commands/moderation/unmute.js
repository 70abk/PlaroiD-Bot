const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('path');
const config = require(path.join(__dirname, '../../config.json'));
const SCHEDULE_FILE = path.join(__dirname, config.scheduleFilePath);
const TIMEOUT_FILE = path.join(__dirname, config.timeoutFilePath);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('해방')
        .setDescription('서버 멤버에게 활동 정지를 해제합니다.')
        .addUserOption(option =>
        option.setName('이름')
            .setDescription('활동 정지를 하제할 멤버')
            .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('사유')
                .setDescription('활동 정지를 해제한 이유')
                .setRequired(false)),

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
            await interaction.reply('이 명령어는 Staff 이상의 권한이 필요합니다.');
            return;
        }
        const targetUser = interaction.options.getUser('이름');
        const userNameData = await interaction.guild.members.fetch(targetUser.id);
        if (targetUser.bot) {
            await interaction.reply('올바른 서버 멤버가 아닙니다.');
            return;
        }
        for (const item of allRoleIDs) {
            if (userNameData.roles.cache.has(item)) {
                await interaction.reply('관리자는 대상으로 지정할 수 없습니다.');
                return;
            }
        }
        if (!userNameData.roles.cache.has('1220326194231119974')) {
            await interaction.rReply('해당 유저는 활동 정지 상태가 아닙니다.');
            return;
        }
        await interaction.deferReply();
        const userID = targetUser.id;
        const userNick = targetUser.globalName;
        const muteReason = interaction.options.getString('사유') || '없음';
        const avatarURL = targetUser.displayAvatarURL();
        const mutedTime = Math.floor(Date.now() / 1000);
        const channel = interaction.guild.channels.cache.get('1228984653994659931');
        const schedules = loadSchedules();
        scheduleTask(schedules)
        await userNameData.roles.remove('1220326194231119974');
        const unmuteEmbed = new EmbedBuilder()
        .setColor('#ffd400')
        .setTitle('활동 정지 해제')
        .setAuthor({
            name: `${userNick}`,
            iconURL: `${avatarURL}`
        })
        .addFields(
            { name: '시간', value: `<t:${mutedTime}:f>`, inline: true },
            { name: '멤버', value: `<@${userID}>`, inline: true },
            { name: '관리자', value: `<@${adminID}>`, inline: true }
        )
        .addFields(
            { name: '사유', value: muteReason},
        )
        await channel.send({ embeds: [unmuteEmbed] });
        await interaction.editReply(`${userNick}에게 활동 정지를 해제했습니다.`);
        try {
            await targetUser.send(`<@${userID}> "${muteReason}" 사유로 활동 정지가 해제되었습니다.`); 
        } catch (error) {
            switch (error.code) {
                case 50007:
                    await interaction.followUp({ content: '해당 유저의 DM이 허용되지 않아 알림을 전송할 수 없었습니다.', ephemeral: true });
                    break;
                default:
                    throw error;
            }
        }
    },
};
async function loadSchedules() {
    try {
        if (await fs.promises.exists(SCHEDULE_FILE)) {
            const data = await fs.promises.readFile(SCHEDULE_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            return [];
        }
    } catch (error) {
        return [];
    }
}
async function scheduleTask(task) {
    const userID = task.userId;
    const timeoutMap = loadTimeout();
    const timeoutKey = timeoutMap.get(userID);
    clearTimeout(timeoutKey);
    timeoutMap.delete(userID);
    const schedules = loadSchedules().filter(s => s.id !== task.id);
    await fs.promises.writeFile(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
    await fs.promises.writeFile(TIMEOUT_FILE, JSON.stringify(Object.fromEntries(timeoutMap)));
}
function loadTimeout() {
    try {
        const data = fs.promises.readFile(TIMEOUT_FILE, 'utf8');
        const parsedData = JSON.parse(data)
        return new Map(Object.entries(parsedData));
    } catch (error) {
        return new Map();
    }
}
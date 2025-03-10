const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('path');
const config = require(path.join(__dirname, '../../config.json'));
const SCHEDULE_FILE = path.join(__dirname, config.scheduleFilePath);
const TIMEOUT_FILE = path.join(__dirname, config.timeoutFilePath);
const { v4: uuidv4 } = require('uuid');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('뒤주')
        .setDescription('서버 멤버에게 활동 정지를 지급합니다.')
        .addUserOption(option =>
            option.setName('이름')
                .setDescription('활동 정지를 지급할 멤버')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('기한')
                .setDescription('활동 정지 기간')
                .setRequired(true)
                .addChoices(
                    { name: '1주일', value: '604800' },
                    { name: '1일', value: '86400' },
                    { name: '6시간', value: '21600' },
                    { name: '1시간', value: '3600' },
                    { name: '30분', value: '1800' },
                    { name: '10초', value: '10' },
                ))
        .addStringOption(option =>
            option.setName('사유')
                .setDescription('활동 정지를 부여한 이유')
                .setRequired(false)),

    async execute(interaction) {
        const client = interaction.client;
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
        if (userNameData.roles.cache.has('1220326194231119974')) {
            await interaction.reply('해당 유저는 이미 활동 정지 상태입니다.');
            return;
        }
        try {
            await interaction.deferReply();
            const userID = targetUser.id;
            const userNick = targetUser.globalName;
            const muteReason = interaction.options.getString('사유') || '없음';
            const avatarURL = targetUser.displayAvatarURL();
            const mutedTime = Math.floor(Date.now() / 1000);
            const channel = interaction.guild.channels.cache.get('1228984653994659931');
            const muteDur = Number(interaction.options.getString('기한'));
            const muteEnd = mutedTime + muteDur;
            const newSchedule = {
                id: uuidv4(),
                unixTime: muteEnd,
                userId: userID
            };
            let schedules = await loadSchedules();
            schedules.push(newSchedule);
            await fs.promises.writeFile(SCHEDULE_FILE, JSON.stringify(schedules, null, 2), 'utf8');
            await userNameData.roles.add('1220326194231119974');
            const currentTime = Math.floor(Date.now() / 1000);
            const delay = (newSchedule.unixTime - currentTime) * 1000;
            if (delay > 0) {
                const timeoutMap = await loadTimeout();
                const tID = setTimeout(async () => {
                    try {
                        const guild = await client.guilds.fetch("1152211578834386984");
                        const member = await guild.members.fetch(newSchedule.userId);
                        await member.roles.remove("1220326194231119974");
                        const unmuteEmbed = new EmbedBuilder()
                            .setColor('#ffd400')
                            .setTitle('활동 정지 해제')
                            .setAuthor({
                                name: member.displayName,
                                iconURL: member.displayAvatarURL()
                            })
                            .addFields(
                                { name: '시간', value: `<t:${mutedTime}:f>`, inline: true },
                                { name: '멤버', value: `<@${newSchedule.userId}>`, inline: true },
                                { name: '관리자', value: `*자동*`, inline: true }
                            )
                            .addFields(
                                { name: '사유', value: `*기한 만료*` },
                            );
                        const channel = guild.channels.cache.get('1228984653994659931');
                        await channel.send({ embeds: [unmuteEmbed] });
                        schedules = schedules.filter(s => s.id !== newSchedule.id);
                        await fs.promises.writeFile(SCHEDULE_FILE, JSON.stringify(schedules, null, 2), 'utf8');
                    } catch (unmuteError) {
                        throw unmuteError;
                    }
                }, delay);
                timeoutMap.set(newSchedule.userId, tID[Symbol.toPrimitive]('number'));
                await fs.promises.writeFile(TIMEOUT_FILE, JSON.stringify(Object.fromEntries(timeoutMap)));
            } else {
                const schedules = await loadSchedules();
                const updatedSchedules = schedules.filter(s => s.id !== newSchedule.id);
                await fs.promises.writeFile(SCHEDULE_FILE, JSON.stringify(updatedSchedules, null, 2));
                await unmute(newSchedule, interaction.guild);
            }
            const saEmbed = new EmbedBuilder()
                .setColor('#330804')
                .setTitle('활동 정지')
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
                    { name: '사유', value: muteReason },
                    { name: '만료', value: `<t:${muteEnd}:R>`, inline: true },
                );
            await channel.send({ embeds: [saEmbed] });
            await interaction.editReply(`${userNick}에게 활동 정지를 부여했습니다.`);
            try {
                await targetUser.send(`<@${userID}> "${muteReason}" 사유로 활동 정지를 부여받았습니다.`);
            } catch (innerError) {
                switch (innerError.code) {
                    case 50007:
                        await interaction.followUp({ content: '해당 유저의 DM이 허용되지 않아 알림을 전송할 수 없었습니다.', ephemeral: true });
                        break;
                    default:
                        throw error;
                }
            }
        } catch (error) {
            throw error;
        }
    },
};

// 스케줄 로드 함수
async function loadSchedules() {
    try {
        await fs.promises.access(SCHEDULE_FILE, fs.constants.F_OK);
        const data = await fs.promises.readFile(SCHEDULE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(error);
        return [];
    }
}

// 타임아웃 로드 함수
async function loadTimeout() {
    try {
        const data = await fs.promises.readFile(TIMEOUT_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        return new Map(Object.entries(parsedData));
    } catch (error) {
        return new Map();
    }
}

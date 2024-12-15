const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');
const path = require('path');

const BASE = 10_000;
const GROWTH = 2_500;
const REVERSE_PQ_PREFIX = -(BASE - 0.5 * GROWTH) / GROWTH;
const REVERSE_CONST = REVERSE_PQ_PREFIX * REVERSE_PQ_PREFIX;
const GROWTH_DIVIDES_2 = 2 / GROWTH;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Hypixel 네트워크 레벨을 검색한 후 역할을 부여합니다.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('마인크래프트 닉네임')
                .setRequired(true)),
    async execute(interaction) {
        if (interaction.channelId != '1230838052944085003' && interaction.channelId != '1242036383955025970') {
            await interaction.reply('이 명령어는 <#1230838052944085003>에서만 사용하실 수 있습니다.');
            return;
        }
        const name = interaction.options.getString('name');
        const username = interaction.user.username;
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const MojangApiUrl = `https://api.mojang.com/users/profiles/minecraft/${name}`;
        const { HypixelApiKey } = require(path.join(__dirname, '../../config.json'));
        try {
            try {
                const mjres = await axios.get(MojangApiUrl);
                var playerUUID = mjres.data.id;
            } catch (innerError) {
                await interaction.reply(`플레이어 "${name}" 를 찾을 수 없습니다.`);
                return;
            }
            const HypixelApiUrl = `https://api.hypixel.net/player?key=${HypixelApiKey}&uuid=${playerUUID}`;
            const response = await axios.get(HypixelApiUrl);
            const playerData = response.data.player;
            if (!playerData) {
                await interaction.reply(`플레이어 "${name}"은 하이픽셀 유저가 아닙니다.`);
                return;
            }
            const playerDiscordName = playerData.socialMedia?.links?.DISCORD;
            if (playerDiscordName == username || playerDiscordName == undefined) {
                await interaction.deferReply();
                const exp = playerData.networkExp;
                const level = calculate(exp);
                let userRoleID;
                if (level <= 40) { // 소위
                    userRoleID = '1174360645160943667';
                } else if (level > 40 && level <= 80) { // 중위
                    userRoleID = '1174360813193138177';
                } else if (level > 80 && level <= 120) { // 대위
                    userRoleID = '1174361038922186753';
                } else if (level > 120 && level <= 150) { // 소령
                    userRoleID = '1174361157310631936';
                } else if (level > 150 && level <= 180) { // 중령
                    userRoleID = '1174361311040241715';
                } else if (level > 180 && level <= 210) { // 대령
                    userRoleID = '1174361721561952286';
                } else if (level > 210 && level <= 240) { // 준장
                    userRoleID = '1174361826176270346';
                } else if (level > 240 && level <= 270) { // 소장
                    userRoleID = '1174362517800222761';
                } else if (level > 270 && level <= 300) { // 중장
                    userRoleID = '1237031525581852767';
                } else if (level > 300) { // 대장
                    userRoleID = '1237031855459663953';
                }

                const allRoleIDs = [
                    '1174360645160943667', // 소위
                    '1174360813193138177', // 중위
                    '1174361038922186753', // 대위
                    '1174361157310631936', // 소령
                    '1174361311040241715', // 중령
                    '1174361721561952286', // 대령
                    '1174361826176270346', // 준장
                    '1174362517800222761', // 소장
                    '1237031525581852767', // 중장
                    '1237031855459663953', // 대장
                ];
                const rolesToRemove = member.roles.cache.filter(role => allRoleIDs.includes(role.id));
                if (!member.roles.cache.has(userRoleID)) {
                    await member.roles.remove(rolesToRemove);
                    if (member.roles.cache.has("1250084959637602375")) {
                        await member.roles.remove("1250084959637602375");
                    }
                    await member.roles.add(userRoleID);
                    await interaction.editReply(`역할을 부여했습니다.`);
                } else {
                    await interaction.editReply(`해당 역할이 이미 부여되어 있습니다!`);
                }
            } else {
                await interaction.reply(`해당 플레이어는 다른 디스코드 아이디에 연결되어 있습니다!\n부계정을 사용하고 있거나 하이픽셀에 연동된 디스코드 아이디가 일치하는지 확인해주세요.\n만일 부득이한 경우라면 <@718827787422793820>의 /general name:닉네임 명령어를 사용한 뒤 사유를 작성해주세요.`);
            }
        } catch (error) {
            throw error;
        }
    },
};

function calculate(exp) {
    return exp < 0 ? 1 : Math.floor(1 + REVERSE_PQ_PREFIX + Math.sqrt(REVERSE_CONST + GROWTH_DIVIDES_2 * exp));
}

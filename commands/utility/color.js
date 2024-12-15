const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('색깔')
        .setDescription('이름 색깔을 변경합니다.')
        .addStringOption(option =>
            option.setName('hex')
                .setDescription('HEX 코드(ex:#000000)')
                .setRequired(true)),
    async execute(interaction) {
        try {
            const userID = interaction.user.id;
            const member = await interaction.guild.members.fetch(userID);
            const HEX = (() => {
                const input = interaction.options.getString('hex');
                return input.charAt(0) !== '#' ? `#${input}` : input;
            })();
            if (!boolHEX(HEX)) {
                await interaction.reply(`올바른 HEX 코드를 입력해주세요.`);
                return;
            }
            await interaction.deferReply();
            const roleName = `${userID}_color`;
            const colRole = await getRoleByName(interaction.guild, roleName);
            if (colRole) {
                await colRole.edit({ color: HEX });
                await interaction.editReply(`색상을 "${HEX}"로 변경했습니다.`);
                return;
            }
            const targetRole = interaction.guild.roles.cache.get('1237031855459663953');
            const newRole = await interaction.guild.roles.create({
                name: roleName,
                color: HEX,
                hoist: false,
                mentionable: false,
            });
            await newRole.setPosition(targetRole.position + 1);
            await member.roles.add(newRole);
            await interaction.editReply(`색상을 "${HEX}"로 변경했습니다.`);
        } catch (error) {
            throw error;
        }
    },
};

async function getRoleByName(guild, roleName) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    return role || null;
}

function boolHEX(value) {
    const hexPattern = /^#([0-9A-Fa-f]{3}){1,2}$/;
    return hexPattern.test(value);
}

const { SlashCommandBuilder} = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('봇 디버깅을 위한 명령어입니다.')
        .addStringOption(option =>
			option.setName('category')
				.setDescription('The gif category')
				.setRequired(true)
				.addChoices(
					{ name: 'Funny', value: 'gif_funny' },
					{ name: 'Meme', value: 'gif_meme' },
					{ name: 'Movie', value: 'gif_movie' },
				)),
    async execute(interaction) {
        // interaction 객체에서 필요한 정보를 가져옵니다.
        const guild = interaction.guild; // 명령어가 실행된 서버
        const userID = interaction.user.id
        const user = interaction.guild.members.cache.get(userID);
        const channel = interaction.channel; // 명령어가 실행된 채널
        if (channel != "1242036383955025970") {
            await interaction.reply(`어허 그런거 막 쓰는 거 아닙니다 ^^`);
            return
        } else {
            await interaction.reply(interaction.options.getString('category'));
        }
    },
};

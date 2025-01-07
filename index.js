/* ** 변수/상수 이름 **
Modules
fs - node:fs
path - path
cron - node-cron
/////////////////////
Consts
filePath - 미인증 유저 인증날짜 저장파일 경로 (userData.json)
SCHEDULE_FILE - 뒤주된 유저 목록 저장파일 경로 (schedule.json)
TIMEOUT_FILE - 해방시 취소할 뒤주 목록 저장파일 경로 (timeouts.json)
*/
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const fs = require('node:fs');
const path = require('node:path');
const config = require(path.join(__dirname, './config.json'));
const token = config.token;
const filePath = path.join(__dirname, config.userDataFilePath);
const SCHEDULE_FILE = path.join(__dirname, config.scheduleIndex);
const TIMEOUT_FILE = path.join(__dirname, config.timeoutIndex);
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});
// fs 경로 설정
if (!fs.existsSync('logs')) {
	fs.mkdirSync('logs');
}
if (!fs.existsSync('data')) {
	fs.mkdirSync('data');
}
if (!fs.existsSync(filePath)) {
	fs.writeFileSync(filePath, '{}', 'utf8');
}
if (!fs.existsSync(SCHEDULE_FILE)) {
	fs.writeFileSync(SCHEDULE_FILE, '[]', 'utf8');
}

// 명령어 불러오기
client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] 명령어 ${filePath}는 "data" 혹은 "execute" 프로퍼티가 없습니다. 제대로 동작하지 않을 수 있습니다.`);
        }
    }
}

// 봇 실행시 작동할 코드
client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    fs.promises.writeFile(TIMEOUT_FILE, JSON.stringify({}, null, 2), 'utf8');
    const schedules = await loadSchedules();
    schedules.forEach(scheduleTask);
});

//명령어 실행 코드
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`${interaction.commandName} 명령어를 실행할 코드를 찾을 수 없었습니다.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        try {
			if (!interaction) {
				console.error(`"${command.data.name}" 명령어 실행 중 interaction이 유효하지 않거나 요청이 만료되었습니다!`);
				return;
			}
            await logError(error, interaction);
        } catch (innerError) {
            console.log("Error occured while sending error message. This may be internet issue.");
            const timestamp = getTimestamp();
            const logFileName = `logs/error_index.js_${timestamp}.log`;
            const errorLog = `Critical error occured: ${innerError.name}\n${error.stack || 'No stack trace available'}`;
            fs.promises.writeFile(logFileName, errorLog, 'utf8');
        }
    }
});

// 서버에 사람이 들어올 시 실행할 코드
client.on('guildMemberAdd', async member => {
    return;
});

// 인증 시스템 공지 함수(Unused)
/*
    cron.schedule('0 21 * * *', () => {
        console.log('작업 수행');
        verifyNotice();
    }, {
        scheduled: true,
        timezone: "Asia/Seoul"
    });

    const roleId = '1250084959637602375';
    const role = member.guild.roles.cache.get(roleId);
    try {
        if (!member.roles.cache.has("1250084959637602375") && member.bot) {
            await member.roles.add(role);
        }
    } catch (error) {
        console.error(`Failed to add role ${role.name} to ${member.user.tag}:`, error);
    }
    
function loadUserData() {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        const userDataMap = new Map(Object.entries(jsonData));
        return userDataMap;
    } catch (error) {
        indexError(error, "loading verify data")
        return new Map();
    }
}

async function verifyNotice() {
    try {
        const guild = client.guilds.cache.get('1152211578834386984');
        const role = guild.roles.cache.get('1250084959637602375');
        const channel = client.channels.cache.get('1230838052944085003');
        await guild.members.fetch();
        const memberIds = guild.members.cache
            .filter(member => member.roles.cache.has(role.id))
            .map(member => member.user.id);
        const userData = loadUserData();
        for (const id of memberIds) {
            let meDate = userData.get(id) || 0;
            if (meDate >= 30) {
                userData.delete(id);
                const member = await guild.members.fetch(id);
                await member.kick('장기간 미인증');
            } else if (meDate >= 21 || meDate == 14 || meDate == 7) {
                await channel.send(`<@${id}> ${meDate}일동안 인증을 진행하지 않으셨습니다. 30일 이상 인증을 진행하지 않을 경우 서버에서 추방될 수 있습니다.`);
            }
            userData.set(id, ++meDate);
        }
        const serverMemberIds = new Set(guild.members.cache.map(member => member.user.id));
        userData.forEach((_value, userId) => {
            if (!serverMemberIds.has(userId)) {
                userData.delete(userId);
                console.log(`Deleted data for user ${userId} as they no longer exist in the server.`);
            }
        });
        fs.writeFileSync('userData.json', JSON.stringify(Object.fromEntries(userData)));
    } catch (error) {
        indexError(error, "verifyNotice")
    }
}
*/
// ***** 뒤주/해방 함수 *****
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

async function unmute(task) {
    try {
        const guild = client.guilds.cache.get('1152211578834386984');
        const userID = task.userId;
        const member = await guild.members.fetch(userID);
        await member.roles.remove("1220326194231119974");
        const userNick = member.globalName;
        const avatarURL = member.displayAvatarURL();
        const mutedTime = Math.floor(Date.now() / 1000);
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
                { name: '관리자', value: `*자동*`, inline: true }
            )
            .addFields(
                { name: '사유', value: `*기한 만료*` },
            );
        const channel = guild.channels.cache.get('1228984653994659931');
        await channel.send({ embeds: [unmuteEmbed] });
    } catch (error) {
        switch (error.code) {
            case 10007:
                return;
            default:
                indexError(error, "auto-unmute")
                break;
        }
    }
}

async function scheduleTask(task) {
    const currentTime = Math.floor(Date.now()/1000);
    const delay = (task.unixTime - currentTime) * 1000;
    if (delay > 0) {
        const timeoutMap = loadTimeout();
        const tID = setTimeout(async () => {
            await unmute(task);
            const schedules = loadSchedules().filter(s => s.id !== task.id);
            await fs.promises.writeFile(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
        }, delay);
        timeoutMap.set(task.userId, tID[Symbol.toPrimitive]('number'));
        await fs.promises.writeFile(TIMEOUT_FILE, JSON.stringify(Object.fromEntries(timeoutMap)));
    } else {
        const schedules = loadSchedules().filter(s => s.id !== task.id);
        await fs.promises.writeFile(SCHEDULE_FILE, JSON.stringify(schedules, null, 2))
        await unmute(task);
    }
}

// ***** 오류 처리 함수 *****
function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:T]/g, '-').split('.')[0];
}

async function logError(error, interaction) {
	const cmdname = interaction.commandName
    let errorMsg = `${error.name}"오류가 발생했습니다! 문제가 지속되면 관리자에게 문의해주세요.`;
    if (error.code) {
        errorMsg += ` 오류 코드: ${error.code}`;
    } 
	console.error(`"${cmdname}" 명령어 실행 중 ${error.name} 오류가 발생했습니다!`);
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMsg, ephemeral: true });
    }
    const timestamp = getTimestamp();
    const logFileName = `logs/error_${scriptName}_${error.code}_${timestamp}.log`;
    const errorLog = `${errorMsg}\n${error.stack || 'No stack trace available'}`;
    fs.promises.writeFile(logFileName, errorLog, 'utf8');
}

async function indexError(error, msg) {
    console.error(`${error.name} occured in ${msg}`);
    const timestamp = getTimestamp();
    const logFileName = `logs/error_${msg}_${timestamp}.log`;
    const errorLog = `${error.stack || 'No stack trace available'}`;
    fs.promises.writeFile(logFileName, errorLog, 'utf8');
}

client.login(token);

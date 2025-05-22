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
const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const config = require(path.join(__dirname, './config.json'));
const token = config.token;
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
    try {
        fs.promises.writeFile(TIMEOUT_FILE, JSON.stringify({}, null, 2), 'utf8');
        const schedules = await loadSchedules();
        for (const task of schedules) {
            await scheduleTask(task);
        }
    } catch (error) {
        indexError(error, "ClientReady");
    }

    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
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

client.on('messageCreate', async (message) => {
    const prefix = '캣!';
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const content = message.content.slice(prefix.length).replace(/\s+/g, '');
    const response = await axios.post('http://localhost:5000/similarity', {
        sentence: content,
    });

    const data = response.data;
    const score = parseFloat(data.score.toFixed(2));
    if (score < 0.6) {
        message.reply({
            content: "뭐라고? 뭐라는건지 잘 모르겠어..",
            allowedMentions: { repliedUser: false }
        });
        return;
    }
    const intentResponses = {
        "인사.인사하기": [
            "왔어? 늦었잖아, 진짜… 뭐, 그래도 반가워.",
            "하이. 딱히 반갑진 않은데… 아니, 그냥 그렇다고.",
            "…안녕. 뭘 그렇게 빤히 봐?"
        ],
        "질문.일반": [
            "몰라, 난 지금 일하느라 바쁘단 말야.",
            "글쎄... 그런건 아직 못 배웠다구."
        ],
        "감사.감사하기": [
            "고맙긴 뭐가 고마워… 어, 뭐, 나도 싫진 않았어.",
            "에이 진짜… 칭찬받으면 기분 좋잖아… 고, 고마워.",
            "그런 말, 가끔은… 나쁘지 않네."
        ],
        "대답.대답하기": [
            "흠, 그래. 인정해줄게.",
            "그, 그 정도는 나도 알아!",
            "맞아. 그건 인정할게… 어쩔 수 없이."
        ],
        "웃음.웃기": [
            "…뭐야 그 웃음은. 그래도 좀 귀엽긴 하네.",
            "큭, 웃기긴 하네. 진짜 바보 같아.",
            "하하… 진짜, 너 웃긴 녀석이야."
        ]
    };

    const responses = intentResponses[data.intent];
    const randomResponse = Array.isArray(responses)
        ? responses[Math.floor(Math.random() * responses.length)]
        : responses;

    message.reply({
        content: randomResponse,
        allowedMentions: { repliedUser: false }
    });
});

// ***** 뒤주/해방 함수 *****
async function loadSchedules() {
    try {
        await fs.promises.access(SCHEDULE_FILE, fs.constants.F_OK)
        const data = await fs.promises.readFile(SCHEDULE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(error);
        return [];
    }
}
async function unmute(task) {
    try {
        const guild = await client.guilds.fetch("1152211578834386984");
        const userID = task.userId;
        const member = await guild.members.fetch(userID);
        await member.roles.remove("1220326194231119974");
        const userNick = member.displayName;
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
    } catch (unmuteError) {
        switch (error.code) {
            case 10007:
                return;
            default:
                indexError(unmuteError, "auto-unmute")
                break;
        }
    }
}

async function scheduleTask(task) {
    const currentTime = Math.floor(Date.now() / 1000);
    const delay = (task.unixTime - currentTime) * 1000;
    if (delay > 0) {
        const timeoutMap = new Map();
        const tID = setTimeout(async () => {
            await unmute(task);
            const schedules = (await loadSchedules()).filter(s => s.id !== task.id);
            await fs.promises.writeFile(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
        }, delay);
        timeoutMap.set(task.userId, tID[Symbol.toPrimitive]('number'));
        await fs.promises.writeFile(TIMEOUT_FILE, JSON.stringify(Object.fromEntries(timeoutMap)));
    } else {
        const schedules = (await loadSchedules()).filter(s => s.id !== task.id);
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

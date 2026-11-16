const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const chalk = require('chalk');
const NodeCache = require('node-cache');
const readline = require('readline');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('⚡ ZENTRIXY XMD IS ONLINE AND RUNNING!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(chalk.green(`🌐 Express server inasikiliza kwenye port ${PORT}`));
});

const {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus
} = require('./main');

const pairingCode = true;
const useMobile = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let reconnectTimer = null;
let isStarting = false;
let currentSocket = null;

async function getPhoneNumberForPairing() {
    // Optiklink au hosting nyingine inaweza kuweka namba kupitia environment variable.
    let phoneNumber = process.env.PHONE_NUMBER || global.phoneNumber;

    if (!phoneNumber && process.stdin.isTTY) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        phoneNumber = await new Promise((resolve) => {
            rl.question(
                'Weka namba ya WhatsApp kwa muundo wa kimataifa, bila + wala nafasi: ',
                resolve
            );
        });

        rl.close();
    }

    if (!phoneNumber) {
        const error = new Error(
            'Session haijasajiliwa na hakuna namba ya pairing. Weka PHONE_NUMBER kwenye environment variables za hosting, au unganisha session kwanza.'
        );
        error.code = 'PAIRING_NUMBER_REQUIRED';
        throw error;
    }

    phoneNumber = String(phoneNumber).replace(/[^0-9]/g, '');

    const phoneNumberValidator = require('awesome-phonenumber');
    if (!phoneNumberValidator('+' + phoneNumber).isValid()) {
        const error = new Error('Namba ya simu si sahihi. Tumia muundo wa kimataifa bila +.');
        error.code = 'INVALID_PHONE_NUMBER';
        throw error;
    }

    return phoneNumber;
}

function scheduleReconnect() {
    if (reconnectTimer) return;

    console.log(chalk.yellow('🔄 Bot itajaribu kuunganisha tena baada ya sekunde 5...'));

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startZentrixyBotInc();
    }, 5000);
}

async function startZentrixyBotInc() {
    if (isStarting) {
        console.log(chalk.yellow('Bot tayari inaanza; ombi jingine la kuanzisha limepuuzwa.'));
        return;
    }

    isStarting = true;

    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const msgRetryCounterCache = new NodeCache();

        let phoneNumber;

        if (pairingCode && !state.creds.registered) {
            if (useMobile) {
                throw new Error('Pairing code haiwezi kutumika pamoja na mobile API.');
            }

            phoneNumber = await getPhoneNumberForPairing();
        }

        const socket = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino({ level: 'fatal' }).child({ level: 'fatal' })
                )
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid);
                const storedMessage =
                    global.store && global.store.loadMessage
                        ? await global.store.loadMessage(jid, key.id)
                        : '';

                return storedMessage?.message || '';
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000
        });

        currentSocket = socket;
        socket.ev.on('creds.update', saveCreds);

        if (global.store) {
            global.store.bind(socket.ev);
        }

        socket.public = true;

        socket.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                await handleMessages(socket, chatUpdate, true);
            } catch (error) {
                console.error('Error in messages.upsert:', error);
            }
        });

        socket.ev.on('group-participants.update', async (update) => {
            try {
                await handleGroupParticipantUpdate(socket, update);
            } catch (error) {
                console.error('Error in group-participants.update:', error);
            }
        });

        socket.ev.on('messages.upsert', async (update) => {
            try {
                const message = update.messages?.[0];

                if (message?.key?.remoteJid === 'status@broadcast') {
                    await handleStatus(socket, update);
                }
            } catch (error) {
                console.error('Error handling WhatsApp status:', error);
            }
        });

        if (phoneNumber) {
            setTimeout(async () => {
                try {
                    const code = await socket.requestPairingCode(phoneNumber);
                    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                    console.log(
                        chalk.black(chalk.bgGreen(' Your Pairing Code: ')),
                        chalk.black(chalk.white(formattedCode))
                    );
                    console.log(
                        chalk.yellow(
                            '\nFungua WhatsApp > Settings > Linked Devices > Link a Device > Link with phone number instead, kisha weka code hiyo.'
                        )
                    );
                } catch (error) {
                    console.error('Imeshindikana kupata pairing code:', error);
                }
            }, 3000);
        }

        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Inaunganisha na WhatsApp...'));
            }

            if (connection === 'open') {
                console.log(chalk.green('✅ Bot imeunganishwa na WhatsApp.'));
                console.log(chalk.yellow(JSON.stringify(socket.user, null, 2)));
            }

            if (connection === 'close') {
                // Puuza close event ya socket ya zamani ikiwa socket mpya tayari imeanza.
                if (currentSocket !== socket) return;

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut =
                    statusCode === DisconnectReason.loggedOut ||
                    statusCode === 401;

                console.log(
                    chalk.red(
                        `Muunganisho wa WhatsApp umefungwa. Status: ${statusCode || 'haijulikani'}`
                    )
                );

                if (isLoggedOut) {
                    console.log(
                        chalk.red(
                            'Session imekataliwa na WhatsApp. Session haijafutwa moja kwa moja; unganisha upya kwa kufuata utaratibu wa pairing.'
                        )
                    );
                    return;
                }

                scheduleReconnect();
            }
        });
    } catch (error) {
        if (
            error.code === 'PAIRING_NUMBER_REQUIRED' ||
            error.code === 'INVALID_PHONE_NUMBER'
        ) {
            console.error(chalk.red(error.message));
            return;
        }

        console.error('Hitilafu wakati wa kuanzisha bot:', error);
        scheduleReconnect();
    } finally {
        isStarting = false;
    }
}

startZentrixyBotInc();

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    process.exit(1);
});
const settings = {
  packname: 'ZENTRIXY XMD',
  author: 'Cyberworrior',
  botName: 'ZENTRIXY XMD',
  botOwner: 'Cyberworrior',
  ownerNumber: '255694187430',
  ownerNumbers: ['255694187430'],
  devNumbers: ['255694187430'],
  commandPrefix: '.',
  newsletterJid: '', // Weka JID ya channel hapa kama unayo, au acha tupu
  telegramHandlersDir: 'handlers',
  premiumDbPath: 'data/premium_users.db',
  channelUrl: 'https://whatsapp.com/channel/0029VbCvc7KAO7RLKAD73C2k',
  youtubeUrl: 'https://www.youtube.com/@Cyberworrior-k9p',
  giphyApiKey: 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: 'public',
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: 'This is an advanced automated WhatsApp bot for managing group commands and downloading media.',
  version: '3.0.7',
  updateZipUrl: 'https://github.com/cyberworrior122/ZENTRIXY-XMD/archive/refs/heads/main.zip',
  pairApiBase: process.env.PAIR_API_BASE || '',
  mongoUri: process.env.MONGO_URI || '',
  mongoDbName: process.env.MONGO_DB_NAME || 'zentrixy_xmd',
  mongoEncryptionKey: process.env.MONGO_ENCRYPTION_KEY || '',
  whatsappGroupUrl: 'https://chat.whatsapp.com/Kk4luXSVwdP1nf7LhQNCHR?s=cl&p=a&iam=2',
};

module.exports = settings;

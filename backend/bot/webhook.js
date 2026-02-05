export default function setupWebhook(bot) {
  const domain = process.env.DOMAIN;
  const webhookPath = `/telegraf/${bot.secretPathComponent()}`;

  bot.telegram.setWebhook(`${domain}${webhookPath}`);
  bot.webhookPath = webhookPath;
}

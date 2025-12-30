   - Production (with PM2):
     ```bash
     npm run build
     npx pm2 start ecosystem.config.js --env production
     ```

   - **Start on Boot (Mac/Linux)**:
     To keep the bot running after you restart your computer:
     ```bash
     npx pm2 startup
     # Run the command promised by the output above
     npx pm2 save
     ```
   
   - **Switching AI Providers**:
     By default, the bot uses `gemini`. To use `g4f` (free, no key required):
     1. Edit `.env` and add: `AI_PROVIDER=g4f`.
     2. Restart: `npx pm2 restart fr-bot`.

## Debugging / Logs
To check the logs (see errors, chat history):
```bash
npx pm2 logs fr-bot
```
Add `--lines 50` to see more history, or `--nostream` to just print and exit.

## Commands

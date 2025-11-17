import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function commandHandler(client) {
    const commandsPath = join(__dirname, '../commands');
    const commandFolders = await readdir(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = join(commandsPath, folder);
        const commandFiles = await readdir(folderPath);

        for (const file of commandFiles) {
            if (!file.endsWith('.js')) continue;

            const filePath = join(folderPath, file);
            const command = await import(`file://${filePath}`);

            if (command.default && command.default.name) {
                client.commands.set(command.default.name, command.default);
                console.log(`Loaded command: ${command.default.name}`);
            }
        }
    }
}

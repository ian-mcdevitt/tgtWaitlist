var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
var client = new Discord.Client();

client.once('ready', () => {
    console.log('Client is ready!');
});

client.login(auth.token);

const signupSplit = '\n=== Sign-up List ===';
const waitlistSplit = '\n=== Wait List ===';

client.on('message', async triggerMessage => {
    if (triggerMessage.content.startsWith('!job ')) {
        var post = `<@&814324717485293611>, there's a new job for you!\n${triggerMessage.content.slice(5)}`;

        triggerMessage.channel.send(post).then(async jobMessage => {
            await jobMessage.react('✅');
            await triggerMessage.delete();
        });
    }
});

const createUserList = (users) => {
    let count = 0;
    return users.map((user, index) => {
        // This is the bot's own ID
        if (user.id === '826446490346979349') {
            return ''
        } else {
            let waitlist = '';
            if (count === 5) {
                waitlist = waitlistSplit;
            }
            return `${waitlist}\n${++count}.) ${user.toString()}`;
        }
    }).join('');
}

client.on('messageReactionAdd', async reaction => {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }

    if (reaction.emoji.name === '✅') {
        console.info('Adding a user to the list!');
        // Add the user to the list
        const originalText = reaction.message.content.split(signupSplit)[0];
        const userList = createUserList(reaction.users.cache);
        await reaction.message.edit(originalText + (userList.length ? signupSplit : '') + userList);
    } else {
        await reaction.remove();
    }
})

client.on('messageReactionRemove', async reaction => {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }

    if (reaction.emoji.name === '✅') {
        console.info('Removing a user from the list!');
        const originalText = reaction.message.content.split(signupSplit)[0];
        const userList = createUserList(reaction.users.cache);
        await reaction.message.edit(originalText + (userList.length ? signupSplit : '') + userList);
    }
});

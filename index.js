var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
var config = require('./config.json');
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

client.on('message', async triggerMessage => {
    if (triggerMessage.content.startsWith('!job')) {
        // Check for a blacklist (to copy into our new post)
        const blacklistIndex = triggerMessage.content.indexOf('--blacklist ');
        const blacklist = blacklistIndex !== -1 ? `${config.blacklistHeader}${triggerMessage.content.substring(blacklistIndex + 12)}\n` : '';

        var post = `${blacklist}${config.introString}`;

        triggerMessage.channel.send(post).then(async jobMessage => {
            await jobMessage.react(config.signupEmoji);
            await jobMessage.react(config.waitlistEmoji);
            await jobMessage.react(config.notInterestedEmoji);
            await triggerMessage.delete();
        });
    }
});

const fetchReaction = async (reaction) => {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }
}

const renderLists = (reactions) => {
    let signupReactions = [];
    let waitlistReactions = [];
    // .map the collections to turn them into arrays (easier to work with)
    // .slice(1) both arrays to remove the bot's reactions
    reactions.map((reaction, index) => {
        if (index === config.signupEmoji) {
            signupReactions = reaction.users.cache.map(user => user).slice(1);
        } else if (index === config.waitlistEmoji) {
            waitlistReactions = reaction.users.cache.map(user => user).slice(1);
        }
    })

    // Move anyone over the {config.listLength}th player into the waitlist (before people who deliberately waitlisted themselves)
    if (signupReactions.length > config.listLength) {
        waitlistReactions = [...signupReactions.slice(config.listLength), ...waitlistReactions];
        signupReactions = signupReactions.slice(0, config.listLength);
    }

    // Create the list string
    let lists = '';
    if (signupReactions.length > 0) {
        lists += config.signupSplit + listUsers(signupReactions);
    }
    if (waitlistReactions.length > 0) {
        lists += config.waitlistSplit + listUsers(waitlistReactions);
    }
    return lists;
}

const listUsers = (users) => {
    return users.map((user, index) => {
        return `\n${index + 1}.) ${user.toString()}`;
    }).join('');
}

client.on('messageReactionAdd', async reaction => {
    let botMessage = reaction.message.content;

    await fetchReaction(reaction);

    if (![config.signupEmoji, config.waitlistEmoji, config.notInterestedEmoji].includes(reaction.emoji.id || reaction.emoji.name)) {
        return reaction.remove();
    }

    // Delete reactions from this channel that are on any post other than this bot's
    if (reaction.message.author.id !== config.botUserId) {
        return reaction.remove();
    }

    // Fetch the blacklist from our own message
    let blacklist = [];
    if (botMessage.indexOf(config.blacklistHeader) === 0) {
        blacklist = botMessage.substring(config.blacklistHeader.length, botMessage.indexOf('\n')).split(' ').map((user) => {
            return user.trim().slice(3, -1);
        })
    }

    // The blacklist period has not yet expired
    if (+(new Date()) - reaction.message.createdTimestamp < config.blacklistDuration) {
        reaction.users.cache.map(async (user, id) => {
            if (blacklist.includes(user.id)) {
                await reaction.users.remove(user.id);
            }
        })
    // The blacklist has expired! Remove it from the message if it's still there
    } else if (botMessage.indexOf(config.blacklistHeader) !== -1) {
        botMessage = botMessage.substring(botMessage.indexOf('\n'));
    }

    // Cut out the lists
    botMessage = botMessage.split(config.signupSplit)[0].split(config.waitlistSplit)[0];

    await reaction.message.edit(botMessage + renderLists(reaction.message.reactions.cache));
})

client.on('messageReactionRemove', async reaction => {
    let botMessage = reaction.message.content;

    await fetchReaction(reaction);

    // Cut out the lists
    botMessage = botMessage.split(config.signupSplit)[0].split(config.waitlistSplit)[0];

    await reaction.message.edit(botMessage + renderLists(reaction.message.reactions.cache));
});

/**
 * @name FreeStickers
 * @version 2.1.0
 * @author bottom_text | Z-Team 
 * @description Makes available to send stickers (not animated) and any emojis everywhere like with nitro.
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/FreeStickers
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/FreeStickers/FreeStickers.plugin.js
*/



module.exports = class FreeStickers {
    constructor(meta) {
        for (let key in meta) {
            this[key] = meta[key];
        }
    }

    start() {
        console.log(`${this.name}: started!`);

        this.findWebpacks();

        // Patch emojies 



        // hook to allow adding emoji
        BdApi.Patcher.after(this.name, this.emojiWebpack, 'getEmojiUnavailableReason', (_, [{ emoji, channel, intention, canViewAndUsePackEmoji, hook }], ret) => {
            // `hook` means that we call it by ourselves
            if (!hook && intention == this.emojiInfoWebpack.EmojiIntention.REACTION) {
                return ret;
            }
            return hook ? ret : null;
        });

        // hook to make all emojies non-disable in emoji picker menu
        BdApi.Patcher.after(this.name, this.emojiWebpack, 'isEmojiDisabled', (_, [{ emoji, channel, intention, canViewAndUsePackEmoji }], ret) => {
            if (intention == this.emojiInfoWebpack.EmojiIntention.REACTION) {
                return ret;
            }
            return false;
        });


        // Patch stickers

        // hook to allow send stickers
        BdApi.Patcher.instead(this.name, this.stickerSendabilityWebpack, 'isSendableSticker', (_, [sticker, user, channel, hook], original) => {
            // `hook` means that we call it by ourselves
            return hook ? original(sticker, user, channel) : true;
        });

        // change message object and replace emoji/sticker objects with its URL
        BdApi.Patcher.instead(this.name, this.enqueWebpack, 'enqueue', (_, args, original) => {
            const message = args[0].message;

            /* stickers */
            if (message.sticker_ids && !this.isStickerAvailable(message.sticker_ids[0], message.channelId)) {
                message.content = `https://media.discordapp.net/stickers/${message.sticker_ids[0]}.webp?size=160`; // insert sticker url in the message
                delete message.sticker_ids;
            }

            /* emojies */
            const regExp = /<a?:\w+:(\d+)>/g; // guild emoji 
            let match;
            while (match = regExp.exec(message.content)) {
                const emojiId = match[1];
                const customEmoji = this.customEmojiUtilitiesWebpack.getCustomEmojiById(emojiId);
                if (customEmoji && !this.isCustomEmojiAvailable(customEmoji, message.channelId)) {
                    const emojiSize = 48;
                    const emojiUrl = customEmoji.url.replace(/size=(\d+)/, `size=${emojiSize}`); // set the size
                    message.content = message.content.replace(match[0], emojiUrl); // replace emoji code with url
                }
            }

            original(...args);
        });

    }

    isStickerAvailable(stickerId, channelId) {
        const currentUser = this.userStoreWebpack.getCurrentUser();
        const channel = this.channelStoreWebpack.getChannel(channelId);
        const sticker = this.stickerWebpack.getStickerById(stickerId);
        return this.stickerSendabilityWebpack.isSendableSticker(sticker, currentUser, channel, true);

    }

    isCustomEmojiAvailable(customEmoji, channelId) {
        return this.getEmojiUnavailableReason(customEmoji.id, channelId) == null;
    }

    getEmojiUnavailableReason(emojiId, channelId) {
        return this.emojiWebpack.getEmojiUnavailableReason({
            emoji: this.customEmojiUtilitiesWebpack.getCustomEmojiById(emojiId),
            channel: this.channelStoreWebpack.getChannel(channelId),
            intention: this.emojiInfoWebpack.EmojiIntention.CHAT,
            canViewAndUsePackEmoji: this.inventoryGuildPackExperimentWebpack.getInventoryGuildPacksUserExperimentConfig({ user: this.userStoreWebpack.getCurrentUser(), autoTrackExposure: 0 }).viewAndUseEnabled,
            hook: true
        }); // returns value from this.emojiInfoWebpack.EmojiDisabledReasons
    } 

    findWebpacks() {
        this.userStoreWebpack = BdApi.Webpack.getStore('UserStore');
        this.enqueWebpack = BdApi.Webpack.getByKeys('enqueue', 'draining');
        this.emojiWebpack = BdApi.Webpack.getByKeys('getEmojiUnavailableReason');
        this.channelStoreWebpack = BdApi.Webpack.getStore('ChannelStore');
        this.customEmojiUtilitiesWebpack = BdApi.Webpack.getByKeys('getCustomEmojiById');
        this.stickerWebpack = BdApi.Webpack.getByKeys('getStickerById');
        this.stickerSendabilityWebpack = BdApi.Webpack.getByKeys('isSendableSticker', 'getStickerSendability');
        this.emojiInfoWebpack = BdApi.Webpack.getByKeys('EmojiIntention');
        this.inventoryGuildPackExperimentWebpack = BdApi.Webpack.getByKeys('getInventoryGuildPacksUserExperimentConfig');
    }

    stop() {
        console.log(`${this.name}: stopped!`);
        BdApi.Patcher.unpatchAll(this.name);
    }
}

/**
 * @name FreeStickers
 * @version 2.0.8
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

        // hook emoji query
        BdApi.Patcher.after(this.name, this.fetchEmojiesWebpack, 'searchWithoutFetchingLatest', (_, args, ret) => {
            ret.unlocked.push(...ret.locked);
            ret.locked = [];

        });

        // hook to allow adding emoji
        BdApi.Patcher.after(this.name, this.emojiWebpack, 'getEmojiUnavailableReason', (_, [emojiId, channelId, intention, hook], ret) => {
            return hook ? null : ret;
        });

        // hook to make all emojies non-disable in emoji picker menu
        BdApi.Patcher.after(this.name, this.emojiWebpack, 'isEmojiDisabled', (_, args, ret) => {
            return false;
        });


        // Patch stickers

        // hook to allow send stickers
        BdApi.Patcher.instead(this.name, this.stickerSendabilityWebpack, 'isSendableSticker', (_, [sticker, user, channel, hook], original) => {
            
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
                const customEmoji = this.customEmojiUtilities.getCustomEmojiById(emojiId);
                if (customEmoji && !this.isCustomEmojiAvailable(customEmoji, message.channelId)) {
                    const emojiSize = 48;
                    const emojiUrl = customEmoji.url.replace(/size=(\d+)/, `size=${emojiSize}`); // set the size
                    message.content = message.content.replace(match[0], emojiUrl); // replace emoji code with url
                }
            }

            original(...args);
        });

        // Patching permissions is not working anymore

        /* 
        BdApi.Patcher.after(this.name, this.permissionsWebpack, 'canUseStickersEverywhere', (_, args, ret) => {
            return true;
        });

        BdApi.Patcher.after(this.name, this.permissionsWebpack, 'canUseEmojisEverywhere', (_, args, ret) => {
            return true;
        });

        BdApi.Patcher.after(this.name, this.permissionsWebpack, 'canUseAnimatedEmojis', (_, args, ret) => {
            return true;
        }); 
        */

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

    getEmojiUnavailableReason(emojiId, channelId, intention){
         return this.emojiWebpack.getEmojiUnavailableReason({
             emoji: this.customEmojiUtilities.getCustomEmojiById(emojiId),
             channel: this.channelStoreWebpack.getChannel(channelId),
             intention: 3 // magic number
         });
         // return value == 2 - emoji blocked | value == null - available. (!) don't work with canUseStickersEverywhere() hook (!)
    } 

    findWebpacks() {
        this.userStoreWebpack = BdApi.Webpack.getStore('UserStore');
        this.fetchEmojiesWebpack = BdApi.Webpack.getByKeys('searchWithoutFetchingLatest');
        this.enqueWebpack = BdApi.Webpack.getByKeys('enqueue', 'draining');
        this.emojiWebpack = BdApi.Webpack.getByKeys('getEmojiUnavailableReason');
        this.channelStoreWebpack = BdApi.Webpack.getStore('ChannelStore');
        this.customEmojiUtilities = BdApi.Webpack.getByKeys('getCustomEmojiById');
        this.stickerWebpack = BdApi.Webpack.getByKeys('getStickerById');
        this.stickerSendabilityWebpack = BdApi.Webpack.getByKeys('isSendableSticker', 'getStickerSendability');
    }

    stop() {
        console.log(`${this.name}: stopped!`);
        BdApi.Patcher.unpatchAll(this.name);
    }
}

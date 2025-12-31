/**
 * @name FreeStickers
 * @version 2.1.3
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

        // removes lock from guild icons in emoji picker menu
        const [EmojiPickerGuildLocks, key] = BdApi.Webpack.getWithKey(BdApi.Webpack.Filters.byStrings('.activeCategoryIndex)', '.scrollToSectionTop('));
        BdApi.Patcher.before(this.name, EmojiPickerGuildLocks, key, (_, [props]) => {
            props.categories.forEach(category => {
                if (category.type == 'GUILD') {
                    category.isNitroLocked = false;
                }
            })
        }
        );

        // removes nitro upsell in emoji picker menu
        const [EmojiPickerNitroUpsell, key1] = BdApi.Webpack.getWithKey(BdApi.Webpack.Filters.byStrings('sectionDescriptors', 'PREMIUM_UPSELL_VIEWED'));
        BdApi.Patcher.before(this.name, EmojiPickerNitroUpsell, key1, (_, [props]) => {
            props.sectionDescriptors.forEach(category => {
                if (category.type == 'GUILD') {
                    category.isNitroLocked = false;
                }
            });
        }
        );

        // hook to allow adding emoji
        BdApi.Patcher.after(this.name, this.emojiWebpack, 'getEmojiUnavailableReason', (_, [{ emoji, channel, intention, canViewAndUsePackEmoji, hook }], ret) => {
            // `hook` means that we call it by ourselves
            if (!hook && intention == 'REACTION') {
                return ret;
            }
            return hook ? ret : null;
        });

        // hook to make all emojies non-disable in emoji picker menu
        BdApi.Patcher.after(this.name, this.emojiWebpack, 'isEmojiDisabled', (_, [{ emoji, channel, intention, canViewAndUsePackEmoji }], ret) => {
            if (intention == 'REACTION') {
                return ret;
            }
            return false;
        });

        // hook to allow send stickers
        BdApi.Patcher.instead(this.name, this.stickerSendabilityWebpack, 'kl', (_, [sticker, user, channel, hook], original) => {
            // `hook` means that we call it by ourselves
            return hook ? original(sticker, user, channel) : true;
        });
      
        // change message object and replace emoji/sticker objects with its URL
        BdApi.Patcher.instead(this.name, this.enqueWebpack, 'enqueue', (_, args, original) => {
            const message = args[0].message;

            // stickers
            if (message.sticker_ids && !this.isStickerAvailable(message.sticker_ids[0], message.channelId)) {
                message.content = `https://media.discordapp.net/stickers/${message.sticker_ids[0]}.webp?size=160`; // insert sticker url in the message
                delete message.sticker_ids;
            }

            // emojis
            const regExp = /<a?:\w+:(\d+)>/g; // guild emoji 
            let match;
            while (match = regExp.exec(message.content)) {
                const emojiId = match[1];
                const customEmoji = this.customEmojiUtilitiesWebpack.getCustomEmojiById(emojiId);
                if (customEmoji && !this.isCustomEmojiAvailable(customEmoji, message.channelId)) {
                    const emojiSize = 48;
                    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.webp?size=${emojiSize}&quality=lossless`;
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
        return this.stickerSendabilityWebpack.kl(sticker, currentUser, channel, true);

    }

    isCustomEmojiAvailable(customEmoji, channelId) {
        return this.getEmojiUnavailableReason(customEmoji.id, channelId) == null;
    }

    getEmojiUnavailableReason(emojiId, channelId) {
        return this.emojiWebpack.getEmojiUnavailableReason({
            emoji: this.customEmojiUtilitiesWebpack.getCustomEmojiById(emojiId),
            channel: this.channelStoreWebpack.getChannel(channelId),
            intention: 'CHAT',
            hook: true
        });
    }

    findWebpacks() {
        this.userStoreWebpack = BdApi.Webpack.getStore('UserStore');
        this.enqueWebpack = BdApi.Webpack.getByKeys('enqueue', 'maxSize');
        this.emojiWebpack = BdApi.Webpack.getByKeys('getEmojiUnavailableReason');
        this.channelStoreWebpack = BdApi.Webpack.getStore('ChannelStore');
        this.customEmojiUtilitiesWebpack = BdApi.Webpack.getByKeys('getCustomEmojiById');
        this.stickerWebpack = BdApi.Webpack.getByKeys('getStickerById');
        // const [StickerSendability, getStickerSendability] = BdApi.Webpack.getWithKey(BdApi.Webpack.Filters.byStrings('canUseCustomStickersEverywhere', 'USE_EXTERNAL_STICKERS'))
        this.stickerSendabilityWebpack = BdApi.Webpack.getByKeys('kl', 'cO'); // kl = isSendableSticker, cO = getStickerSendability
    }

    stop() {
        console.log(`${this.name}: stopped!`);
        BdApi.Patcher.unpatchAll(this.name);
    }
}

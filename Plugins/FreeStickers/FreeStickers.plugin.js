/**
 * @name FreeStickers
 * @version 2.0.3
 * @author bottom_text | Z-Team 
 * @description Makes available to send stickers (not animated) and any emojis everywhere like with nitro.
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/FreeStickers
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/FreeStickers/FreeStickers.plugin.js
*/


module.exports = class FreeStickers {
    getName() {
        return 'FreeStickers'
    }
    getVersion() {
        return '2.0.3'
    }
    getAuthor() {
        return 'bottom_text | Z-Team';
    }
    getDescription() {
        return 'Makes available to send stickers (not animated) and any emojis everywhere like with nitro.'
    }
    start() {
        console.log(`${this.getName()}: started!`);

        this.findWebpacks();

        BdApi.Patcher.after(this.getName(), this.permissionsWebpack, 'canUseStickersEverywhere', (_, args, ret) => {
            return true;
        });

        BdApi.Patcher.after(this.getName(), this.permissionsWebpack, 'canUseEmojisEverywhere', (_, args, ret) => {
            return true;
        });

        BdApi.Patcher.after(this.getName(), this.permissionsWebpack, 'canUseAnimatedEmojis', (_, args, ret) => {
            return true;
        });

        /*

        isEmojiDisabled - maybe for future update

        BdApi.Patcher.after(this.emojiWebpack, 'getEmojiUnavailableReason', (_, args, ret) => {  
           // we broke this with canUseStickerEverywhere hook 
            return ret;
        })
        */
       
        BdApi.Patcher.instead(this.getName(), this.enqueWebpack, 'enqueue', (_, args, original) => {
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
                const customEmoji = this.getCustomEmojiById(emojiId);           
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
        //  not the best method, still works
        return this.stickerWebpack.getStickerById(stickerId).guild_id == this.getChannel(channelId).guild_id
    }
    isCustomEmojiAvailable(customEmoji, channelId) {
        // just check if we send guild emoji in the guild with this emoji; not the best method, still works
        return customEmoji.guildId == this.getChannel(channelId).guild_id;
    }
    /*  getEmojiUnavailableReason(emojiId, channelId, intention){
         return this.emojiWebpack.getEmojiUnavailableReason({
             emoji: this.getCustomEmojiById(emojiId),
             channel: this.getChannel(channelId),
             intention: 3 // magic number
         });
         // return value == 2 - emoji blocked | null - avalaible. (!) don't work with canUseStickersEverywhere() hook (!)
     } */
    getChannel(channelId) {
        return this.channelStoreWebpack.getChannel(channelId);
    }
    getCustomEmojiById(emojiId) {
        return this.customEmojieUtilities.getCustomEmojiById(emojiId);
    }
    findWebpacks() {
        this.permissionsWebpack = BdApi.findModuleByProps('canUseStickersEverywhere');
        this.enqueWebpack = BdApi.findModuleByProps('enqueue');
        //this.emojiWebpack = BdApi.findModuleByProps('getEmojiUnavailableReason');
        this.channelStoreWebpack = BdApi.findModuleByProps('getChannel');
        this.customEmojieUtilities = BdApi.findModuleByProps('getCustomEmojiById');
        this.stickerWebpack = BdApi.findModuleByProps('getStickerById');
    }
    stop() {
        console.log(`${this.getName()}: stopped!`);
        BdApi.Patcher.unpatchAll(this.getName());
    }
}

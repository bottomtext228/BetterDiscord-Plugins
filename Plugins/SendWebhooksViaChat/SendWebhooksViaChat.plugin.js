/**
 * @name SendWebhooksViaChat
 * @version 2.0.0
 * @description Sends webhook messages via Discord chat.
 * @author bottom_text | Z-Team
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/SendWebhooksViaChat
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/SendWebhooksViaChat/SendWebhooksViaChat.plugin.js
*/



module.exports = class SendWebhooksViaChat {
    constructor(meta) {
        for (let key in meta) {
            this[key] = meta[key];
        }
    }


    start() {

        this.findWebpacks();
    
        this.loadSettings();

    
        // get webhooks data
        this.settings.webhooks.forEach(async webhook => {
            if (!webhook.url) {
                return;
            } 
            const data = await this.fetchWebhookData(webhook.url);
            
            if (!data) { 
                BdApi.showToast('Error while getting webhook data!', {type: 'danger'});
                return;
            }

            if (data.code == 50027) { // if no webhook found
                // delete webhook 
                this.deleteWebhook(webhook);         
                BdApi.showToast('Webhook was not found! It will be deleted.', {type: 'warning'});
                return;
            }

            webhook.default_username = data.name;
            webhook.default_avatar_url = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.webp?size=128` : this.avatarUtils.getDefaultAvatarURL();
            
        });


        // patch message actions
        BdApi.Patcher.instead(
            this.name,
            this.messageUtils,
            'sendMessage',
            (_, args, original) => {
                const message = args[1].content;
                const match = message.match(/\/([^ ]+)[ ]+(.+)+/is); // `/command message`
                if (match) {
                    const command = match[1];
                    const webhook = this.settings.webhooks.find(e => e.command && e.command == command); // find webhook by command
                    if (webhook) {
                        const messageToSend = match[2];
                        const content = this.prepareMessageToSend(messageToSend);
                        this.makeRequest(webhook.url, {
                            content: content,
                            username: webhook.username,
                            avatar_url: webhook.avatar_url
                        }).then(response => {                     
                            if (response.status == 204) {
                                BdApi.showToast('Webhook message succefully sended!', {type: 'success', timeout: 1000});
                            } else {                              
                                BdApi.showToast(`Error during webhook request!\n${response.body}`, {type: 'error', timeout: 5000});                            
                            }
                        });
                        return; // prevent sending the message
                    }
                }
                original(...args);
            }

        );

  
        
        // TODO: send files, pictures, etc?

        /* 

        BdApi.Patcher.after(
            this.name,
            BdApi.findModuleByProps('uploadFiles'),
            'uploadFiles',
            (_, args, ret) => {
                console.log(_, args, ret);
                return ret;
            }
        );

        */



    }

    prepareMessageToSend(string) {
        // webhooks can't send unicode emoji, so we replace them with text (🐖 -> :pig2:)
        string = this.replaceEmojies(string);
        // ... more?
        return string;
    }

    replaceEmojies(string) {
        const regExp = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g; // unicode emoji
        const match = string.match(regExp);
        if (match) {
            for (const emoji of match) {
                const emojiName = this.emojiUtils.convertSurrogateToName(emoji);
                if (emojiName != '::') { // if surrogate is invalid, just in check
                    string = string.replace(emoji, emojiName);
                }
            }
        }
        return string;
    }

    makeRequest(url, content) {
        /* We cannot make a post request to the webhook url when `origin` header is https://discord.com. 
        * It will be rejected with Bad request (400) code.
        * Any of this methods (fetch(), require('https'), require('request'), XMLHttpRequest) automatically fills origin header,           
        * so we can't use it
        * The method below seems to be the only one way to do request without origin headers
        */

        // we are sending an array of `chunks`, so we split the string into symbols
        return new Promise((resolve) => // Returns promise with a response 
            window.DiscordNative.http.makeChunkedRequest(url, JSON.stringify(content).split(''), {
                method: 'POST',
                contentType: 'application/json',
                token: '',
                chunkInterval: 0
            }, (e, response) => resolve(response) // e is always null
            )
        );
    }

    getSettingsPanel() {
        // simple menu (kill me)
 
        const html = this.parseHTML('<div></div>');

        const webhooksList = this.parseHTML(`<div id="webhooks_list"></div>`);


        html.appendChild(this.createButton('Add new', () => {

            this.settings.webhooks.push({ url: '', command: '', avatar_url: '', username: '', default_avatar_url: this.avatarUtils.getDefaultAvatarURL(), default_username: 'None'});
            const webhook = this.settings.webhooks[this.settings.webhooks.length - 1];
            const webhookElement = this.renderWebhook(webhook);
            webhooksList.appendChild(webhookElement);


        }));
        this.settings.webhooks.forEach((webhook, index) => {
            const webhookElement = this.renderWebhook(webhook);
            webhooksList.appendChild(webhookElement);
        });

        html.appendChild(webhooksList);
        return html;
    }

    renderWebhook(webhook) {

        const popoutHTML =
            `<div>	
            <div>
                <div style="display: flex; justify-content: left; margin-top: 10px; margin-bottom: 10px;">
                    <img style="height: 32px; width: 32px; border-radius: 50%;" src="${webhook.avatar_url ? webhook.avatar_url : webhook.default_avatar_url}" id="webhook_avatar_url">			
                    <div style="margin-left: 10px; margin-top: 10px">
                        <span style="color: white" aria-expanded="false" role="button" tabindex="0" id="webhook_username">
                            ${webhook.username ? webhook.username : webhook.default_username}
                        </span>     
                        <span style="color: grey" id="webhook_command">
                            ${webhook.command ? `/${webhook.command}` : ''}
                        </span>              
                    </div>
                </div>
            </div>
        </div>`;

        const webhookElement = this.parseHTML(popoutHTML);

        // handle settings
        webhookElement.addEventListener('click', (e) => {


            const settingsHtml = this.parseHTML('<div style="gap: 10px; display: grid"></div>');


            const createLabel = (label) => {
                return this.parseHTML(`<h1 style="color:#dddddd">${label}: </h1>`);
            }
            settingsHtml.appendChild(createLabel('Webhook URL'));
            settingsHtml.appendChild(this.createInput('Webhook URL', 'input_webhook_url', webhook.url));
            settingsHtml.appendChild(createLabel('Command'));
            settingsHtml.appendChild(this.createInput('Command', 'input_webhook_command', webhook.command));
            settingsHtml.appendChild(createLabel('Username'));
            settingsHtml.appendChild(this.createInput('Username', 'input_webhook_username', webhook.username));
            settingsHtml.appendChild(createLabel('Avatar URL'));
            settingsHtml.appendChild(this.createInput('Avatar URL', 'input_webhook_avatar_url', webhook.avatar_url));



            BdApi.showConfirmationModal('Webhook settings', this.wrapElement(settingsHtml), {
                confirmText: 'Save',
                cancelText: 'Delete',
                onConfirm: async () => {
                    const newWebhook = {
                        url: document.getElementById('input_webhook_url').value.trim(),
                        command: document.getElementById('input_webhook_command').value.trim(),
                        username: document.getElementById('input_webhook_username').value.trim(),
                        avatar_url: document.getElementById('input_webhook_avatar_url').value.trim(),
                    }; // get inputs values


                    const data = await this.fetchWebhookData(newWebhook.url);

                    if (data && !data.code) {

                        Object.assign(webhook, newWebhook);

                        webhook.default_username = data.name;
                        webhook.default_avatar_url = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.webp?size=128` : this.avatarUtils.getDefaultAvatarURL();
                        const elements = Array.from(webhookElement.querySelectorAll('span, img'));

                        elements.find(e => e.id == 'webhook_username').innerText = webhook.username ? webhook.username : webhook.default_username;                        
                        elements.find(e => e.id == 'webhook_command').innerText = webhook.command ? '/' + webhook.command : '';                                                        
                        elements.find(e => e.id == 'webhook_avatar_url').src = webhook.avatar_url ? webhook.avatar_url : webhook.default_avatar_url;
                        BdApi.showToast('Webhook saved!', { type: 'success' });
                        this.saveSettings();

                    } else {
                        BdApi.showToast('Invalid URL or Webhook with this URL is not existed!', { type: "danger" });
                    }


                },
                onCancel: () => {
                    webhookElement.innerHTML = ''; // visually delete it
                    this.deleteWebhook(webhook);               
                }
            });
        })

        return webhookElement;
    }

    async fetchWebhookData(url) {
        /* GET request on webhook url returns webhook data (name, avatar, channelId, etc) */
        if (url.match(/https{0,1}:\/\/discord\.com\/api\/webhooks\/\d+\/.+/i)) {
            try {
                const data = JSON.parse(await (await fetch(url)).text());
                return data;
            } catch (error) {
                console.error(`Webhook fetch error: ${error}`); // just for sure
            }
        }
    }

    deleteWebhook(webhook) {
        this.settings.webhooks.splice(this.settings.webhooks.indexOf(webhook), 1);
        this.saveSettings();
    }

    saveSettings() {
        BdApi.saveData(this.name, 'settings', this.settings);
    }

    loadSettings() {
        // note: settings cached by BdApi, so if you want to manipulate settings
        // by editing the config in manual you should restart discord
        try {
            this.settings = BdApi.loadData(this.name, 'settings'); 
            if (!this.settings || !Array.isArray(this.settings.webhooks)) { // load defaults
                this.settings = { webhooks: [] };
                this.saveSettings();
            };   
        } catch (error) {
            require('fs').writeFileSync(require('path').join(BdApi.Plugins.folder, `${this.name}.config.json`), 
            JSON.stringify({settings: {webhooks: []}})); // BdApi.save/loadData can't work with empty files
            this.settings = { webhooks: [] };
            this.saveSettings();        
        }   
    }

    wrapElement(element) {
        const wrap = (elements) => {
            const domWrapper = this.parseHTML(`<div class="dom-wrapper"></div>`);
            for (let e = 0; e < elements.length; e++) domWrapper.appendChild(elements[e]);
            return domWrapper;
        }
        if (Array.isArray(element)) element = wrap(element);
        return BdApi.React.createElement(BdApi.ReactUtils.wrapElement(element));
    }

    parseHTML(html) {
        var template = document.createElement('template');
        html = html.trim();
        template.innerHTML = html;
        return template.content.firstChild;
    }

    createButton(label, callback, id) {
        const ret = this.parseHTML(`<button type="button" class="${this.buttonConstansts.button} ${this.buttonConstansts.lookFilled} ${this.buttonConstansts.colorBrand} ${this.buttonConstansts.sizeSmall} ${this.buttonConstansts.grow}" ${(id ? 'id="' + id + '"' : '')}><div class="contents-3ca1mk">${label}</div></button>`);
        if (callback) {
            ret.addEventListener('click', callback);
        }
        return ret;
    }

    createInput(label, id, defaultValue, callback) {
        const ret = this.parseHTML(
            `<div class="${this.inputConstants.container} ${this.inputConstants.medium}">
				<div class="${this.inputConstants.inner}">
					<input type="text" class="${this.inputConstants.input}" name="message" placeholder="${label}" id="${id}" value="${defaultValue}"/>
				</div>
			</div>`
        );
        if (callback) {
            ret.addEventListener('input', callback);
        }
        return ret;
    }

    findWebpacks() {
        this.messageUtils = BdApi.findModuleByProps('sendMessage');
        this.buttonConstansts = BdApi.findModuleByProps('lookBlank');
        this.inputConstants = BdApi.findModuleByProps('input', 'icon', 'close', 'pointer');
        this.emojiUtils = BdApi.findModuleByProps('getByName');
        this.avatarUtils = BdApi.findModuleByProps('getDefaultAvatarURL');
    }

    stop() {
        BdApi.Patcher.unpatchAll(this.name)
    }

}
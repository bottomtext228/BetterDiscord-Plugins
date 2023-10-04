/**
 * @name SendWebhooksViaChat
 * @version 2.1.0
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
                BdApi.showToast('Error while getting webhook data!', { type: 'danger' });
                return;
            }

            if (data.code == 50027) { // if no webhook found
                // delete webhook 
                this.deleteWebhook(webhook);
                BdApi.showToast('Webhook was not found! It will be deleted.', { type: 'warning' });
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
                const parsingResult = this.parseMessageForWebhook(message);
                if (parsingResult) {
                    const { webhook, messageToSend } = parsingResult;

                    this.makeWebhookRequest(webhook.url, {
                        body: JSON.stringify({
                            content: messageToSend,
                            username: webhook.username ? webhook.username : undefined,
                            avatar_url: webhook.avatar_url
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        method: 'POST'
                    });

                    return; // prevent sending the message
                }

                original(...args);

            }
        );


        BdApi.Patcher.instead(
            this.name,
            BdApi.Webpack.getByKeys('uploadFiles'),
            'uploadFiles',
            async (_, args, original) => {

                const message = args[0].parsedMessage.content;
                const parsingResult = this.parseMessageForWebhook(message);

                if (parsingResult) {

                    const { webhook, messageToSend } = parsingResult;

                    // this hand-maded multipart/form-data request just works, ok? 
                    const formBoundary = this.generateFormBoundary();

                    const uploads = args[0].uploads;

                    const encoder = new TextEncoder();

                    let requestString =
                        `--${formBoundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify({ content: messageToSend })}`

                    let data = encoder.encode(requestString);


                    for (let uploadIterator in uploads) { // add all files to the request

                        const upload = uploads[uploadIterator];

                        const file = upload.item.file;

                        let fileArray = new Uint8Array(await file.arrayBuffer());


                        let fileDisposition = encoder.encode(
                            `Content-Disposition: form-data; name="file[${uploadIterator}]"; filename="${upload.spoiler ? `SPOILER_` : ''}${upload.filename}"\r\nContent-Type: ${upload.mimeType}\r\n\r\n`);

                        data = this.concatTypedArrays(data, encoder.encode(`\r\n--${formBoundary}\r\n`), fileDisposition, fileArray);
                    }

                    data = this.concatTypedArrays(data, encoder.encode(`\r\n--${formBoundary}--`));

                    this.makeWebhookRequest(webhook.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': `multipart/form-data; boundary=${formBoundary}`
                        },
                        timeout: 60e3,
                        body: data
                    });

                } else {

                    return original(...args);
                }

            }
        );


    }


    makeId(length) { // returns a string with random characters from the list
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
            counter += 1;
        }
        return result;
    }

    generateFormBoundary() {
        return `----WebKitFormBoundary${this.makeId(16)}`;
    }

    concatTypedArrays(...arrays) { // all arrays are TypedArray of same type
        const length = arrays.reduce((accum, array) => accum + array.length, 0);
        var resultArray = new (arrays[0].constructor)(length);

        let currentLength = 0;
        for (const array of arrays) {
            resultArray.set(array, currentLength);
            currentLength += array.length;
        }
        return resultArray;
    }

    parseMessageForWebhook(message) {
        // extract command and messsage to send from the message content 
        const match = message.match(/^\/([^ ]+)[ ]+(.+)+|^\/([^ ]+)/is); // `/command message` or `/command`
        if (match) {
            const command = match[1] || match[3];
            const messageToSend = match[2] ? this.prepareMessageToSend(match[2]) : '';

            const webhook = this.settings.webhooks.find(e => e.command && e.command == command); // find webhook by command

            return { webhook, messageToSend };
        }
        return undefined;
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

    makeWebhookRequest(url, options) {
        BdApi.Net.fetch(url, options).then(response => {
            if (response.ok) {
                BdApi.showToast('Webhook message succefully sended!', { type: 'success', timeout: 1000 });
            } else {
                response.text().then(error => {
                    BdApi.showToast(`Error during webhook request!\nError: ${error}`, { type: 'error', timeout: 5000 });
                });
            }
        }).catch(error => {
            BdApi.showToast(`Error during webhook request!\n${error.name}: ${error.message}`, { type: 'error', timeout: 5000 });
        });
    }

    getSettingsPanel() {
        // simple menu (kill me)

        const html = BdApi.DOM.parseHTML('<div></div>');

        const webhooksList = BdApi.DOM.parseHTML(`<div id="webhooks_list"></div>`);


        html.appendChild(this.createButton('Add new', () => {

            this.settings.webhooks.push({ url: '', command: '', avatar_url: '', username: '', default_avatar_url: this.avatarUtils.getDefaultAvatarURL(), default_username: 'None' });
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

        const webhookElement = BdApi.DOM.parseHTML(popoutHTML);

        // handle settings
        webhookElement.addEventListener('click', (e) => {


            const settingsHtml = BdApi.DOM.parseHTML('<div style="gap: 10px; display: grid"></div>');


            const createLabel = (label) => {
                return BdApi.DOM.parseHTML(`<h1 style="color:#dddddd">${label}: </h1>`);
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
                JSON.stringify({ settings: { webhooks: [] } })); // BdApi.save/loadData can't work with empty files
            this.settings = { webhooks: [] };
            this.saveSettings();
        }
    }

    wrapElement(element) {
        const wrap = (elements) => {
            const domWrapper = BdApi.DOM.parseHTML(`<div class="dom-wrapper"></div>`);
            for (let e = 0; e < elements.length; e++) domWrapper.appendChild(elements[e]);
            return domWrapper;
        }
        if (Array.isArray(element)) element = wrap(element);
        return BdApi.React.createElement(BdApi.ReactUtils.wrapElement(element));
    }

    createButton(label, callback, id) {
        const ret = BdApi.DOM.parseHTML(`<button type="button" class="${this.buttonConstansts.button} ${this.buttonConstansts.lookFilled} ${this.buttonConstansts.colorBrand} ${this.buttonConstansts.sizeSmall} ${this.buttonConstansts.grow}" ${(id ? 'id="' + id + '"' : '')}><div class="contents-3ca1mk">${label}</div></button>`);
        if (callback) {
            ret.addEventListener('click', callback);
        }
        return ret;
    }

    createInput(label, id, defaultValue, callback) {
        const ret = BdApi.DOM.parseHTML(
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
        this.messageUtils = BdApi.Webpack.getByKeys('sendMessage');
        this.buttonConstansts = BdApi.Webpack.getByKeys('lookBlank');
        this.inputConstants = BdApi.Webpack.getByKeys('input', 'icon', 'close', 'pointer');
        this.emojiUtils = BdApi.Webpack.getByKeys('getByName');
        this.avatarUtils = BdApi.Webpack.getByKeys('getDefaultAvatarURL');
    }

    stop() {
        BdApi.Patcher.unpatchAll(this.name)
    }

}

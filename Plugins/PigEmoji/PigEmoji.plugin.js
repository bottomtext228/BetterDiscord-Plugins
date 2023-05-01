/**
 * @name PigEmoji
 * @version 2.1.3
 * @author bottom_text | Z-Team 
 * @description Replaces emoji button with any emoji.
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/PigEmoji
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/PigEmoji/PigEmoji.plugin.js
*/



module.exports = class PigEmoji {
    constructor(meta) {
        for (let key in meta) {
            this[key] = meta[key];
        }
    }

    async start() {
        console.log(`${this.name}: started!`);

        this.findWebpacks();


        /* TODO:
            * future: make ability to set custom svg images
        */

        this.settings = BdApi.loadData(this.name, 'settings');
        if (!this.settings) { // load defaults
            this.settings = {
                emoji: 'pig2'
            };
            BdApi.saveData(this.name, 'settings', this.settings);
        };

        this.patchButton();


    }

    async patchButton() {
        // wait until the chat input will be created 
        const button = await this.getEmojiButton();

        const buttonReactInstance = BdApi.ReactUtils.getInternalInstance(button);

        if (!buttonReactInstance) {
            return;
        }

        // https://cdn.discordapp.com/attachments/768531187110510602/1046466928128045066/image.png
        const buttonsContainter = buttonReactInstance.pendingProps.children[2];

        const emojiElement = await this.createEmojiButton(buttonsContainter.props, this.settings.emoji);

        // patch React function to inject our button
        BdApi.Patcher.after(this.name, buttonsContainter.type, 'type', (_, [props], ret) => {
            if (!ret || !this.shouldDrawEmojiButton(props)) {
                return;
            }

            // find the emoji button and replace it
            ret.props.children[ret.props.children.indexOf(ret.props.children.find(e => e.key == 'emoji'))] = emojiElement;
            return ret;
        })
        // forcibly rerender elements to see changes instantly
        this.rerenderMessageStore();
    }

    getSettingsPanel() {
        // simple menu 
        const html = this.parseHTML(`<div></div>`);

        const input_id = this.parseHTML(
            `<input type="text" class="${this.inputConstansts.inputDefault}" name="message" placeholder="Enter emoji" id="input_id" value="${this.settings.emoji}"/>`
        );

        const padding = this.parseHTML(`<pre id="padding">&nbsp</pre>`); // xd

        const confirm_button = this.createButton('Save', () => {
            const value = document.getElementById('input_id').value.trim();
            if (this.getEmojiByName(value)) { // if emoji exists
                this.settings.emoji = value;
                BdApi.saveData(this.name, 'settings', this.settings);
                this.patchButton();
                document.getElementById('padding').innerHTML = '&nbsp';
            } else {
                document.getElementById('padding').innerText = 'Emoji not found.';
                document.getElementById('padding').style = 'color: #dddddd';
            }
        })
        html.appendChild(input_id);
        html.appendChild(padding);
        html.appendChild(confirm_button);
        return html;
    }


    shouldDrawEmojiButton(props) {
        if (props.type?.analyticsName == "profile_bio_input") {
            return false;
        }
        const channel = props.channel;
        if (channel.type == 1 || channel.type == 3) { // DM | Group chat
            return true;
        }
        return this.permissionsWebpack.can({
            context: channel,
            user: this.getCurrentUser(),
            permission: 2048n // send message
        });
    }

    openExpressionPickerMenu(tab, props) {
        // if tab or props undefined/null/etc menu will be closed
        this.expressionPickerWebpack.RO(tab, props);
    }

    getExpressionPickerMenuState() {
        return this.expressionPickerWebpack.Iu.getState();
    }


    getCurrentUser() {
        return this.userStoreWebpack.getCurrentUser();
    }

    getEmojiByName(emojiName) { // unicode emoji only
        return this.emojiUtilities.getByName(emojiName);
    }

    onEmojiHover(e) {

        const button = (e.target.firstChild || e.target);

        const animate = ({ timing, draw, duration }) => {
            let start;
            requestAnimationFrame(function animate(time) {
                // timeFraction changes from 0 to 1
                if (start == undefined) { // never use performance.now() here
                    start = time;
                }
                let timeFraction = (time - start) / duration;
                if (timeFraction > 1) timeFraction = 1;
                // calculate current animation state
                let progress = timing(timeFraction);
                draw(progress); // draw it
                if (timeFraction < 1) {
                    requestAnimationFrame(animate);
                }
            });
        }


        animate({
            timing(timeFraction) {
                return timeFraction;
            }, draw: (progress) => {
                let grayscale;
                let scale;
                let endScale;
                if (e.type == 'mouseenter') {
                    grayscale = 1 - progress; // it's just works
                    scale = 0.14 * progress + 1;
                    endScale = 1.14;
                } else {
                    grayscale = 1 - Math.abs(progress - 1);
                    scale = 1.14 - (0.14 * progress);
                    endScale = 1;
                }

                if (progress == 1) {
                    scale = endScale;
                }
                button.setAttribute('style', `filter: grayscale(${grayscale}); transform: scale(${scale})`);

            }, duration: 75
        });

    }


    async createEmojiButton(props, emojiName) {

        const emoji = this.getEmojiByName(emojiName);
        this.emojiButtonClasses = document.getElementsByClassName(this.classConstansts.emojiButton)[0]?.className;

        return BdApi.React.createElement('div', {
            class: `${this.emojiButtonClassConstansts.CT} ${this.classConstansts.buttonContainer}`,
            key: 'emoji',
        }, BdApi.React.createElement('button', {
            tabindex: "0",
            'aria-controls': "uid_5",
            'aria-expanded': "false",
            'aria-haspopup': "dialog",
            class: `${this.classConstansts.emojiButton} ${this.buttonConstansts.button} ${this.buttonConstansts.lookBlank} ${this.buttonConstansts.colorBrand} ${this.buttonConstansts.grow}`, //this.emojiButtonClasses, //"emojiButtonNormal-35P0_i emojiButton-3FRTuj emojiButton-1fMsf3 button-3BaQ4X button-f2h6uQ lookBlank-21BCro colorBrand-I6CyqQ grow-2sR_-F",
            onClick: () => {
                // recreating the original behaviour
                const activeView = this.getExpressionPickerMenuState(); // current menu ta
                if (!activeView || activeView != 'emoji') {
                    const button = document.querySelector(`.${this.classConstansts.sansAttachButton}`);

                    const buttonReactInstance = BdApi.ReactUtils.getInternalInstance(button);

                    if (!buttonReactInstance) {
                        return;
                    }
                    const buttonsContainter = buttonReactInstance.pendingProps.children[2];

                    this.openExpressionPickerMenu('emoji', buttonsContainter.props.type);
                } else {
                    this.openExpressionPickerMenu('', null); // close menu if already opened
                }

            }, // () => to save 'this' context
            onMouseEnter: (e) => this.onEmojiHover(e),
            onMouseLeave: (e) => this.onEmojiHover(e)
        },
            BdApi.React.createElement('img', {
                'aria-label': emoji.surrogates,
                src: this.getEmojiUrl(emoji.surrogates),
                alt: emoji.surrogates,
                style: { filter: "grayscale(1)", transform: "scale(1)" },
                draggable: "false",
                width: "23", // or 27
                height: "23",
                'data-type': "emoji",
                'data-name': `:${emoji.uniqueName}:`
            })

        ));


    }


    getEmojiButton() {
        return new Promise((resolve, reject) => {
            let button = document.querySelector(`.${this.classConstansts.sansAttachButton}`);
            if (button) resolve(button);
            const observer = new MutationObserver((mutationRecords) => {
                button = document.querySelector(`.${this.classConstansts.sansAttachButton}`);
                if (button) {
                    resolve(button);
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }


    getEmojiUrl(emojiSurrogate) { // example: '🐖' -> '/assets/d083412544c302d290775006877f6202.svg'
        return this.getURLWebpack.getURL(emojiSurrogate);
    }

    parseHTML(html) {
        var template = document.createElement('template');
        html = html.trim(); // Never return a text node of whitespace as the result
        template.innerHTML = html;
        return template.content.firstChild;
    }

    createButton(label, callback, id) {
        // this.buttonConstansts = BdApi.findModuleByProps('lookBlank');
        const ret = this.parseHTML(`<button type="button" class="${this.buttonConstansts.button} ${this.buttonConstansts.lookFilled} ${this.buttonConstansts.colorBrand} ${this.buttonConstansts.sizeSmall} ${this.buttonConstansts.grow}" ${(id ? 'id="' + id + '"' : '')}><div class="contents-3ca1mk">${label}</div></button>`);
        if (callback) {
            ret.addEventListener('click', callback);
        }
        return ret;
    }

    rerenderMessageStore() {
        let LayerProviderIns = BdApi.ReactUtils.getOwnerInstance(document.querySelector(".chatContent-3KubbW") || document.querySelector('main'));
        let LayerProviderPrototype = LayerProviderIns.__proto__
        if (LayerProviderIns && LayerProviderPrototype) {
            let unpatch = BdApi.Patcher.after(this.name, LayerProviderPrototype, 'render', (_, args, ret) => {
                ret.props.children = typeof ret.props.children.children == "function" ? (_ => { return null; }) : [];
                this.forceUpdate(LayerProviderIns);
                unpatch();
            });
            this.forceUpdate(LayerProviderIns);
        }
    }

    forceUpdate(...instances) {
        for (let ins of instances.flat(10).filter(n => n)) {
            if (ins.updater && typeof ins.updater.isMounted == "function" && ins.updater.isMounted(ins)) {
                ins.forceUpdate();
            }
        }
    }

    findWebpacks() {
        this.permissionsWebpack = BdApi.findModuleByProps('areChannelsLocked');
        this.userStoreWebpack = BdApi.findModuleByProps('getCurrentUser');
        this.getURLWebpack = BdApi.findModuleByProps('getURL');
        this.emojiUtilities = BdApi.findModuleByProps('getByName');

        this.expressionPickerWebpack = BdApi.findModuleByProps('RO');

        this.classConstansts = BdApi.findModuleByProps('profileBioInput'); // all three some html classes/discord constants
        this.buttonConstansts = BdApi.findModuleByProps('lookBlank');
        this.inputConstansts = BdApi.findModuleByProps('inputMini', 'inputDefault');

        this.emojiButtonClassConstansts = BdApi.findModuleByProps('X1'); // .X1. EMOJI | GIF | STICKER ( 'emoji' | 'gif' | 'sticker')

    }

    stop() {
        console.log(`${this.name}: stopped!`);
        BdApi.Patcher.unpatchAll(this.name);
        this.rerenderMessageStore();
    }

};

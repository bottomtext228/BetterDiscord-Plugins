/**
 * @name PigEmoji
 * @version 2.2.1
 * @author bottom_text | Z-Team 
 * @description Replaces emoji button with any emoji.
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/PigEmoji
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/PigEmoji/PigEmoji.plugin.js
*/


const EMOJI_TYPE = {
    UNICODE: 0,
    CUSTOM: 1
};

class SettingsPanel extends BdApi.React.Component {
    constructor(props) {
        super(props);
        this.state = {
            emojiType: props.settings.emojiType,
            emoji: props.settings.emoji,
            currentFileName: props.settings.fileName,
            fileContent: props.settings.fileContent,
            fileType: props.settings.fileType,
            fileName: props.settings.fileName,
            width: props.settings.width,
            height: props.settings.height,
            isError: false
        };
    }

    render() {
        const { Button } = BdApi.Components;

        return BdApi.React.createElement("div", {
            style: {
                "display": "flex",
                "flex-direction": "column",
                "gap": "10px"
            }
        },

            // Emoji type
            BdApi.React.createElement("div", {},
                BdApi.React.createElement(BdApi.Components.Text, { style: { "margin-bottom": "4px" } }, "Emoji type:"),
                BdApi.React.createElement(BdApi.Components.RadioInput, {
                    options: [
                        { name: "Unicode", value: EMOJI_TYPE.UNICODE },
                        { name: "Custom", value: EMOJI_TYPE.CUSTOM }
                    ],
                    value: this.state.emojiType,
                    onChange: (value) => {
                        this.setState({ emojiType: value });
                    }
                }),
            ),

            // Unicode emoji
            this.state.emojiType == EMOJI_TYPE.UNICODE && (
                BdApi.React.createElement("div", {},
                    BdApi.React.createElement(BdApi.Components.TextInput, {
                        value: this.state.emoji,
                        onChange: (value) => {
                            this.setState({ emoji: value });
                        }
                    }),
                    this.state.isError && BdApi.React.createElement(BdApi.Components.Text, { color: BdApi.Components.Text.Colors.ERROR, strong: true }, "Invalid emoji!")
                )
            ),

            // Custom emoji
            this.state.emojiType == EMOJI_TYPE.CUSTOM && (
                BdApi.React.createElement("div", {},
                    BdApi.React.createElement(BdApi.Components.Text, { style: { "margin-bottom": "4px" } }, `Current file: ${this.state.currentFileName ?? ''}`),
                    BdApi.React.createElement(
                        "div",
                        {
                            className: `bd-file-input-wrap`
                        },
                        BdApi.React.createElement("input", {
                            type: "file",
                            className: "bd-file-input",
                            accept: "image/*",
                            onChange: async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const buffer = await file.arrayBuffer();
                                const base64 = Buffer.from(buffer).toString('base64');
                                this.setState({ fileName: file.name, fileContent: base64, fileType: file.type });
                            }
                        })
                    )
                )
            ),

            // Width
            BdApi.React.createElement("div", {},
                BdApi.React.createElement(BdApi.Components.Text, { style: { "margin-bottom": "4px" } }, "Width:"),
                BdApi.React.createElement(BdApi.Components.NumberInput, {
                    value: this.state.width,
                    min: 0,
                    onChange: (value) => {
                        this.setState({ width: value });
                    }
                }),
            ),

            // Height
            BdApi.React.createElement("div", {},
                BdApi.React.createElement(BdApi.Components.Text, { style: { "margin-bottom": "4px" } }, "Height:"),
                BdApi.React.createElement(BdApi.Components.NumberInput, {
                    value: this.state.height,
                    min: 0,
                    onChange: (value) => {
                        this.setState({ height: value });
                    }
                }),
            ),

            // Save button
            BdApi.React.createElement(Button, {
                onClick: (e) => {
                    // check if emoji is valid
                    if (this.state.emojiType == EMOJI_TYPE.UNICODE) {
                        const emoji = this.props.getEmojiByName(this.state.emoji);
                        if (!emoji) {
                            this.setState({ isError: true });
                            return;
                        }
                    }

                    this.props.saveSettings({
                        emojiType: this.state.emojiType,
                        emoji: this.state.emoji,
                        fileContent: this.state.fileContent,
                        fileType: this.state.fileType,
                        fileName: this.state.fileName,
                        width: this.state.width,
                        height: this.state.height
                    });
                    // clear error and display currentFileName if need
                    this.setState({ isError: false, currentFileName: this.state.fileName });
                }
            }, "Save")
        );
    }
}

module.exports = class PigEmoji {
    constructor(meta) {
        for (let key in meta) {
            this[key] = meta[key];
        }
    }

    async start() {
        console.log(`${this.name}: started!`);

        this.findWebpacks();

        this.isHovered = false;

        this.ANIMATION_TYPE = {
            ENTER: 0,
            LEAVE: 1
        };

        this.EMOJI_TYPE = {
            UNICODE: 0,
            CUSTOM: 1
        };

        this.settings = BdApi.Data.load(this.name, 'settings');

        if (!this.settings) { // load defaults
            this.settings = {
                emoji: 'pig2',
                fileContent: '',
                fileName: '',
                fileType: '',
                emojiType: this.EMOJI_TYPE.UNICODE,
                width: 23,
                height: 23
            };
            BdApi.Data.save(this.name, 'settings', this.settings);
        };

        // subscribe to expression picker state
        this.unsubscribeFn = this.expressionPickerStateManager.subscribe((current, previous) => {
            const container = document.getElementById('expression-picker-button');
            if (!container) return;

            const button = container.firstChild;
            if (!this.isHovered && current.activeView == 'emoji') { // emoji view opened
                this.animateButton(button, this.ANIMATION_TYPE.ENTER);
            }
            if (current.activeView != 'emoji' && previous.activeView == 'emoji') { // emoji view closeds
                this.animateButton(button, this.ANIMATION_TYPE.LEAVE);
            }
        });
        this.patchButton();

    }

    async patchButton() {
        let url = "";
        if (this.settings.emojiType == this.EMOJI_TYPE.UNICODE) {
            const emoji = this.getEmojiByName(this.settings.emoji);
            url = this.getEmojiUrl(emoji.surrogates);
        }

        if (this.settings.emojiType == this.EMOJI_TYPE.CUSTOM) {
            // convert base64 file data to a blob 
            const blob = new Blob([Buffer.from(this.settings.fileContent, 'base64')], { type: this.settings.fileType });
            url = URL.createObjectURL(blob);
        }

        const emojiElement = this.createEmojiButton(url);

        // patch React function to inject our button
        BdApi.Patcher.after(this.name, this.chatButtonsWebpackWithKey[0], this.chatButtonsWebpackWithKey[1], (_, args, ret) => {
            // thanks to Strencher (InvisibleTyping) for this line of code
            if (args.length == 2 && !args[0].disabled && args[0].type.analyticsName == "normal" && ret?.props.children && Array.isArray(ret.props.children)) {
                // find the emoji button and replace it
                ret.props.children[ret.props.children.indexOf(ret.props.children.find(e => e.key == 'emoji'))] = emojiElement;
                return ret;
            }
        })
        // forcibly rerender elements to see changes instantly
        this.rerenderMessageStore();
    }

    getSettingsPanel() {
        return BdApi.React.createElement(SettingsPanel, {
            settings: this.settings,
            saveSettings: (settings) => this.saveSettings(settings),
            getEmojiByName: (name) => this.getEmojiByName(name)
        });
    }

    saveSettings(settings) {
        this.settings = settings;
        BdApi.Data.save(this.name, 'settings', this.settings);
        BdApi.UI.showToast('Saved', { type: 'success' });
        this.patchButton();
    }

    // find buttons in the children list
    getButtonsInstanceFromChildren(vnode) {
        for (let curr = vnode, max = 100; curr !== null && max--; curr = curr.return) {
            const tree = curr?.pendingProps?.children;
            let buttons;
            if (Array.isArray(tree) && (buttons = tree.find(s => s?.props?.type && s.props.channel && s.type?.$$typeof))) {
                return buttons;
            }
        }
    }

    getButtonsInstance() {
        const button = document.querySelector(`.${this.classConstants.inner}`);
        if (!button) return null;

        const buttonReactInstance = BdApi.ReactUtils.getInternalInstance(button);
        if (!buttonReactInstance) return null;

        return this.getButtonsInstanceFromChildren(buttonReactInstance);
    }

    openExpressionPickerMenu(tab, props) {
        // if tab or props undefined/null/etc menu will be closed
        this.expressionPickerStateManager.setState({
            activeView: tab,
            activeViewType: props,
            activeChannelId: this.lastChannelWebpack.getChannelId(), // activeChannelId from getState() itself is null so use this
            lastActiveView: this.getExpressionPickerMenuState().activeView
        })
    }

    getExpressionPickerMenuState() {
        return this.expressionPickerStateManager.getState();
    }

    getCurrentUser() {
        return this.userStoreWebpack.getCurrentUser();
    }

    getEmojiByName(emojiName) { // unicode emoji only
        return this.emojiUtilities.getByName(emojiName);
    }

    onEmojiClick(e) {
        // recreating the original behaviour
        const activeView = this.getExpressionPickerMenuState().activeView; // current menu tab
        if (!activeView || activeView != 'emoji') {

            const buttonsInstance = this.getButtonsInstance();
            if (!buttonsInstance) return;

            this.openExpressionPickerMenu('emoji', buttonsInstance.props.type);
        } else {
            this.openExpressionPickerMenu('', null); // close menu if already opened
        }
    }

    onEmojiHover(e) {
        const button = e.target.firstChild || e.target; // it must be like that
        if (!button) return;

        const activeView = this.getExpressionPickerMenuState().activeView;
        if (activeView != 'emoji') {
            this.animateButton(button, e.type == 'mouseenter' ? this.ANIMATION_TYPE.ENTER : this.ANIMATION_TYPE.LEAVE);
        }
    }

    animateButton(button, type) {
        if (this.isHovered == (type == this.ANIMATION_TYPE.ENTER)) return; // hack

        this.isHovered = type == this.ANIMATION_TYPE.ENTER;

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
                if (type == this.ANIMATION_TYPE.ENTER) {
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

    createEmojiButton(emojiUrl) {
        return BdApi.React.createElement('div', {
            class: `expression-picker-chat-input-button ${this.classConstants.buttonContainer}`,
            key: 'emoji'      
        }, BdApi.React.createElement('button', {
            id: "expression-picker-button",
            tabindex: "0",
            class: `${this.classConstants.emojiButton} ${this.buttonConstants.button} ${this.buttonConstants.lookBlank} ${this.buttonConstants.colorBrand} ${this.buttonConstants.grow}`,
            onClick: (e) => this.onEmojiClick(e),
            onMouseEnter: (e) => this.onEmojiHover(e),
            onMouseLeave: (e) => this.onEmojiHover(e)
        },
            BdApi.React.createElement('img', {
                src: emojiUrl,
                style: { filter: "grayscale(1)", transform: "scale(1)" },
                draggable: "false",
                width: this.settings.width,
                height: this.settings.height
            })
        ));
    }

    getEmojiUrl(emojiSurrogate) { // example: '🐖' -> '/assets/d083412544c302d290775006877f6202.svg'
        return this.getURLWebpack.getURL(emojiSurrogate);
    }

    rerenderMessageStore() {
        const LayerProvider = document.querySelector(`.${this.chatContentConstants.chatContent}`) || document.querySelector('main');
        if (!LayerProvider) return;
        let LayerProviderIns = BdApi.ReactUtils.getOwnerInstance(LayerProvider);
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
            if (ins.updater) {
                ins.forceUpdate();
            }
        }
    }

    findWebpacks() {
        this.userStoreWebpack = BdApi.Webpack.getByKeys('getCurrentUser');
        this.getURLWebpack = BdApi.Webpack.getByKeys('getURL');
        this.emojiUtilities = BdApi.Webpack.getByKeys('getByName');

        const expressionPickerWebpack = BdApi.Webpack.getBySource('activeChannelId', 'getState().activeView}))}');
        this.expressionPickerStateManager = Object.entries(expressionPickerWebpack).find(entry => Object.keys(entry[1]).includes('subscribe'))[1];
        this.lastChannelWebpack = BdApi.Webpack.getByKeys('getLastSelectedChannelId');
        // thanks to Strencher for this
        this.chatButtonsWebpackWithKey = [...BdApi.Webpack.getWithKey(BdApi.Webpack.Filters.byStrings("type", "showAllButtons", "paymentsBlocked"))];

        this.classConstants = BdApi.Webpack.getByKeys('profileBioInput'); // css classes
        this.buttonConstants = BdApi.Webpack.getByKeys('lookBlank');
        this.inputConstants = BdApi.Webpack.getByKeys('input', 'inner', 'close');
        this.chatContentConstants = BdApi.Webpack.getByKeys('chatContent', 'content', 'cursorPointer');
    }

    stop() {
        console.log(`${this.name}: stopped!`);
        BdApi.Patcher.unpatchAll(this.name);
        this.unsubscribeFn();
        this.rerenderMessageStore();
    }

};

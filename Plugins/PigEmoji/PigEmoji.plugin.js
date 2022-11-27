/**
 * @name PigEmoji
 * @version 2.0.0
 * @description Replace emoji button with the pig emoji.
 * @author bottom_text | Z-Team 
*/



module.exports = class PigEmoji {
    constructor(meta) {
        for (let key in meta) {
            this[key] = meta[key];
        }
    }
    start() {
        console.log(`${this.name}: started!`);
        
        this.permissionsWebpack = BdApi.findModuleByProps('areChannelsLocked');
        this.userStoreWebpack = BdApi.findModuleByProps('getCurrentUser');
        this.expressionPickerWebpack = BdApi.findModuleByProps('RO'); 
    
        this.classConstansts = BdApi.findModuleByProps('profileBioInput'); // both some html classes/discord constants
        this.emojiButtonClassConstansts = BdApi.findModuleByProps('X1'); // .X1. EMOJI | GIF | STICKER ( 'emoji' | 'gif' | 'sticker')

   
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
        // patch React function to inject our button
        BdApi.Patcher.after(this.name, buttonsContainter.type, 'type', (_, [props], ret) => {
            if (!this.shouldDrawEmojiButton(ret?.props?.children, props)) {
                return;
            }
            // create our button and replace the original
            const pig2 = this.createEmojiButton(buttonsContainter.props);
            ret.props.children[ret.props.children.length - 1] = pig2;
            return ret;
        })
        // forcibly rerender elements to see changes instantly
        this.rerenderMessageStore();
    }

    rerenderMessageStore() {
        let LayerProviderIns = BdApi.ReactUtils.getOwnerInstance(document.querySelector(".chatContent-3KubbW"));
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

    shouldDrawEmojiButton(children, props) {
        const channel = props.channel
        if (props.type?.analyticsName == "profile_bio_input") {
            return false;
        }
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

    getCurrentUser() {
        return this.userStoreWebpack.getCurrentUser();
    }

    onEmojiHover(e) {
        e.target.querySelector('path')?.setAttribute('fill', `${e.type == 'mouseenter' ? '#F4ABBA' : 'currentColor'}`)
    }

    createEmojiButton(props) {
        return BdApi.React.createElement('div', {
            class: `${this.emojiButtonClassConstansts.CT}`,
            key: 'emoji',
        }, BdApi.React.createElement('button', {
            tabindex: "0",
            'aria-controls': "uid_5",
            'aria-expanded': "false",
            'aria-haspopup': "dialog",
            class: "emojiButtonNormal-35P0_i emojiButton-3FRTuj emojiButton-1fMsf3 button-3BaQ4X button-f2h6uQ lookBlank-21BCro colorBrand-I6CyqQ grow-2sR_-F",
            onClick: () => this.openExpressionPickerMenu('emoji', props.type),
            onMouseEnter: this.onEmojiHover,
            onMouseLeave: this.onEmojiHover
        },
            BdApi.React.createElement('svg', {
                width: "27",
                height: "27",
                'aria-hidden': "true",
                role: "img",
                viewBox: "0 0 36 36",
            }, [
                BdApi.React.createElement('path', {
                    color: "var(--interactive-normal)",
                    fill: "currentColor",
                    d: "M33.738 20.368c-.799-5.543-5.186-9.78-12.562-9.78-.293 0-.621.012-.964.03-1.479.058-2.961.248-4.399.56-.749.144-1.507.317-2.253.514-.775-1.051-2.342-2.163-2.736-2.163-.512 0-.038 1.871-.006 3.052-.88.349-1.685.742-2.347 1.183-3.177 2.118-3.177 3.177-6.838 3.177-1.632 0-1.588 1.658-1.588 3.705 0 2.046-.044 2.618 1.588 3.707 2.183 1.456 4.731 3.612 7.952 5.386C11.608 32.886 9.91 36 11.648 36c1.226 0 2.807-1.964 3.647-3.944 1.788.474 3.732.769 5.881.769 1.142 0 2.204-.089 3.201-.245.272 1.944-.16 3.42 1.035 3.42 1.555 0 6.998-4.994 8.218-11.29.06-.287.103-.582.142-.882.012-.09.028-.18.038-.271.021-.199.03-.404.041-.608 1.046.275 2.149.693 2.149-.175 0-.705-1.119-1.715-2.262-2.406z"
                }),
                BdApi.React.createElement('path', {
                    fill: "#292F33",
                    d: "M10.588 16.941c0 .584-.474 1.059-1.059 1.059-.584 0-1.059-.474-1.059-1.059s.474-1.059 1.059-1.059 1.059.474 1.059 1.059z"
                })
            ])
        ));

    }

    getEmojiButton() {
        return new Promise((resolve, reject) => {
            const observer = new MutationObserver((mutationRecords) => {
                const button = document.querySelector(`.${this.classConstansts.sansAttachButton}`);
                if (button) {
                    resolve(button);
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    stop() { 
        console.log(`${this.name}: stopped!`);
        BdApi.Patcher.unpatchAll(this.name);
        this.rerenderMessageStore();
    }


};




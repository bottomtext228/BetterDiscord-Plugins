/**
 * @name InputSwitcher
 * @version 1.3.4
 * @author bottom_text | Z-Team 
 * @description Switches the keyboard layout(RU & EN)/case of the message.
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/InputSwitcher
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/InputSwitcher/InputSwitcher.plugin.js
*/

module.exports = (_ => {

    const changeLog = {}
    // thanks to DevilBro for his library
    return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
        constructor(meta) { for (let key in meta) this[key] = meta[key]; }
        getName() { return this.name; }
        getAuthor() { return this.author; }
        getVersion() { return this.version; }
        getDescription() { return `The Library Plugin needed for ${this.name} is missing. Open the Plugin Settings to download it. \n\n${this.description}`; }

        downloadLibrary() {
            require("request").get("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js", (e, r, b) => {
                if (!e && b && r.statusCode == 200) require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => BdApi.showToast("Finished downloading BDFDB Library", { type: "success" }));
                else BdApi.alert("Error", "Could not download BDFDB Library Plugin. Try again later or download it manually from GitHub: https://mwittrien.github.io/downloader/?library");
            });
        }

        load() {
            if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, { pluginQueue: [] });
            if (!window.BDFDB_Global.downloadModal) {
                window.BDFDB_Global.downloadModal = true;
                BdApi.showConfirmationModal("Library Missing", `The Library Plugin needed for ${this.name} is missing. Please click "Download Now" to install it.`, {
                    confirmText: "Download Now",
                    cancelText: "Cancel",
                    onCancel: _ => { delete window.BDFDB_Global.downloadModal; },
                    onConfirm: _ => {
                        delete window.BDFDB_Global.downloadModal;
                        this.downloadLibrary();
                    }
                });
            }
            if (!window.BDFDB_Global.pluginQueue.includes(this.name)) window.BDFDB_Global.pluginQueue.push(this.name);
        }
        start() { this.load(); }
        stop() { }
        getSettingsPanel() {
            let template = document.createElement("template");
            template.innerHTML = `<div style="color: var(--header-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">The Library Plugin needed for ${this.name} is missing.\nPlease click <a style="font-weight: 500;">Download Now</a> to install it.</div>`;
            template.content.firstElementChild.querySelector("a").addEventListener("click", this.downloadLibrary);
            return template.content.firstElementChild;
        }

    } : (([Plugin, BDFDB]) => {

        return class InputSwitcher extends Plugin {

            onStart() {

                this.UserStore = BdApi.findModuleByProps('getUser', 'getCurrentUser');
                this.MessageActions = BdApi.findModuleByProps('sendMessage', 'editMessage');
                this.UserTagConstants = { ...BdApi.findModuleByProps('userTagUsernameNoNickname'), ...BdApi.findModuleByProps('defaultColor') };
                this.SlateConstants = BdApi.findModuleByProps('slateTextArea', 'slateContainer');


                // load settings
                const defaultSettings = {
                    bindings: {
                        language: {
                            name: 'Language',
                            keycombo: [17, 88]
                        },
                        case: {
                            name: 'Case',
                            keycombo: [17, 78]
                        }
                    }
                };
                this.settings = { ...defaultSettings, ...BDFDB.DataUtils.load(this, 'settings') };
                this.settings.bindings.language.callback = this.swapLanguage; // we can't save functions in file (normally)
                this.settings.bindings.case.callback = this.swapCase;


                // TODO: maybe use this https://github.com/BetterDiscord/BetterDiscord/issues/1609 ?
                BDFDB.ListenerUtils.add(this, document, "keydown", event => {
                    // listen channel text input + message edit text input
                    if (BDFDB.DOMUtils.getParent(BDFDB.dotCN.textareawrapchat, document.activeElement)
                        || (BDFDB.DOMUtils.getParent(BDFDB.dotCN.messagechanneltextarea, document.activeElement))) {
                        this.onKeyDown(event);
                    }
                });


            }
            // right click on text input
            onTextAreaContextMenu(e) {
                const editor = e.instance.props.editor;
                if (!editor) return;

                const textInputRichValue = e.instance.props.editor.children;
                if (BDFDB.SlateUtils.toTextValue(textInputRichValue) == '') return;  // empty input

                e.returnvalue.props.children.push(BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                    label: 'Switch',
                    id: `SwitchPopUp`,
                    children: [
                        BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                            label: 'Languange',
                            id: 'SwitchLanguange',
                            action: _ =>
                                this.setTextInputRichValue(editor, // () => to prevent loss of 'this'
                                    this.mapTextInputRichValue(textInputRichValue, (text) => this.swapLanguage(text)))
                        }),
                        BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                            label: 'Case',
                            id: 'SwitchCase',
                            action: _ =>
                                this.setTextInputRichValue(editor,
                                    this.mapTextInputRichValue(textInputRichValue, (text) => this.swapCase(text)))
                        })
                    ]
                }));

            }
            // right click on message
            onMessageContextMenu(e) {
                const props = e.instance.props;
                if (props.message && props.channel) {
                    let [children, index] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, { id: ["edit", "add-reaction", "quote"] });
                    const child = {
                        label: 'Switch',
                        id: `SwitchPopUp`,
                    };
                    if (props.message.author.id == this.getCurrentUser().id) {
                        child.children = [
                            BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                                label: 'Languange',
                                id: 'SwitchLanguange',
                                action: _ => {
                                    const newMessage = this.swapLanguage(props.message.content);
                                    if (props.message.content != newMessage) {
                                        this.editMessage(props.channel.id, props.message.id, newMessage);
                                    }
                                }
                            }),
                            BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                                label: 'Case',
                                id: 'SwitchCase',
                                action: _ => {
                                    const newMessage = this.swapCase(props.message.content);
                                    if (props.message.content != newMessage) {
                                        this.editMessage(props.channel.id, props.message.id, newMessage);
                                    }
                                }
                            })
                        ]
                    }
                    else {
                        child.action = _ => this.createMessagePopUp(props.message);
                    }
                    children.splice(children.length - 1, 0, BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, child));
                }
            }

            onKeyDown() {
                for (const binding of Object.keys(this.settings.bindings)) {
                    const action = this.settings.bindings[binding];
                    if (this.isKeyComboPressed(action.keycombo)) {
                        this.doKeybindAction(action.callback)
                    }
                }
            }

            doKeybindAction(callback) {
                const slateDivs = [...document.querySelectorAll(`.${this.SlateConstants.slateTextArea}`)];
                const slateTextArea = slateDivs.find(slate => slate == document.activeElement); // find active input

                if (slateTextArea) {
                    const reactProp = BdApi.ReactUtils.getInternalInstance(slateTextArea);
                    const editor = BDFDB.ObjectUtils.get(reactProp, 'pendingProps.children.props.node');
                    if (editor) {
                        const replacementValue = this.mapTextInputRichValue(editor.children,
                            (text) => callback.apply(this, [text]));
                        this.setTextInputRichValue(editor, replacementValue);
                    }
                }
            }


            isKeyComboPressed(keycombo) {
                for (let key of keycombo) if (!BDFDB.ListenerUtils.isPressed(key)) return false;
                return true;
            }

            mapTextInputRichValue(children, callback) {
                /*
                * (input image) https://media.discordapp.net/attachments/768531187110510602/1060284916622950521/image.png
                * richValue in the input stored like objects, not like a single string
                * (input value image) https://media.discordapp.net/attachments/768531187110510602/1060284688020807731/image.png
                */
                return children.map(line => {
                    const lineCopy = Object.assign({}, line);
                    lineCopy.children = line.children.map(e => {
                        if (Object.keys(e).length == 1 && e.text != '') { // we need only text values -> {text: 'text'}
                            const copy = Object.assign({}, e); // cannot modify read-only
                            copy.text = callback(copy.text); // execute callback on each text value
                            return copy;
                        }
                        return e;
                    });
                    return lineCopy;
                });
            }

            setTextInputRichValue(editor, richValue) {
                editor.history.stack.splice(editor.history.index + 1, 0, {
                    type: "other",
                    mergeable: false,
                    createdAt: new Date().getTime(),
                    value: richValue,
                    selection: editor.history.stack[editor.history.index].selection
                });
                editor.redo(); // input rerender
            }

            editMessage(channelId, messageId, content) {
                this.MessageActions.editMessage(channelId, messageId, { content: content });
            }

            getCurrentUser() {
                return this.UserStore.getCurrentUser();
            }

            getUser(id) {
                return this.UserStore.getUser(id);
            }

            createMessagePopUp(message) {

                const popoutHTML =
                    `<div>
                        <div style="margin-bottom: 10px; display: flex; justify-content: left;">
                            <img style="height: 32px; height: 32px; border-radius: 50%;" src="${message.author.getAvatarURL()}">			
                            <span style="margin-left: 10px; margin-top: 5px">
                                <span class="${this.UserTagConstants.defaultColor}" aria-expanded="false" role="button" tabindex="0">
                                    ${message.author.username}
                                </span>
                            </span>
			            </div>
                        <div id="message_content" style="color: var(--text-default)">                                                                   
                        </div>  	
		            </div>`;


                const popout = BDFDB.DOMUtils.create(popoutHTML);


                // safely inject text into the DOM via innerText
                popout.querySelector('div[id="message_content"').innerText = this.swapLanguage(message.content.replace(/<a{0,1}:\w+:\d+>|<@&{0,1}\d+>/g, ''));

                /*    
                BDFDB.ModalUtils.open(this, {
                    children: [BDFDB.ReactUtils.elementToReact(BDFDB.DOMUtils.create(popoutHTML))],
                }); // this somehow gives cross-origin error sometimes
                */

                BdApi.showConfirmationModal(this.name, BDFDB.ReactUtils.elementToReact(popout), { cancelText: '' });
            }

            swapCase(message) {
                return this.swapWords(message, (word) => {
                    return word.split("").map(l => l == l.toLowerCase() ? l.toUpperCase() : l.toLowerCase()).join("");
                })
            }

            swapLanguage(message) {
                return this.swapWords(message, (word) => {
                    var changedWord = '';
                    word.split('').forEach((char, index) => { // iterate words character by character
                        var letter = this.letters[char.toLowerCase()];
                        if (letter) {
                            if (char == char.toLowerCase()) {
                                letter = letter.toLowerCase(); // save original character case 
                            }
                            else {
                                letter = letter.toUpperCase();
                            }
                        } else {
                            letter = char;
                        }
                        changedWord += letter;
                    });
                    return changedWord;
                });
            }

            getSettingsPanel() {
                const settingsItems = [];

                for (const binding of Object.keys(this.settings.bindings)) {
                    const action = this.settings.bindings[binding];
                    settingsItems.push(BDFDB.ReactUtils.createElement("div", {
                        className: BDFDB.disCN.marginbottom20,
                        children: [
                            BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
                                className: BDFDB.disCN.marginbottom8,
                                align: BDFDB.LibraryComponents.Flex.Align.CENTER,
                                direction: BDFDB.LibraryComponents.Flex.Direction.HORIZONTAL,
                                children: [ // action label      
                                    BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsLabel, {
                                        label: action.name
                                    })]
                            }), // keybind recorder
                            BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.KeybindRecorder, {
                                value: action.keycombo,
                                reset: true,
                                disabled: false,
                                onChange: value => {
                                    action.keycombo = value;
                                    BDFDB.DataUtils.save(this.settings, this, 'settings');
                                }
                            })
                        ]
                    }));
                }
                return settingsItems;
            }

            swapWords(string, callback) {
                // executes callback on each word that don't match in regexp. I have no idea how to do this better
                // it's just works
                var swappedString = ''
                var words = string.split(' ');
                const regExp = /<a{0,1}:\w+:\d+>|https{0,1}:\/\/[^ ]*(?!\.)[^. ]+|<@&{0,1}\d+>|@here|@everyone/g; // guild emoji | URL | user/role mention | here/everyone
                for (let wordsIterator in words) {
                    const word = words[wordsIterator];
                    const dump = word.match(regExp);
                    var result, indexes = [];
                    while ((result = regExp.exec(word))) {
                        indexes.push(result.index); // save position of the ignored parts of the string 
                    }
                    var text = word;
                    for (let dumpIterator in dump) {
                        text = text.replace(dump[dumpIterator], ' '.repeat(dump[dumpIterator].length)); // replace it to get needed things
                    }
                    var wordsToChange = text.match(/[^ ]+/g); // get needed words from the string with spaces 

                    for (let wordsToChangeIterator in wordsToChange) {
                        var changedWord = callback(wordsToChange[wordsToChangeIterator]);
                        text = text.replace(wordsToChange[wordsToChangeIterator], changedWord); // restore original 
                    }

                    for (let dumpIterator in dump) {
                        const replaceAt = (string, index, replacement) => { // https://stackoverflow.com/a/1431113
                            return string.substring(0, index) + replacement + string.substring(index + replacement.length);
                        }
                        text = replaceAt(text, indexes[dumpIterator], dump[dumpIterator]);
                    }

                    swappedString += text + ' ';

                }
                return swappedString.slice(0, -1); // delete last space
            }

            letters = {
                'a': 'ф',
                'b': 'и',
                'c': 'с',
                'd': 'в',
                'e': 'у',
                'f': 'а',
                'g': 'п',
                'h': 'р',
                'i': 'ш',
                'j': 'о',
                'k': 'л',
                'l': 'д',
                'm': 'ь',
                'n': 'т',
                'o': 'щ',
                'p': 'з',
                'q': 'й',
                'r': 'к',
                's': 'ы',
                't': 'е',
                'u': 'г',
                'v': 'м',
                'w': 'ц',
                'x': 'ч',
                'y': 'н',
                'z': 'я',
                ',': 'б',
                ';': 'ж',
                '`': 'ё',
                '[': 'х',
                ']': 'ъ',
                "'": 'э',
                '.': 'ю',
                '@': '"',
                '#': '№',
                //  '$':';',
                '^': ':',
                '&': '?',
                // RUS TO ENG
                'а': 'f',
                'б': ',',
                'в': 'd',
                'г': 'u',
                'д': 'l',
                'е': 't',
                'ё': '`',
                'ж': ';',
                'з': 'p',
                'и': 'b',
                'й': 'q',
                'к': 'r',
                'л': 'k',
                'м': 'v',
                'н': 'y',
                'о': 'j',
                'п': 'g',
                'р': 'h',
                'с': 'c',
                'т': 'n',
                'у': 'e',
                'ф': 'a',
                'х': '[',
                'ц': 'w',
                'ч': 'x',
                'ш': 'i',
                'щ': 'o',
                'ъ': ']',
                'ы': 's',
                'ь': 'm',
                'э': "'",
                'ю': '.',
                'я': 'z',
                '"': '@',
                '№': '#',
                // ';':'$', 
                ':': '^',
                '?': '&'

            };
        };
    })(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();

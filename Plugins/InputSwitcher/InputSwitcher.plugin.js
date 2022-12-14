/**
 * @name InputSwitcher
 * @version 1.2.0
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
                this.UserStore = BdApi.findModuleByProps('getUser');
                this.MessageActions = BdApi.findModuleByProps('editMessage');
            }
            // right click on text input
            onTextAreaContextMenu(e) {
                if (!e.instance.props.editor) {
                    return;
                }

                const textInput = e.instance.props.editor.children[0].children;
                if (textInput.length > 1 || textInput[0].text != '') { // if some text in the input
                    e.returnvalue.props.children.push(BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                        label: 'Switch',
                        id: `SwitchPopUp`,
                        children: [
                            BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                                label: 'Languange',
                                id: 'SwitchLanguange',
                                action: _ => 
                                    this.setTextInputValue(e.instance.props.editor, // () => to prevent loss of 'this'
                                        this.changeTextInputValue(textInput, (text) => this.swapLanguage(text))) 
                            }),
                            BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                                label: 'Case',
                                id: 'SwitchCase',
                                action: _ => 
                                    this.setTextInputValue(e.instance.props.editor, 
                                        this.changeTextInputValue(textInput, (text) => this.swapCase(text)))
                            })
                        ]
                    }));

                }
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

            changeTextInputValue(children, callback) {           
                /*
                * (input image) https://media.discordapp.net/attachments/768531187110510602/1060284916622950521/image.png
                * values in the input stored like objects, not like a single string
                * (input value image) https://media.discordapp.net/attachments/768531187110510602/1060284688020807731/image.png
                */
                return children.map(e => {
                    if (Object.keys(e).length == 1 && e.text != '') { // we need only text values -> {text: 'text'}
                        const copy = Object.assign({}, e); // cannot modify read-only
                        copy.text = callback(copy.text); // execute callback on each text value
                        return copy;
                    }
                    return e;
                });
            }

            setTextInputValue(editor, replacement) {
                editor.history.stack.splice(editor.history.index + 1, 0, {
                    type: "other",
                    mergeable: false,
                    createdAt: new Date().getTime(),
                    value: [{ children: replacement, type: 'line' }],
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
                        <div class="item-1BCeuB role-member">
                            <div class="itemCheckbox-2G8-Td">
                                <div class="avatar-1XUb0A wrapper-1VLyxH" role="img" aria-hidden="false" style="width: 32px; height: 32px;">
                                    <svg width="40" height="32" viewBox="0 0 40 32" class="mask-1FEkla svg-2azL_l" aria-hidden="true">
                                        <foreignObject x="0" y="0" width="32" height="32" mask="url(#svg-mask-avatar-default)">
                                            <div class="avatarStack-3vfSFa">
                                                <img src="${message.author.getAvatarURL()}" alt=" " class="avatar-b5OQ1N" aria-hidden="true">
                                            </div>
                                        </foreignObject>
                                    </svg>
                                </div>
                            </div>
                            <div class="itemLabel-27pirQ">
                                <span class="username">
                                    ${message.author.username}
                                </span>
                                <span class="discriminator-2jnrqC">
                                    #${message.author.discriminator}
                                </span>                   
                            </div>                                                                       
                        </div>
                        <br> 
                        <span style="color:#dddddd">                                   
                        ${this.swapLanguage(message.content.replace(/<:\w+:\d+>|<@&{0,1}\d+>/g, ''))}                             
                        <span>   
                    <div>`;

                BDFDB.ModalUtils.open(this, {
                    children: [BDFDB.ReactUtils.elementToReact(BDFDB.DOMUtils.create(popoutHTML))],
                });
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

            swapWords(string, callback) {
                // executes callback on each word that don't match in regexp. I have no idea how to do this better
                // it's just works
                var swappedString = ''
                var words = string.split(' ');
                const regExp = /<:\w+:\d+>|https{0,1}:\/\/[^ ]*(?!\.)[^. ]+|<@&{0,1}\d+>|@here|@everyone/g; // guild emoji | URL | user/role mention | here/everyone
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
            onStop() {

            }

            letters = {
                'a': '??',
                'b': '??',
                'c': '??',
                'd': '??',
                'e': '??',
                'f': '??',
                'g': '??',
                'h': '??',
                'i': '??',
                'j': '??',
                'k': '??',
                'l': '??',
                'm': '??',
                'n': '??',
                'o': '??',
                'p': '??',
                'q': '??',
                'r': '??',
                's': '??',
                't': '??',
                'u': '??',
                'v': '??',
                'w': '??',
                'x': '??',
                'y': '??',
                'z': '??',
                ',': '??',
                ';': '??',
                '`': '??',
                '[': '??',
                ']': '??',
                "'": '??',
                '.': '??',
                '@': '"',
                '#': '???',
                //  '$':';',
                '^': ':',
                '&': '?',
                // RUS TO ENG
                '??': 'f',
                '??': ',',
                '??': 'd',
                '??': 'u',
                '??': 'l',
                '??': 't',
                '??': '`',
                '??': ';',
                '??': 'p',
                '??': 'b',
                '??': 'q',
                '??': 'r',
                '??': 'k',
                '??': 'v',
                '??': 'y',
                '??': 'j',
                '??': 'g',
                '??': 'h',
                '??': 'c',
                '??': 'n',
                '??': 'e',
                '??': 'a',
                '??': '[',
                '??': 'w',
                '??': 'x',
                '??': 'i',
                '??': 'o',
                '??': ']',
                '??': 's',
                '??': 'm',
                '??': "'",
                '??': '.',
                '??': 'z',
                '"': '@',
                '???': '#',
                // ';':'$', 
                ':': '^',
                '?': '&'

            };
        };
    })(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();


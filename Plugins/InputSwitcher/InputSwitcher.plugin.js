/**
 * @name InputSwitcher
 * @version 1.1.0
 * @author bottom_text | Z-Team 
 * @description Switches the keyboard layout of the message
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
                this.UserStore = BdApi.findModuleByProps('getCurrentUser');
                this.MessageActions = BdApi.findModuleByProps('editMessage');
            }
            // right click on text input
            onTextAreaContextMenu(e) {
                if (!e.instance.props.editor) {
                    return;
                }
                const textInputValue = this.getTextInputValue(e.instance.props.editor.children[0].children);
                if (textInputValue) {
                    e.returnvalue.props.children.push(BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                        label: 'Switch',
                        id: `SwitchPopUp`,
                        action: _ => {
                            this.setTextInputValue(e.instance.props.editor, this.swapLanguage(textInputValue));
                        }
                    }));
                }
            }
            // right click on message
            onMessageContextMenu(e) {
                const props = e.instance.props;
                if (props.message && props.channel) {
                    let [children, index] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, { id: ["edit", "add-reaction", "quote"] });
                    children.splice(children.length - 1, 0, BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                        label: 'Switch',
                        id: `SwitchPopUp`,
                        action: _ => {
                            if (props.message.author.id == this.getCurrentUser().id) {
                                this.editMessage(props.channel.id, props.message.id, this.swapLanguage(props.message.content));
                            }
                            else {
                                this.createMessagePopUp(props.message);
                            }
                        }
                    }));

                }
            }

            getTextInputValue(childrens) {
                let text = ''
                childrens.forEach(e => {
                    if (e.text && e.text != '') {
                        text += e.text;
                    }
                    else {
                        if (e.type == 'emoji') {
                            text += e.emoji.surrogate
                        }
                        if (e.type == 'customEmoji') {
                            text += `<${e.emoji.name}${e.emoji.emojiId}>`;
                        }
                    }
                });
                return text;
            }

            setTextInputValue(editor, replacement) {
                if (!editor) return;
                editor.history.stack.splice(editor.history.index + 1, 0, {
                    type: "other",
                    mergeable: false,
                    createdAt: new Date().getTime(),
                    value: BDFDB.SlateUtils.toRichValue(replacement),
                    selection: editor.history.stack[editor.history.index].selection
                });
                editor.redo();
            }

            editMessage(channelId, messageId, content) {
                this.MessageActions.editMessage(channelId, messageId, { content: content });
            }

            getCurrentUser() {
                return this.UserStore.getCurrentUser();
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

            swapLanguage(message) {
                var swappedMessage = ''
                var words = message.split(' ');
                const regExp = /<:\w+:\d+>|https{0,1}:\/\/[^ ]*(?!\.)[^. ]+|<@&{0,1}\d+>|@here|@everyone/g; // guild emoji | URL | user/role mention | here/everyone
                for (let wordsIterator in words) {
                    const word = words[wordsIterator];
                    const dump = word.match(regExp);
                    var result, indexes = [];
                    while ((result = regExp.exec(word))) {
                        indexes.push(result.index); // сохраняем позицию игнорируемых частей строки
                    }
                    var text = word;
                    for (let dumpIterator in dump) {
                        text = text.replace(dump[dumpIterator], ' '.repeat(dump[dumpIterator].length)); // убираем их, чтобы достать нужное
                    }
                    var wordsToChange = text.match(/[^ ]+/g); // достаём нужные слова из строки с пробелами

                    for (let wordsToChangeIterator in wordsToChange) {
                        var changedWord = '';
                        wordsToChange[wordsToChangeIterator].split('').forEach((char, index) => { // перебираем слова посимвольно
                            var letter = this.letters[char.toLowerCase()];
                            if (letter) {
                                if (char == char.toLowerCase()) {
                                    letter = letter.toLowerCase(); // сохраняем регистр оригинальных символов
                                }
                                else {
                                    letter = letter.toUpperCase();
                                }
                            } else {
                                letter = char;
                            }
                            changedWord += letter;
                        });
                        text = text.replace(wordsToChange[wordsToChangeIterator], changedWord); // восстанавливаем оригинал
                    }

                    for (let dumpIterator in dump) {
                        const replaceAt = (string, index, replacement) => { // https://stackoverflow.com/a/1431113
                            return string.substring(0, index) + replacement + string.substring(index + replacement.length);
                        }
                        text = replaceAt(text, indexes[dumpIterator], dump[dumpIterator]);
                    }

                    swappedMessage += text + ' ';

                }
                return swappedMessage.trim();

            }

            onStop() {

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


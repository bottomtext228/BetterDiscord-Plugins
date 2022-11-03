/**
 * @name InputSwitcher
 * @version 1.0.4
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
                const libraries = [
                    {
                        name: 'ZeresPluginLibrary',
                        url: 'https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js',
                        filename: '0PluginLibrary.plugin.js'
                    },
                ];
                if (!this.checkLibraries(libraries)) {
                    return;
                }
              
                                
            }

            onStop() {
          
            }

            onMessageContextMenu(e) {
                const props = e.instance.props;
                if (props.message && props.channel) {

                    let [children, index] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, { id: ["pin", "unpin"] });
                    if (index == -1) [children, index] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, { id: ["edit", "add-reaction", "quote"] });
                    children.splice(children.length - 1, 0, BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
                        label: 'Switch',
                        id: `SwitchPopUp`,
                        action: _ => {
                            if (props.message.author.id == this.getCurrentUser().id) {
                                this.editMessage(props.channel.id, props.message.id, this.swapLanguage(props.message.content));
                            }
                            else {
                                const elements = [];
                                const popoutHTML =
                                `<div>
                                    <div class="item-1BCeuB role-member">
                                        <div class="itemCheckbox-2G8-Td">
                                            <div class="avatar-1XUb0A wrapper-1VLyxH" role="img" aria-hidden="false" style="width: 32px; height: 32px;">
                                                <svg width="40" height="32" viewBox="0 0 40 32" class="mask-1FEkla svg-2azL_l" aria-hidden="true">
                                                    <foreignObject x="0" y="0" width="32" height="32" mask="url(#svg-mask-avatar-default)">
                                                        <div class="avatarStack-3vfSFa">
                                                            <img src="{{avatar_url}}" alt=" " class="avatar-b5OQ1N" aria-hidden="true">
                                                        </div>
                                                    </foreignObject>
                                                </svg>
                                            </div>
                                        </div>
                                        <div class="itemLabel-27pirQ">
                                            <span class="username">
                                                {{username}}
                                            </span>
                                            <span class="discriminator-2jnrqC">
                                                {{discriminator}}
                                            </span>                   
                                        </div>                                                                       
                                    </div>
                                    <br> 
                                    <span style="color:#dddddd">                                   
                                    {{content}}                                
                                    <span>   
                                <div>`;
     
    
                                elements.push(ZeresPluginLibrary.DOMTools.createElement(ZeresPluginLibrary.Utilities.formatString(popoutHTML,
                                    // delete stickers and pings from the message because they looks like shit in raw message
                                    {content: this.swapLanguage(props.message.content.replace(/<:\w+:\d+>|<@&{0,1}\d+>/g, '')), username: props.message.author.username, discriminator: "#" + props.message.author.discriminator, avatar_url: props.message.author.getAvatarURL() }
                                )));

                                BDFDB.ModalUtils.open(this, {
                                    children: [ZeresPluginLibrary.ReactTools.createWrappedElement(elements)],                   
                                });
                            }
                        }
                    }));

                }
            }

            editMessage(channelId, messageId, content) {
                ZeresPluginLibrary.DiscordModules.MessageActions.editMessage(channelId, messageId, { content: content });
            }
            getCurrentUser() {
                return ZeresPluginLibrary.DiscordModules.UserStore.getCurrentUser();
            }
            swapLanguage(message) {
                var swappedMessage = ''
                var words = message.split(' ');
                for (let wordsIterator in words) {
                    const word = words[wordsIterator];
                    const regExp = /<:\w+:\d+>|https{0,1}:\/\/[^ ]*(?!\.)[^. ]+|<@&{0,1}\d+>|@here|@everyone/g; // guild emoji | URL | user/role mention | here/everyone
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

            checkLibraries(libraries) {
                const div = BdApi.React.createElement('div', {});
                div.props.children = [];
                const createMissingLibraryText = (libraryName, libraryUrl) => {
                    return BdApi.React.createElement('div', {}, BdApi.React.createElement('a', {
                        href: libraryUrl,
                        target: '_blank'
                    }, libraryName),
                        BdApi.React.createElement('span', { style: { color: 'white' } }, ' was missing'));
                }
                var hasAllLibs = true;
                for (const library of libraries) {

                    if (!global[library.name]) {
                        hasAllLibs = false;
                        div.props.children.push(createMissingLibraryText(library.name, library.url));
                        fetch(library.url).then(function (response) {
                            return response.text();
                        }).then(function (file) {
                            require('fs').writeFileSync(require('path').join(BdApi.Plugins.folder, library.filename), file);
                        });
                    }
                }
                if (!hasAllLibs) {
                    div.props.children.push(BdApi.React.createElement('span', { style: { color: 'white' } }, 'Please, reload plugin'))
                    BdApi.alert('Missing libraries were downloaded', div);
                    BdApi.Plugins.disable(this.getName());
                    return false;
                }
                return true;
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



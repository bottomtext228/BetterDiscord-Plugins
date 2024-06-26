/**
 * @name CopyGIFLink
 * @version 1.0.2
 * @author bottom_text | Z-Team 
 * @description Copies a GIF link instead of sending a GIF when the Shift key is pressed.
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/CopyGIFLink
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/CopyGIFLink/CopyGIFLink.plugin.js
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

        return class CopyGIFLink extends Plugin {

            onStart() {
                const keyToPress = 16; // shift key

                let [module, key] = BdApi.Webpack.getWithKey(m => m?.render?.toString?.()?.includes('.getResultItems(),suggestions:'))
               
                BdApi.Patcher.after(this.name, module[key], 'render', (_, args, ret) => {
                    const original = ret.props.onSelectGIF;
                    ret.props.onSelectGIF = (GIF) => {
                        // it's the only function BDFDB used for here because it's not that simple to check that key is pressed right now
                        if (BDFDB.ListenerUtils.isPressed(keyToPress)) { 
                            DiscordNative.clipboard.copy(GIF.url);
                            BdApi.UI.showToast('Copied!', { type: 'success', timeout: 1000 });
                        } else {
                            original(GIF);
                        }
                    };
                    return ret;
                })

            }

            onStop() {
                BdApi.Patcher.unpatchAll(this.name);
            }

        };
    })(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();



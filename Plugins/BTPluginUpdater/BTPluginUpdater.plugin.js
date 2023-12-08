/**
 * @name BTPluginUpdater
 * @version 1.0.1
 * @author bottom_text
 * @description Updates bottom_text's plugins.
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/BTPluginUpdater/BTPluginUpdater.plugin.js
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/BTPluginUpdater
 */


module.exports = class BTPluginUpdater {
    constructor(meta) { for (let key in meta) this[key] = meta[key] }
    start() {
        const fs = require('fs');
        const path = require('path');

        BdApi.Net.fetch('https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/README.md', {
            timeout: 60e3
        }).then(e => e.text().then(text => {
            const matches = text.matchAll(/\* \[(\w+)\]\([^()]+\)/g); // fetch plugins list from the github and iterate it
            for (const [_, pluginName] of matches) {
                const plugin = BdApi.Plugins.get(pluginName); // get the plugin if installed   
                if (plugin) {
                    BdApi.Net.fetch(plugin.updateUrl).then(e => e.text()).then(pluginContent => { // fetch plugin from the github 
                        const newVersion = pluginContent.match(/@version (.+)/)?.[1];
                        if (newVersion > plugin.version) { // compare versions
                            const closeNotice = BdApi.UI.showNotice(`${plugin.name} has an update.`, { // show notice with an update button
                                buttons: [{
                                    label: 'Update',
                                    onClick: () => {
                                        closeNotice();
                                        fs.writeFile(path.join(BdApi.Plugins.folder, `${plugin.name}.plugin.js`), pluginContent, (error) => { // update plugin
                                            if (!error) {
                                                BdApi.UI.showToast(`${plugin.name} ${plugin.version} updated to ${newVersion}!`, { type: 'success' });
                                            } else {
                                                BdApi.UI.showToast(`${plugin.name} can't be updated! Try to update it manually.`, { type: 'error', timeout: 5e3 });
                                            }
                                        });
                                    }
                                }]
                            })
                        }
                    }).catch(error => {
                        console.error(error);
                        BdApi.UI.showToast(`${plugin.name} can't be updated! Try to update it manually.`, { type: 'error', timeout: 5e3 });
                    })
                }
            }
        })).catch(error => {
            console.error(error);
            BdApi.UI.showToast(`${this.name}: can't fetch plugins list! Try to update plugins manually.`, { type: 'error', timeout: 5e3 });
        })
    }
    stop() {

    }
}

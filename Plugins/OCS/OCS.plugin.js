/**
 * @name OCS
 * @version 2.1.7
 * @description Orpheus Containment System.
 * @author bottom_text | Z-Team
*/


module.exports = class OCS {
	constructor(meta) {
		for (let key in meta) {
			this[key] = meta[key];
		}
	}
	start() {

		const libraries = [
			{
				name: 'ZeresPluginLibrary',
				url: 'https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js',
				filename: '0PluginLibrary.plugin.js'
			}
		];
		if (!this.checkLibraries(libraries)) {
			return;
		}


		this.findWebPacks();

		this.members = [];
		this.fs = require('fs');
		this.path = require('path');
		this.configPath = this.getConfigPath();
		this.containedObjects = this.loadSettings();
		this.labels = this.setLabelsByLanguage();
		this.sendedMessages = [];

		console.log(`${this.name}: started!`);


		/* 90% of the code is old and pretty bad (settings menu). I won't rewrite it. :trolling: */

		BdApi.Patcher.before(
			this.name,
			this.DispatchWebPack,
			'dispatch',
			(_, args) => this.onDispatchEvent(args)
		);
		// хукаем обработчик основных событий, включая сообщения.
		// before, чтобы не конфликтовало с другими плагинами, хукающими dispatch, так как нам надо только считывать данные 

		BdApi.Patcher.instead(
			this.name,
			this.ComponentDispatchWebpack, // ...
			'dispatch',
			(_, args, original) => this.onComponentDispatchDispatchEvent(args, original)
		); // хук для отключения тряски приложения

		//TODO: Fix menu avatars

	}

	onDispatchEvent(args) { // обработчик событий 
		const dispatch = args[0];
		if (!dispatch)
			return;

		if (dispatch.type == 'MESSAGE_CREATE') {

			const isLocalUser = dispatch.message.author.id == this.getCurrentUser().id;
			const currentObject = this.containedObjects.find(object => {
				if (object.id == dispatch.message.author.id) {
					if (isLocalUser) {
						if (dispatch.optimistic) { // избегаем спама при работе на локального пользователя
							return false;
						}
					}
					return true;
				}
			})
			if (currentObject) {

				if (currentObject.method == 'reactions') {
					currentObject.reactions.forEach(reaction => {
						this.sendReaction(dispatch.message.channel_id, dispatch.message.id, reaction);
					});
				} else if (currentObject.method == 'message') {
					var message = '';
					currentObject.reactions.forEach(reaction => {
						message += this.prepareEmojiToSend(reaction, true);
					});
					if (!isLocalUser || message != dispatch.message.content) { // избегаем "рекурсии" при работе на локального пользователя
						this.sendMessage(dispatch.message.channel_id, message, (response) => {
							if (response.ok) {
								if (this.sendedMessages.length >= 75) { // MAX_SIZE. Prevent memory leaks
									const message = this.sendedMessages.shift();
									this.deleteMessage(message.channelId, message.messageId);

								} // чтобы удалить свои сообщения в последствии надо сохранить их id 
								this.sendedMessages.push({
									messageId: response.body.id,
									repliedMessageId: dispatch.message.id,
									channelId: dispatch.message.channel_id
								});
							}
						});
					}
				}

			}


		}
		if (dispatch.type == 'MESSAGE_DELETE') {
			/* Если жертва удаляет свои сообщения, мы удаляем свои  */
			const message = this.sendedMessages.find(e => e.repliedMessageId == dispatch.id);
			if (message) {
				this.deleteMessage(dispatch.channelId, message.messageId);
				this.sendedMessages.splice(this.sendedMessages.indexOf(message), 1);
			}
		}

	}



	saveSettings() {
		this.fs.writeFileSync(this.configPath, JSON.stringify(this.containedObjects));
	}

	getConfigPath() {
		return this.path.join(BdApi.Plugins.folder, `${this.name}.config.json`);
	}

	sendMessage(channelId, content, responseCallback) {
		this.MessageQueueWebPack.enqueue({
			type: 0,
			message: {
				channelId: channelId,
				content: content,
			} // callback is called when we get server's response
		}, typeof (responseCallback) == 'function' ? responseCallback : () => { });
	}

	deleteMessage(channelId, messageId) {
		return this.MessageUtilitiesWebPack.deleteMessage(channelId, messageId);
	}

	getMembers(guildId) {
		return this.GetMembersWebPack.getMembers(guildId);
	}

	getGuild(guildId) {
		return this.GetGuildWebPack.getGuild(guildId);
	}

	getGuilds() {
		return this.GuildUtilities.getGuilds();
	}

	getCurrentUser() {
		return this.GetCurrentUserWebPack.getCurrentUser();
	}

	getUser(id) {
		return this.GetUserWebPack.getUser(id);
	}

	getEmojiUrl(emojiSurrogate) { // example: '🐖' -> '/assets/d083412544c302d290775006877f6202.svg'
		return this.EmojiUtilitiesWebpack.getURL(emojiSurrogate)
	}

	onComponentDispatchDispatchEvent(args, callDefault) {
		const event = args[0];
		if (event != 'SHAKE_APP') { // убираем тряску экрана
			callDefault(...args);
		}
	}

	sendReaction(channelId, messageId, emojiName) {
		const emoji = this.prepareEmojiToSend(emojiName);
		this.ReactionUtilities.rU(channelId, messageId, emoji, undefined, { burst: false })
	}

	prepareEmojiToSend(emojiName, toString = false) { // tostring - bool. false - return object for addReaction, true - return string for message
		const emoji = this.GetByNameEmojieWebPack.getByName(emojiName);
		if (emoji) {
			return toString ? emoji.surrogates : {
				id: emoji.id == undefined ? null : emoji.id,
				name: emoji.surrogates,
				animated: emoji.animated,
			}
		} else {
			const customEmoji = this.getCustomEmoji(emojiName);
			if (customEmoji) {
				return toString ? `<:${customEmoji.name}:${customEmoji.id}>` : {
					id: customEmoji.id == undefined ? null : customEmoji.id,
					name: customEmoji.name,
					animated: customEmoji.animated,
				}
			}
		}
		return '';
	}

	getCustomEmoji(customEmojiName) {
		for (const guildId in this.getGuilds()) {
			const guildEmojiArray = this.GuildUtilities.getGuildEmoji(guildId); // получаем массив со всеми объектами кастомных эмодзи
			const customEmoji = guildEmojiArray.find(guildEmoji => guildEmoji.name == customEmojiName); // находим нужный
			if (customEmoji) {
				return customEmoji;
			}
		}
	}


	createButton(label, callback, id) {
		const ret = this.parseHTML(`<button type="button" class="${this.ButtonConstansts.button} ${this.ButtonConstansts.lookFilled} ${this.ButtonConstansts.colorBrand} ${this.ButtonConstansts.sizeSmall} ${this.ButtonConstansts.grow}" ${(id ? 'id="' + id + '"' : '')}><div class="contents-3ca1mk">${label}</div></button>`);
		if (callback) {
			ret.addEventListener('click', callback);
		}
		return ret;
	}

	createInput(label, id, callback) {
		const ret = this.parseHTML(
			`<div class="${this.InputConstants.container} ${this.InputConstants.medium}">
				<div class="${this.InputConstants.inner}">
					<input type="text" class="${this.InputConstants.input}" name="message" placeholder="${label}" id="${id}"/>
				</div>
			</div>`
		);
		if (callback) {
			ret.addEventListener('input', callback);
		}
		return ret;
	}
	parseHTML(html) {
		// TODO: drop this func, it's 75% slower than just making the elements manually
		var template = document.createElement('template');
		html = html.trim(); // Never return a text node of whitespace as the result
		template.innerHTML = html;
		return template.content.firstChild;
	}

	findWebPacks() {

		/* зачем все эти приколы с эмодзи помещать в разные модули??? */
		this.ReactionUtilities = ZeresPluginLibrary.WebpackModules.getByProps('rU', 'wX'); // ...
		this.EmojiUtilitiesWebpack = ZeresPluginLibrary.WebpackModules.getByProps('getURL');
		this.GuildUtilities = ZeresPluginLibrary.WebpackModules.getByProps('getGuildEmoji');
		this.GetByNameEmojieWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getByName');

		this.ComponentDispatchWebpack = ZeresPluginLibrary.WebpackModules.getByProps('S', 'b').S // ...
		this.DispatchWebPack = ZeresPluginLibrary.WebpackModules.find(e => e.dispatch && !e.getCurrentUser);
		this.GetUserWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getUser');
		this.GetCurrentUserWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getCurrentUser');
		this.GetGuildWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getGuild');
		this.GetMembersWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getMembers');
		this.MessageQueueWebPack = ZeresPluginLibrary.WebpackModules.getByProps('enqueue');
		this.MessageUtilitiesWebPack = ZeresPluginLibrary.WebpackModules.getByProps('deleteMessage');
		this.ButtonConstansts = ZeresPluginLibrary.WebpackModules.getByProps('lookBlank');

		this.UserTagConstants = { ...ZeresPluginLibrary.WebpackModules.getByProps('userTagUsernameNoNickname'), ...ZeresPluginLibrary.WebpackModules.getByProps('defaultColor') };
		this.InputConstants = { ...ZeresPluginLibrary.WebpackModules.getByProps('input', 'icon', 'close', 'pointer') }

	}



	getSettingsPanel() {

		const menuHTML =
			`<div id="main">

			<button type="button" id="add_button" style="width:565px"
				class="${this.ButtonConstansts.button} ${this.ButtonConstansts.lookFilled} ${this.ButtonConstansts.colorBrand} ${this.ButtonConstansts.sizeSmall} ${this.ButtonConstansts.grow}">
				<div class="contents-3ca1mk">${this.labels.add_button}</div>
			</button>
					
			<pre>&nbsp</pre>

			<div id="containedObjects"> 
			</div>
			
		</div>`


		const html = ZeresPluginLibrary.DOMTools.createElement(menuHTML);


		const buttons = Array.from(html.querySelectorAll('button'));

		buttons.find(button => button.id == 'add_button').addEventListener('click', () => {

			const elements = [];

			const userToAdd = this.parseHTML(`<div id="usertoadd"></div>`);
			const input_id = this.createInput(this.labels.input_id, 'input_id', () => {
				const userIdToFind = document.getElementById('input_id').value.trim();
				if (userIdToFind == '')
					return;
				const user = this.getUser(userIdToFind)
				if (user) {
					this.renderUserToAdd(user);
				}
			});


			const membersTable = this.parseHTML(`<table id="findObjects"></table>`);

			const input_name = this.createInput(this.labels.input_name, 'input_name', () => {

				const usernameToFind = document.getElementById('input_name').value.trim();

				if (usernameToFind == '')
					return;
				membersTable.innerHTML = '';
				for (var membersIterator = 0; membersIterator < this.members.length; membersIterator++) {
					const member = this.members[membersIterator];

					if (member.username.toLowerCase().search(usernameToFind.toLowerCase()) != -1) {
						this.renderUserToAdd(member);
					}
				}

			});

		
			const padding = this.parseHTML(`<pre>&nbsp</pre>`);

			elements.push(userToAdd);
			elements.push(input_id);
			elements.push(padding);
			elements.push(input_name);
			elements.push(membersTable);

			ZeresPluginLibrary.Modals.showModal(this.labels.add_object, ZeresPluginLibrary.ReactTools.createWrappedElement(elements), {
				confirmText: 'OK',
				size: ZeresPluginLibrary.Modals.ModalSizes.SMALL,
				red: false
			});

		});

		// так как конфиг работает на костылях и 1 элемент в нём всегда пустой
		for (var objectIterator = 1; objectIterator < this.containedObjects.length; objectIterator++) {
			this.renderContainedObject(objectIterator, html)
		}



		for (const guildId in this.getGuilds()) { // get all users. We can do it by get all users of all guilds we are in 
			const members = this.getMembers(guildId);
			for (const member of members) {
				if (!this.members.some(e => e.id == member.userId)) {
					this.members.push(this.getUser(member.userId));
				}
				
			}
	
		}

		const input_find = this.parseHTML(`<input type="text" class="input-2m5SfJ" name="message" placeholder="${this.labels.input_find}" id='input_find'/>`);

		const membersTable = document.createElement('table');
		membersTable.id = 'members';
		input_find.addEventListener('input', () => {
			const usernameToFind = document.getElementById('input_find').value.trim();
			if (usernameToFind != '') {
				membersTable.innerHTML = '';
				for (var membersIterator = 0; membersIterator < this.members.length; membersIterator++) {
					const member = this.members[membersIterator];
					if (member.username.toLowerCase().search(usernameToFind.toLowerCase()) != -1) {
						const row = document.createElement('tr');
						row.innerHTML = `<td coldspan ='2'>${member.username}</td>`
						membersTable.append(row);
					}
				}
			} else {
				membersTable.innerHTML = '';
			}
		});

		if (this.sendedMessages.length > 0) {
			const deleteButton =
				this.parseHTML(
					`<button type="button" id="delete_button" style="width:565px"
				class="${this.ButtonConstansts.button} ${this.ButtonConstansts.lookFilled} ${this.ButtonConstansts.colorBrand} ${this.ButtonConstansts.sizeSmall} ${this.ButtonConstansts.grow}">
				<div class="contents-3ca1mk">${this.labels.delete_button}</div>
				</button>`
				);
			deleteButton.addEventListener('click', async e => {
				const wait = (ms) => {
					return new Promise((resolve, reject) => {
						setTimeout(resolve, ms);
					})
				}
				for (let messageIndex in this.sendedMessages) {
					const message = this.sendedMessages[messageIndex];
					this.deleteMessage(message.channelId, message.messageId);
					await wait(500); // prevent rate limit
				}
				this.sendedMessages = [];
			})
			html.append(deleteButton);
		}
		return html;
	}

	renderContainedObject(objectIterator, html) {

		const popoutHTML =
			`<div>	
				<div id="containedUser" style="margin-top: 10px">
					<div style="display: flex; justify-content: left;">
						<img style="height: 32px; height: 32px; border-radius: 50%;" src="{{avatar_url}}">			
						<div style="margin-left: 10px; margin-top: 5px">
							<span class="${this.UserTagConstants.defaultColor}" aria-expanded="false" role="button" tabindex="0">
								{{username}}
							</span>
							<span class="${this.UserTagConstants.discrimBase}">
								{{discriminator}}
							</span>
						</div>
					</div>
				</div>
				<div style="margin-left: 40px;">
					<table id="emojies">
					</table>
				</div>
			</div>`;

		const currentObject = this.containedObjects[objectIterator];

		const user = this.getUser(currentObject.id)

		if (!user) {
			return;
		}

		const elem = ZeresPluginLibrary.DOMTools.createElement(ZeresPluginLibrary.Utilities.formatString(popoutHTML,
			{ username: user.username, discriminator: "#" + user.discriminator, avatar_url: user.getAvatarURL() }))

		const row = document.createElement('tr');
		row.style.display = 'inline-flex';
		for (var emojiesIterator = 0; emojiesIterator < currentObject.reactions.length; emojiesIterator++) {
			row.innerHTML += `<td coldspan ='2'>${this.getReactionTextToDisplay(this.containedObjects[objectIterator].reactions[emojiesIterator])}</td>`;

			elem.querySelector('table').append(row);

		}
		elem.addEventListener('click', () => {
			const elements = [];
			const reactionsInput = this.createInput(this.labels.input_reactions, 'input_reactions', () => {
				const value = document.getElementById('input_reactions').value.trim();
				const table = document.getElementById('emojiesToAdd');
				table.innerHTML = '';
				const row = document.createElement('tr');
				row.style.display = 'inline-flex';
				value.split(' ').forEach(reaction => {
					const textToDisplay = this.getReactionTextToDisplay(reaction);
					if (textToDisplay != '') {
						row.innerHTML += `<td coldspan ='2'>${textToDisplay}</td>`;
					}
				});
				emojies.append(row);
			});

			const emojies = this.parseHTML(
				`<table id="emojiesToAdd">
				</table>`
			)

			reactionsInput.querySelector('input').value = currentObject.reactions.join(' ');

			const row = document.createElement('tr');
			row.style.display = 'inline-flex';
			currentObject.reactions.forEach(reaction => {

				const textToDisplay = this.getReactionTextToDisplay(reaction);
				if (textToDisplay != '') {
					row.innerHTML += `<td coldspan ='2'>${textToDisplay}</td>`;
				}
			});
			const containingMethodText = this.parseHTML(`<span style="color:#dddddd">${this.labels.containing_method_text}: </span>`);

			const radioGroup = [
				{
					name: this.labels.containing_method_reactions,
					value: 'reactions',
					desc: '',
					color: '#DDDDDD'
				},
				{
					name: this.labels.containing_method_message,
					value: 'message',
					desc: '',
					color: '#DDDDDD'
				}
			];
			var containingMethod = currentObject.method;
			const containingMethodRadioGroup = new ZeresPluginLibrary.Settings.RadioGroup('', '', currentObject.method, radioGroup, (method) => {
				containingMethod = method;
			}).getElement();

			elements.push(containingMethodText);
			elements.push(containingMethodRadioGroup);

			emojies.append(row);

			elements.push(reactionsInput);
			elements.push(emojies);
			ZeresPluginLibrary.Modals.showModal(this.labels.add_object_button, ZeresPluginLibrary.ReactTools.createWrappedElement(elements), {
				confirmText: this.labels.delete_object,
				cancelText: this.labels.save_settings,
				size: ZeresPluginLibrary.Modals.ModalSizes.SMALL,
				red: false,
				onConfirm: e => {
					this.containedObjects.splice(objectIterator, 1);
					this.saveSettings();
					elem.innerHTML = '';
				},
				onCancel: t => {
					if (!currentObject) // was deleted
						return;
					const value = document.getElementById('input_reactions').value.trim();
					elem.querySelector('table').innerHTML = '';
					if (value != '') {

						currentObject.reactions = [];
						const reactions = value.split(' ');
						const row = document.createElement('tr');
						row.style.display = 'inline-flex';
						reactions.forEach(reaction => {
							const textToDisplay = this.getReactionTextToDisplay(reaction);
							if (textToDisplay != '') {
								row.innerHTML += `<td coldspan ='2'>${textToDisplay}</td>`;
								currentObject.reactions.push(reaction);
							}
						});
						elem.querySelector('table').append(row);
					} else {
						currentObject.reactions = [];

					}
					currentObject.method = containingMethod;
					this.saveSettings();
				}


			});
		});
		const objects = document.getElementById('containedObjects');
		if (objects) {
			objects.append(elem); // add new user
		}
		if (html) {
			html.querySelectorAll('div')[1].append(elem);
			// фиксим странный новый баг. 
			// Типо элемент ещё не появился и мы не можем через document.getElementById() добавить другие элементы, поэтому передаём элемент в функцию
		}
	}

	getReactionTextToDisplay(reaction) {
		const emoji = this.GetByNameEmojieWebPack.getByName(reaction);
		var textToDisplay = '';
		if (emoji) {
			textToDisplay = `<img aria-label="${emoji.surrogates}" src="${this.getEmojiUrl(emoji.surrogates)}" alt="${emoji.surrogates}" draggable="false" class="emoji jumboable" data-type="emoji" data-name=":${reaction}:"></img>`;
		}
		else {
			const customEmoji = this.getCustomEmoji(reaction);
			if (customEmoji) {
				textToDisplay = `<img aria-label=":${reaction}:" src=${customEmoji.url} alt=":${reaction}:" draggable="false" class="emoji jumboable" data-type="emoji" data-id="${customEmoji.id}"></img>`;
			}
		}
		return textToDisplay;
	}
	renderUser(user) {
		const popoutHTML =
			`<div>
			<div style="margin-top: 10px; margin-bottom: 10px; display: flex; justify-content: left;">
				<img style="height: 32px; height: 32px; border-radius: 50%;" src="{{avatar_url}}">			
				<span style="margin-left: 10px; margin-top: 5px">
					<span class="${this.UserTagConstants.defaultColor}" aria-expanded="false" role="button" tabindex="0">
						{{username}}
					</span>
					<span class="${this.UserTagConstants.discrimBase}">
						{{discriminator}}
					</span>
					</span>
				<div id="confirmAdd" style="margin-right: 0px; margin-left: auto;"></div>
			</div>		
		</div>`;



		const elem = ZeresPluginLibrary.DOMTools.createElement(ZeresPluginLibrary.Utilities.formatString(popoutHTML,
			{ username: user.username, discriminator: "#" + user.discriminator, avatar_url: user.getAvatarURL() }))
		return elem;

	}
	renderUserToAdd(user) {
		const element = this.renderUser(user);

		element.addEventListener('click', () => {
			const div = document.getElementById('usertoadd');
			div.innerHTML = '';
			const userToAdd = this.renderUser(user);
			Array.from(userToAdd.querySelectorAll('div')).find(e => e.id == 'confirmAdd').append(this.createButton(this.labels.add_object_button, () => {
				if (!user.username || !user.id || this.containedObjects.find(object => object.id == user.id)) // если уже есть, то не добавляем
					return;
				this.containedObjects.push({
					'name': user.username,
					'id': user.id,
					'reactions': [],
					'method': 'reactions'
				});
				this.saveSettings();
				document.getElementById('confirm_add_button').firstChild.textContent = this.labels.confirmed_add_button;
				this.renderContainedObject(this.containedObjects.length - 1);

			}, 'confirm_add_button'));
			div.append(userToAdd);
		});
		document.getElementById('findObjects').append(element);

	}

	loadSettings() {
		if (!this.fs.existsSync(this.configPath)) {
			this.fs.writeFileSync(this.configPath, JSON.stringify([{}])); // create empty config
		}
		var settings = [];
		try {
			settings = JSON.parse(this.fs.readFileSync(this.configPath));
		}
		catch {
			this.fs.writeFileSync(this.configPath, JSON.stringify([{}])); // create empty config
			settings = JSON.parse(this.fs.readFileSync(this.configPath));
		}
		return settings;
	}

	setLabelsByLanguage() {
		switch (ZeresPluginLibrary.WebpackModules.getByProps('getLocale')?.getLocale() || document.querySelector("html[lang]").getAttribute("lang")) {
			case 'ru':
				return {
					add_button: 'Добавить объект для сдерживания',
					input_id: 'Введите ID пользователя',
					input_name: 'Введите имя пользователя',
					add_object: 'Добавить объект',
					input_find: 'Поиск по имени',
					input_reactions: 'Введите эмодзи',
					containing_method_text: 'Способ сдерживания',
					object_settings: 'Настройка объекта',
					add_object_button: 'Добавить',
					confirmed_add_button: 'Добавлен',
					delete_object: 'Удалить объект',
					save_settings: 'Сохранить настройки',
					containing_method_reactions: 'Реакции',
					containing_method_message: 'Сообщение',
					delete_button: 'Удалить сообщения'
				}
			default:
				return {
					add_button: 'Add object for containing',
					input_id: 'Enter user ID',
					input_name: 'Enter user name',
					add_object: 'Add object',
					input_find: 'Search by name',
					input_reactions: 'Enter emojies',
					containing_method_text: 'Containing method',
					object_settings: 'Object settings',
					add_object_button: 'Add',
					confirmed_add_button: 'Added',
					delete_object: 'Delete object',
					save_settings: 'Save settings',
					containing_method_reactions: 'Reactions',
					containing_method_message: 'Message',
					delete_button: 'Delete messages'
				}
		}

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
			BdApi.Plugins.disable(this.name);
			return false;
		}
		return true;
	}
	stop() {
		console.log(`${this.name}: stopped!`);
		BdApi.Patcher.unpatchAll(this.name);
	}

}
